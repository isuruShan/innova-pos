const mongoose = require('mongoose');
const { isAccountingEffective } = require('@innovapos/paid-addons');
const Tenant = require('../models/Tenant');

async function isAccountingActive(tenantId) {
  if (!tenantId) return false;
  const tenant = await Tenant.findById(tenantId).select('paidAddons').lean();
  return isAccountingEffective(tenant?.paidAddons);
}

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
  const Account = require('../models/Account');
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
  const Account = require('../models/Account');
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

async function syncOrder(orderId) {
  try {
    const Order = require('../models/Order');
    const order = await Order.findById(orderId);
    if (!order || order.status !== 'completed') return;

    const active = await isAccountingActive(order.tenantId);
    if (!active) return;

    await ensureDefaultAccounts(order.tenantId);

    const JournalEntry = require('../models/JournalEntry');

    const accountsMap = {};
    const neededCodes = ['1000', '1010', '1200', '4000', '2100'];
    for (const c of neededCodes) {
      accountsMap[c] = await getOrCreateSystemAccount(order.tenantId, c);
    }

    let debitAccountId = accountsMap['1000'];
    const pt = String(order.paymentType || '').toLowerCase();
    if (pt === 'card') {
      debitAccountId = accountsMap['1010'];
    } else if (!order.paymentCollected || pt === 'credit' || pt === 'tab') {
      debitAccountId = accountsMap['1200'];
    }

    const total = Number(order.totalAmount || 0);
    const tax = Number(order.taxAmount || 0);
    const revenue = total - tax;

    if (total <= 0) return;

    const lines = [
      {
        accountId: debitAccountId,
        debit: total,
        credit: 0,
        description: `Payment for Order #${order.orderNumber || orderId}`
      },
      {
        accountId: accountsMap['4000'],
        debit: 0,
        credit: revenue,
        description: `Sales Revenue for Order #${order.orderNumber || orderId}`
      }
    ];

    if (tax > 0) {
      lines.push({
        accountId: accountsMap['2100'],
        debit: 0,
        credit: tax,
        description: `Sales Tax Collected for Order #${order.orderNumber || orderId}`
      });
    }

    const je = await JournalEntry.create({
      tenantId: order.tenantId,
      storeId: order.storeId,
      date: order.createdAt || new Date(),
      reference: `Order #${order.orderNumber || orderId}`,
      referenceModel: 'Order',
      description: `POS Checkout Order #${order.orderNumber || orderId}`,
      lines
    });

    if (debitAccountId.toString() === accountsMap['1200'].toString()) {
      const AccountingContact = require('../models/AccountingContact');
      let debtorName = 'Walk-in Customer';
      if (order.customerId) {
        const Customer = require('../models/Customer');
        const cust = await Customer.findById(order.customerId).lean();
        if (cust) debtorName = cust.name;
      }

      let contact = await AccountingContact.findOne({
        tenantId: order.tenantId,
        name: debtorName,
        type: 'debtor'
      });

      if (!contact) {
        contact = await AccountingContact.create({
          tenantId: order.tenantId,
          name: debtorName,
          type: 'debtor',
          outstandingBalance: 0
        });
      }

      contact.outstandingBalance = (contact.outstandingBalance || 0) + total;
      await contact.save();
    }

    return je;
  } catch (err) {
    console.error('[Accounting Sync Error] Failed to sync order:', err);
  }
}

async function syncSupplierBill(tenantId, storeId, billDetails) {
  try {
    const active = await isAccountingActive(tenantId);
    if (!active) return;

    await ensureDefaultAccounts(tenantId);

    const JournalEntry = require('../models/JournalEntry');
    const AccountingContact = require('../models/AccountingContact');

    const assetAcc = await getOrCreateSystemAccount(tenantId, '1300');
    const payableAcc = await getOrCreateSystemAccount(tenantId, '2000');

    const amount = Number(billDetails.amount || 0);
    if (amount <= 0) return;

    let contact = await AccountingContact.findOne({
      tenantId,
      name: billDetails.supplierName,
      type: 'creditor'
    });

    if (!contact) {
      contact = await AccountingContact.create({
        tenantId,
        name: billDetails.supplierName,
        type: 'creditor',
        outstandingBalance: 0
      });
    }

    const lines = [
      {
        accountId: assetAcc,
        debit: amount,
        credit: 0,
        description: `Stock Purchase: ${billDetails.description || 'Inventory Bill'}`
      },
      {
        accountId: payableAcc,
        debit: 0,
        credit: amount,
        description: `Accounts Payable: ${billDetails.description || 'Inventory Bill'}`
      }
    ];

    const je = await JournalEntry.create({
      tenantId,
      storeId,
      date: billDetails.date || new Date(),
      reference: billDetails.invoiceNumber || `SUP-BILL-${Date.now()}`,
      referenceModel: 'Bill',
      description: billDetails.description || 'Supplier Bill Received',
      lines
    });

    contact.outstandingBalance = (contact.outstandingBalance || 0) + amount;
    await contact.save();

    return je;
  } catch (err) {
    console.error('[Accounting Sync Error] Failed to sync supplier bill:', err);
  }
}

async function syncPayrollRun(payrollRunId) {
  try {
    const PayrollRun = require('../models/PayrollRun');
    const pr = await PayrollRun.findById(payrollRunId);
    if (!pr || pr.status !== 'paid') return;

    const active = await isAccountingActive(pr.tenantId);
    if (!active) return;

    await ensureDefaultAccounts(pr.tenantId);

    const JournalEntry = require('../models/JournalEntry');

    const wagesExpAcc = await getOrCreateSystemAccount(pr.tenantId, '5000');
    const bankAcc = await getOrCreateSystemAccount(pr.tenantId, '1100');
    const taxWithheldAcc = await getOrCreateSystemAccount(pr.tenantId, '2300');

    let totalGross = 0;
    let totalTaxWithheld = 0;
    let totalNet = 0;

    for (const slip of pr.slips) {
      const gross = (slip.basicSalary || 0) + (slip.allowances || 0) + (slip.overtimePay || 0);
      totalGross += gross;
      totalTaxWithheld += (slip.taxWithheld || 0);
      totalNet += (slip.netPay || 0);
    }

    if (totalGross <= 0) return;

    const lines = [
      {
        accountId: wagesExpAcc,
        debit: totalGross,
        credit: 0,
        description: `Gross Wages Expense for payroll ${pr.month}/${pr.year}`
      },
      {
        accountId: bankAcc,
        debit: 0,
        credit: totalNet,
        description: `Net Wages Payout from Bank for payroll ${pr.month}/${pr.year}`
      }
    ];

    if (totalTaxWithheld > 0) {
      lines.push({
        accountId: taxWithheldAcc,
        debit: 0,
        credit: totalTaxWithheld,
        description: `Employee Taxes Withheld for payroll ${pr.month}/${pr.year}`
      });
    }

    const otherDeductions = totalGross - totalNet - totalTaxWithheld;
    if (Math.abs(otherDeductions) > 0.01) {
      const deductAcc = await getOrCreateSystemAccount(pr.tenantId, '3000');
      lines.push({
        accountId: deductAcc,
        debit: 0,
        credit: otherDeductions,
        description: `Payroll Deductions for payroll ${pr.month}/${pr.year}`
      });
    }

    const je = await JournalEntry.create({
      tenantId: pr.tenantId,
      storeId: pr.storeId,
      date: pr.paidAt || new Date(),
      reference: `Payroll ${pr.month}/${pr.year}`,
      referenceModel: 'PayrollRun',
      description: `Staff Payroll Release for ${pr.month}/${pr.year}`,
      lines
    });

    return je;
  } catch (err) {
    console.error('[Accounting Sync Error] Failed to sync payroll run:', err);
  }
}

async function syncSessionClose(sessionId) {
  try {
    const CashierSession = require('../models/CashierSession');
    const session = await CashierSession.findById(sessionId);
    if (!session || session.status !== 'closed') return;

    const active = await isAccountingActive(session.tenantId);
    if (!active) return;

    await ensureDefaultAccounts(session.tenantId);

    const JournalEntry = require('../models/JournalEntry');

    const cashAcc = await getOrCreateSystemAccount(session.tenantId, '1000');
    const bankAcc = await getOrCreateSystemAccount(session.tenantId, '1100');
    const shortExpAcc = await getOrCreateSystemAccount(session.tenantId, '5200');
    const overIncAcc = await getOrCreateSystemAccount(session.tenantId, '4100');

    const variance = Number(session.varianceAmount || 0);
    if (Math.abs(variance) > 0.01) {
      const lines = [];
      if (variance < 0) {
        const amt = Math.abs(variance);
        lines.push({
          accountId: shortExpAcc,
          debit: amt,
          credit: 0,
          description: `Cash drawer shortage: ${session.varianceNotes || 'Session close variance'}`
        });
        lines.push({
          accountId: cashAcc,
          debit: 0,
          credit: amt,
          description: 'Cash drawer adjustment for shortage'
        });
      } else {
        lines.push({
          accountId: cashAcc,
          debit: variance,
          credit: 0,
          description: `Cash drawer surplus: ${session.varianceNotes || 'Session close variance'}`
        });
        lines.push({
          accountId: overIncAcc,
          debit: 0,
          credit: variance,
          description: 'Cash drawer adjustment for surplus'
        });
      }

      await JournalEntry.create({
        tenantId: session.tenantId,
        storeId: session.storeId,
        date: session.closedAt || new Date(),
        reference: `Session-Close-Var-${session._id}`,
        referenceModel: 'Manual',
        description: 'Cash drawer variance adjustment on close',
        lines
      });
    }

    const dropAmount = Number(session.closingCountedCash || 0) - Number(session.floatAmount || 0);
    if (dropAmount > 0.01) {
      const lines = [
        {
          accountId: bankAcc,
          debit: dropAmount,
          credit: 0,
          description: 'Safe Drop / Bank Deposit from Cashier Session'
        },
        {
          accountId: cashAcc,
          debit: 0,
          credit: dropAmount,
          description: 'Cash drop transfer from register'
        }
      ];

      await JournalEntry.create({
        tenantId: session.tenantId,
        storeId: session.storeId,
        date: session.closedAt || new Date(),
        reference: `Safe-Drop-${session._id}`,
        referenceModel: 'Manual',
        description: 'Safe drop / register transfer to bank',
        lines
      });
    }
  } catch (err) {
    console.error('[Accounting Sync Error] Failed to sync session close:', err);
  }
}

module.exports = {
  isAccountingActive,
  ensureDefaultAccounts,
  getOrCreateSystemAccount,
  syncOrder,
  syncSupplierBill,
  syncPayrollRun,
  syncSessionClose
};
