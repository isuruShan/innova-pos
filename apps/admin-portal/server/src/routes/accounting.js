const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const AccountingContact = require('../models/AccountingContact');
const PayrollRun = require('../models/PayrollRun');
const User = require('../models/User');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();
const requireAccounting = requirePaidAddon('accounting');

router.use(protect, tenantScope, requireAccounting);

// Default accounts definition for seeding
const defaultAccountsSeed = [
  { code: '1000', name: 'Cash on Hand', type: 'asset' },
  { code: '1010', name: 'Card Clearing', type: 'asset' },
  { code: '1100', name: 'Bank Account', type: 'asset' },
  { code: '1200', name: 'Accounts Receivable (Debtors)', type: 'asset' },
  { code: '1300', name: 'Inventory Assets', type: 'asset' },
  { code: '2000', name: 'Accounts Payable (Creditors)', type: 'liability' },
  { code: '2100', name: 'Tax Payable', type: 'liability' },
  { code: '2200', name: 'Wages Payable', type: 'liability' },
  { code: '2300', name: 'Tax Withheld Payable', type: 'liability' },
  { code: '3000', name: 'Retained Earnings', type: 'equity' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue' },
  { code: '4100', name: 'Cash Short/Over Income', type: 'revenue' },
  { code: '5000', name: 'Wages Expense', type: 'expense' },
  { code: '5100', name: 'Cost of Goods Sold', type: 'expense' },
  { code: '5200', name: 'Cash Short/Over Expense', type: 'expense' }
];

async function ensureDefaultAccounts(tenantId) {
  for (const item of defaultAccountsSeed) {
    const existing = await Account.findOne({ tenantId, code: item.code });
    if (!existing) {
      await Account.create({
        tenantId,
        code: item.code,
        name: item.name,
        type: item.type,
        isSystem: true
      });
    }
  }
}

async function getOrCreateSystemAccount(tenantId, code) {
  let acc = await Account.findOne({ tenantId, code });
  if (!acc) {
    const seed = defaultAccountsSeed.find(s => s.code === code);
    acc = await Account.create({
      tenantId,
      code,
      name: seed.name,
      type: seed.type,
      isSystem: true
    });
  }
  return acc._id;
}

// 1. Chart of Accounts
router.get('/accounts', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    await ensureDefaultAccounts(req.tenantId);
    const sort = parseSortQuery(req, { code: 'code', name: 'name', type: 'type' }, { code: 1 });
    const accounts = await Account.find({ tenantId: req.tenantId, active: true }).sort(sort).lean();
    
    // Get account balances from journal entries
    const balances = await JournalEntry.aggregate([
      { $match: { tenantId: req.tenantId } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.accountId',
          debits: { $sum: '$lines.debit' },
          credits: { $sum: '$lines.credit' }
        }
      }
    ]);

    const balanceMap = {};
    balances.forEach(b => {
      balanceMap[b._id.toString()] = { debits: b.debits, credits: b.credits };
    });

    const enriched = accounts.map(a => {
      const b = balanceMap[a._id.toString()] || { debits: 0, credits: 0 };
      let balance = 0;
      if (['asset', 'expense'].includes(a.type)) {
        balance = b.debits - b.credits;
      } else {
        balance = b.credits - b.debits;
      }
      return {
        ...a,
        debits: b.debits,
        credits: b.credits,
        balance: Math.round(balance * 100) / 100
      };
    });

    res.json(enriched);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/accounts', authorize('merchant_admin'), async (req, res) => {
  try {
    const { code, name, type, parentAccount } = req.body;
    if (!code || !name || !type) {
      return res.status(400).json({ message: 'Code, Name and Type are required' });
    }
    const acc = await Account.create({
      tenantId: req.tenantId,
      code,
      name,
      type,
      parentAccount: parentAccount || null
    });
    res.status(201).json(acc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 2. Journal Ledger
router.get('/journal', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const sort = parseSortQuery(req, {
      date: 'date',
      createdAt: 'createdAt',
      reference: 'reference',
    }, { date: -1, createdAt: -1 });
    const entries = await JournalEntry.find({ tenantId: req.tenantId })
      .populate('lines.accountId', 'code name type')
      .sort(sort)
      .limit(100)
      .lean();
    res.json(entries);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/journal', authorize('merchant_admin'), async (req, res) => {
  try {
    const { date, reference, description, lines } = req.body;
    if (!lines || lines.length < 2) {
      return res.status(400).json({ message: 'Journal entry must contain at least 2 lines' });
    }

    // Validate account existence
    for (const line of lines) {
      if (!line.accountId) {
        return res.status(400).json({ message: 'Each line must have an accountId' });
      }
      const acc = await Account.findOne({ _id: line.accountId, tenantId: req.tenantId });
      if (!acc) return res.status(400).json({ message: `Account with ID ${line.accountId} not found` });
    }

    const je = await JournalEntry.create({
      tenantId: req.tenantId,
      date: date || new Date(),
      reference: reference || 'Manual Entry',
      referenceModel: 'Manual',
      description: description || 'Manual Journal adjustment',
      lines,
      createdBy: req.user.id
    });

    res.status(201).json(je);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 3. Creditors & Debtors Contacts
router.get('/contacts', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const sort = parseSortQuery(req, { name: 'name', createdAt: 'createdAt', type: 'type' }, { name: 1 });
    const contacts = await AccountingContact.find({ tenantId: req.tenantId }).sort(sort).lean();
    res.json(contacts);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/contacts', authorize('merchant_admin'), async (req, res) => {
  try {
    const { name, type, phone, email, address, creditLimit } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and Type are required' });
    }
    const c = await AccountingContact.create({
      tenantId: req.tenantId,
      name,
      type,
      phone,
      email,
      address,
      creditLimit: creditLimit || 0
    });
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/contacts/:id/payment', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const { amount, paymentType, description } = req.body;
    const paymentAmt = Number(amount || 0);
    if (paymentAmt <= 0) return res.status(400).json({ message: 'Amount must be positive' });

    const contact = await AccountingContact.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!contact) return res.status(404).json({ message: 'Contact not found' });

    await ensureDefaultAccounts(req.tenantId);

    const cashAcc = await getOrCreateSystemAccount(req.tenantId, paymentType === 'card' ? '1010' : '1000');
    const arAcc = await getOrCreateSystemAccount(req.tenantId, '1200');
    const apAcc = await getOrCreateSystemAccount(req.tenantId, '2000');

    const lines = [];
    if (contact.type === 'debtor') {
      // Debtor pays us: Debit Cash/Card, Credit Accounts Receivable
      lines.push({
        accountId: cashAcc,
        debit: paymentAmt,
        credit: 0,
        description: `Receipt from Debtor: ${contact.name}`
      });
      lines.push({
        accountId: arAcc,
        debit: 0,
        credit: paymentAmt,
        description: `Outstanding AR settlement: ${contact.name}`
      });
      contact.outstandingBalance = (contact.outstandingBalance || 0) - paymentAmt;
    } else {
      // We pay creditor: Debit Accounts Payable, Credit Cash/Card
      lines.push({
        accountId: apAcc,
        debit: paymentAmt,
        credit: 0,
        description: `Payment to Creditor: ${contact.name}`
      });
      lines.push({
        accountId: cashAcc,
        debit: 0,
        credit: paymentAmt,
        description: `Wired payout to supplier: ${contact.name}`
      });
      contact.outstandingBalance = (contact.outstandingBalance || 0) - paymentAmt;
    }

    const je = await JournalEntry.create({
      tenantId: req.tenantId,
      date: new Date(),
      reference: `PMT-${contact.type.toUpperCase()}-${Date.now()}`,
      referenceModel: 'Manual',
      description: description || `Settlement payment for ${contact.name}`,
      lines,
      createdBy: req.user.id
    });

    await contact.save();
    res.status(201).json({ contact, journalEntry: je });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Manual Supplier Bill Recording
router.post('/bills', authorize('manager', 'merchant_admin'), resolveSelectedStore, async (req, res) => {
  try {
    const { supplierName, amount, invoiceNumber, date, description } = req.body;
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'Store context required' });

    const billAmt = Number(amount || 0);
    if (billAmt <= 0) return res.status(400).json({ message: 'Amount must be positive' });
    if (!supplierName) return res.status(400).json({ message: 'Supplier Name is required' });

    await ensureDefaultAccounts(req.tenantId);

    const assetAcc = await getOrCreateSystemAccount(req.tenantId, '1300');
    const payableAcc = await getOrCreateSystemAccount(req.tenantId, '2000');

    let contact = await AccountingContact.findOne({
      tenantId: req.tenantId,
      name: supplierName,
      type: 'creditor'
    });

    if (!contact) {
      contact = await AccountingContact.create({
        tenantId: req.tenantId,
        name: supplierName,
        type: 'creditor',
        outstandingBalance: 0
      });
    }

    const lines = [
      {
        accountId: assetAcc,
        debit: billAmt,
        credit: 0,
        description: `Manual Inventory Bill: ${description || 'Stock Purchase'}`
      },
      {
        accountId: payableAcc,
        debit: 0,
        credit: billAmt,
        description: `Accounts Payable to Supplier: ${supplierName}`
      }
    ];

    const je = await JournalEntry.create({
      tenantId: req.tenantId,
      storeId,
      date: date ? new Date(date) : new Date(),
      reference: invoiceNumber || `SUP-BILL-MAN-${Date.now()}`,
      referenceModel: 'Bill',
      description: description || `Bill received from ${supplierName}`,
      lines,
      createdBy: req.user.id
    });

    contact.outstandingBalance = (contact.outstandingBalance || 0) + billAmt;
    await contact.save();

    res.status(201).json({ journalEntry: je, contact });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 4. Payroll Runs
router.get('/payroll', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const sort = parseSortQuery(req, {
      year: 'year',
      month: 'month',
      createdAt: 'createdAt',
    }, { year: -1, month: -1 });
    const runs = await PayrollRun.find({ tenantId: req.tenantId }).sort(sort).lean();
    res.json(runs);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/payroll/calculate', authorize('merchant_admin'), resolveSelectedStore, async (req, res) => {
  try {
    const { month, year } = req.body;
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'Store context required' });
    if (!month || !year) return res.status(400).json({ message: 'Month and Year are required' });

    // Check if payroll run already exists
    const existing = await PayrollRun.findOne({ tenantId: req.tenantId, storeId, month, year });
    if (existing) {
      return res.status(409).json({ message: `Payroll run already exists for ${month}/${year}` });
    }

    // Fetch all active employees (users) in this store
    const employees = await User.find({
      tenantId: req.tenantId,
      isActive: true,
      $or: [
        { storeIds: storeId },
        { defaultStoreId: storeId }
      ]
    }).lean();

    const roleBasics = {
      cashier: 30000,
      manager: 60000,
      kitchen: 40000,
      merchant_admin: 85000
    };

    const slips = employees.map(emp => {
      const basic = roleBasics[emp.role] || 35000;
      const allowances = Math.round(basic * 0.1); // 10% auto-allowance
      const ot = 0;
      const deductions = 0;
      const tax = Math.round(basic * 0.05); // 5% income tax withheld
      const net = basic + allowances + ot - deductions - tax;

      return {
        userId: emp._id,
        employeeName: emp.name,
        basicSalary: basic,
        allowances,
        overtimePay: ot,
        deductions,
        taxWithheld: tax,
        netPay: net
      };
    });

    const run = await PayrollRun.create({
      tenantId: req.tenantId,
      storeId,
      month,
      year,
      status: 'draft',
      slips
    });

    res.status(201).json(run);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/payroll/:id/pay', authorize('merchant_admin'), async (req, res) => {
  try {
    const run = await PayrollRun.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!run) return res.status(404).json({ message: 'Payroll run not found' });
    if (run.status === 'paid') return res.status(400).json({ message: 'Payroll already paid' });

    await ensureDefaultAccounts(req.tenantId);

    const wagesExpAcc = await getOrCreateSystemAccount(req.tenantId, '5000');
    const bankAcc = await getOrCreateSystemAccount(req.tenantId, '1100');
    const taxWithheldAcc = await getOrCreateSystemAccount(req.tenantId, '2300');

    let totalGross = 0;
    let totalTaxWithheld = 0;
    let totalNet = 0;

    for (const slip of run.slips) {
      const gross = (slip.basicSalary || 0) + (slip.allowances || 0) + (slip.overtimePay || 0);
      totalGross += gross;
      totalTaxWithheld += (slip.taxWithheld || 0);
      totalNet += (slip.netPay || 0);
    }

    if (totalGross <= 0) return res.status(400).json({ message: 'Gross wages must be positive' });

    const lines = [
      {
        accountId: wagesExpAcc,
        debit: totalGross,
        credit: 0,
        description: `Gross Wages Expense for payroll ${run.month}/${run.year}`
      },
      {
        accountId: bankAcc,
        debit: 0,
        credit: totalNet,
        description: `Net Wages Payout from Bank for payroll ${run.month}/${run.year}`
      }
    ];

    if (totalTaxWithheld > 0) {
      lines.push({
        accountId: taxWithheldAcc,
        debit: 0,
        credit: totalTaxWithheld,
        description: `Employee Taxes Withheld for payroll ${run.month}/${run.year}`
      });
    }

    const otherDeductions = totalGross - totalNet - totalTaxWithheld;
    if (Math.abs(otherDeductions) > 0.01) {
      const deductAcc = await getOrCreateSystemAccount(req.tenantId, '3000');
      lines.push({
        accountId: deductAcc,
        debit: 0,
        credit: otherDeductions,
        description: `Payroll Deductions for payroll ${run.month}/${run.year}`
      });
    }

    const je = await JournalEntry.create({
      tenantId: req.tenantId,
      storeId: run.storeId,
      date: new Date(),
      reference: `Payroll ${run.month}/${run.year}`,
      referenceModel: 'PayrollRun',
      description: `Staff Payroll Release for ${run.month}/${run.year}`,
      lines,
      createdBy: req.user.id
    });

    run.status = 'paid';
    run.paidAt = new Date();
    run.approvedBy = req.user.id;
    await run.save();

    res.json({ run, journalEntry: je });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 5. Reports Engine
router.get('/reports/profit-loss', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'Start and End dates are required' });

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const accounts = await Account.find({ tenantId: req.tenantId, type: { $in: ['revenue', 'expense'] } }).lean();

    const aggregations = await JournalEntry.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.accountId',
          debits: { $sum: '$lines.debit' },
          credits: { $sum: '$lines.credit' }
        }
      }
    ]);

    const balanceMap = {};
    aggregations.forEach(agg => {
      balanceMap[agg._id.toString()] = { debits: agg.debits, credits: agg.credits };
    });

    let totalRevenues = 0;
    let totalExpenses = 0;

    const items = accounts.map(a => {
      const b = balanceMap[a._id.toString()] || { debits: 0, credits: 0 };
      let net = 0;
      if (a.type === 'revenue') {
        net = b.credits - b.debits;
        totalRevenues += net;
      } else {
        net = b.debits - b.credits;
        totalExpenses += net;
      }
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        type: a.type,
        amount: Math.round(net * 100) / 100
      };
    });

    res.json({
      startDate,
      endDate,
      totalRevenues: Math.round(totalRevenues * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round((totalRevenues - totalExpenses) * 100) / 100,
      items
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/reports/balance-sheet', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const { date } = req.query;
    const cutoffDate = date ? new Date(date) : new Date();
    cutoffDate.setHours(23, 59, 59, 999);

    const accounts = await Account.find({ tenantId: req.tenantId, type: { $in: ['asset', 'liability', 'equity'] } }).lean();

    const aggregations = await JournalEntry.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          date: { $lte: cutoffDate }
        }
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.accountId',
          debits: { $sum: '$lines.debit' },
          credits: { $sum: '$lines.credit' }
        }
      }
    ]);

    const balanceMap = {};
    aggregations.forEach(agg => {
      balanceMap[agg._id.toString()] = { debits: agg.debits, credits: agg.credits };
    });

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const items = accounts.map(a => {
      const b = balanceMap[a._id.toString()] || { debits: 0, credits: 0 };
      let net = 0;
      if (a.type === 'asset') {
        net = b.debits - b.credits;
        totalAssets += net;
      } else if (a.type === 'liability') {
        net = b.credits - b.debits;
        totalLiabilities += net;
      } else {
        net = b.credits - b.debits;
        totalEquity += net;
      }
      return {
        accountId: a._id,
        code: a.code,
        name: a.name,
        type: a.type,
        amount: Math.round(net * 100) / 100
      };
    });

    // Calculate current net profit up to cutoffDate to add to Retained Earnings / Equity
    const plAgg = await JournalEntry.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          date: { $lte: cutoffDate }
        }
      },
      { $unwind: '$lines' },
      {
        $lookup: {
          from: 'accounts',
          localField: 'lines.accountId',
          foreignField: '_id',
          as: 'account'
        }
      },
      { $unwind: '$account' },
      {
        $group: {
          _id: null,
          totalRevenues: {
            $sum: {
              $cond: [
                { $eq: ['$account.type', 'revenue'] },
                { $subtract: ['$lines.credit', '$lines.debit'] },
                0
              ]
            }
          },
          totalExpenses: {
            $sum: {
              $cond: [
                { $eq: ['$account.type', 'expense'] },
                { $subtract: ['$lines.debit', '$lines.credit'] },
                0
              ]
            }
          }
        }
      }
    ]);

    const netProfit = plAgg.length > 0 ? (plAgg[0].totalRevenues - plAgg[0].totalExpenses) : 0;
    totalEquity += netProfit;

    res.json({
      date: cutoffDate,
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      totalEquityBeforeProfit: Math.round((totalEquity - netProfit) * 100) / 100,
      currentPeriodProfit: Math.round(netProfit * 100) / 100,
      totalEquity: Math.round(totalEquity * 100) / 100,
      items
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/reports/cash-flow', authorize('manager', 'merchant_admin'), async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'Start and End dates are required' });

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    await ensureDefaultAccounts(req.tenantId);
    const cashAcc = await getOrCreateSystemAccount(req.tenantId, '1000');
    const bankAcc = await getOrCreateSystemAccount(req.tenantId, '1100');

    // Aggregate cash receipts (Debits to cash accounts from Revenue or Debtors accounts)
    const aggregations = await JournalEntry.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(req.tenantId),
          date: { $gte: startDate, $lte: endDate }
        }
      },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.accountId',
          debits: { $sum: '$lines.debit' },
          credits: { $sum: '$lines.credit' }
        }
      }
    ]);

    const balanceMap = {};
    aggregations.forEach(agg => {
      balanceMap[agg._id.toString()] = { debits: agg.debits, credits: agg.credits };
    });

    const cashBal = balanceMap[cashAcc.toString()] || { debits: 0, credits: 0 };
    const bankBal = balanceMap[bankAcc.toString()] || { debits: 0, credits: 0 };

    const receipts = cashBal.debits + bankBal.debits;
    const payments = cashBal.credits + bankBal.credits;

    res.json({
      startDate,
      endDate,
      cashReceipts: Math.round(receipts * 100) / 100,
      cashPayments: Math.round(payments * 100) / 100,
      netCashFlow: Math.round((receipts - payments) * 100) / 100
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
