require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');
const Order = require('../apps/pos/server/src/models/Order');
const CashierSession = require('../apps/pos/server/src/models/CashierSession');
const User = require('../apps/pos/server/src/models/User');
const Store = require('../apps/pos/server/src/models/Store');

function toOid(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

function buildSessionOrderMatch(tenantId, storeId, cashierId, openedAt, endDate) {
  const cashierOid = toOid(cashierId);
  return {
    tenantId: toOid(tenantId),
    storeId: toOid(storeId),
    status: { $ne: 'cancelled' },
    paymentCollected: true,
    updatedAt: { $gte: openedAt, $lte: endDate },
    $or: [
      { updatedBy: cashierOid },
      { createdBy: cashierOid, updatedBy: { $in: [null, undefined] } }
    ],
  };
}

async function aggregateSessionSalesBreakdown(tenantId, storeId, cashierId, openedAt, endDate) {
  const match = buildSessionOrderMatch(tenantId, storeId, cashierId, openedAt, endDate);
  const cashierOid = toOid(cashierId);

  const returnsMatch = {
    tenantId: toOid(tenantId),
    storeId: toOid(storeId),
    'returns.returnedBy': cashierOid,
    'returns.returnedAt': { $gte: openedAt, $lte: endDate },
  };

  const [totalsAgg, byPayment, returnsAgg] = await Promise.all([
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalDiscounts: { $sum: { $ifNull: ['$discountTotal', 0] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$paymentType', 'unknown'] },
          revenue: { $sum: '$totalAmount' },
          cnt: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: returnsMatch },
      { $unwind: '$returns' },
      {
        $match: {
          'returns.returnedBy': cashierOid,
          'returns.returnedAt': { $gte: openedAt, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$paymentType', 'unknown'] },
          refunded: { $sum: '$returns.refundAmount' },
          cnt: { $sum: 1 },
        },
      },
    ]),
  ]);

  const salesByPaymentType = (byPayment || []).map((r) => ({
    paymentType: String(r._id || 'unknown'),
    revenue: r.revenue || 0,
    orderCount: r.cnt || 0,
  }));

  const refundsByPaymentType = (returnsAgg || []).map((r) => ({
    paymentType: String(r._id || 'unknown'),
    refunded: r.refunded || 0,
    refundsCount: r.cnt || 0,
  }));

  let cashSales = 0;
  let cardSales = 0;
  let otherSales = 0;
  for (const row of salesByPaymentType) {
    const pt = String(row.paymentType || '').toLowerCase();
    if (pt === 'cash') cashSales += row.revenue;
    else if (pt === 'card') cardSales += row.revenue;
    else otherSales += row.revenue;
  }

  let cashRefunds = 0;
  let cardRefunds = 0;
  let otherRefunds = 0;
  for (const row of refundsByPaymentType) {
    const pt = String(row.paymentType || '').toLowerCase();
    if (pt === 'cash') cashRefunds += row.refunded;
    else if (pt === 'card') cardRefunds += row.refunded;
    else otherRefunds += row.refunded;
  }

  return {
    salesByPaymentType,
    refundsByPaymentType,
    cashSales,
    cardSales,
    otherSales,
    cashRefunds,
    cardRefunds,
    otherRefunds,
    totalDiscounts: totalsAgg[0]?.totalDiscounts || 0,
    orderCount: totalsAgg[0]?.orders || 0,
  };
}

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find a real store
  const store = await Store.findOne();
  if (!store) {
    console.error('No store found in DB');
    process.exit(1);
  }

  // Find a cashier user, assign their tenantId to store.tenantId
  const cashier = await User.findOne({ role: 'cashier' });
  if (!cashier) {
    console.error('No cashier user found in DB');
    process.exit(1);
  }

  cashier.tenantId = store.tenantId;
  cashier.storeIds = [store._id];
  await cashier.save();

  const tenantId = store.tenantId;
  const storeId = store._id;
  const cashierId = cashier._id;

  const openedAt = new Date();
  const endDate = new Date(openedAt.getTime() + 60000); // 1 minute window

  // Create a mock order with status 'preparing' and paymentCollected: true
  const order1 = await Order.create({
    tenantId,
    storeId,
    orderNumber: 99999,
    status: 'preparing',
    paymentType: 'cash',
    paymentAmount: 150,
    paymentCollected: true,
    totalAmount: 150,
    createdBy: cashierId,
    updatedBy: cashierId,
    createdAt: openedAt,
    updatedAt: openedAt,
    items: [{ menuItem: new mongoose.Types.ObjectId(), name: 'Burger', qty: 2, price: 75 }]
  });
  console.log('Created paid pending order:', order1._id);

  // Create a return/refund on another completed order
  const order2 = await Order.create({
    tenantId,
    storeId,
    orderNumber: 99998,
    status: 'completed',
    paymentType: 'cash',
    paymentAmount: 200,
    paymentCollected: true,
    totalAmount: 200,
    createdBy: cashierId,
    updatedBy: cashierId,
    createdAt: openedAt,
    updatedAt: openedAt,
    items: [{ menuItem: new mongoose.Types.ObjectId(), name: 'Pizza', qty: 1, price: 200 }]
  });

  order2.returns = [{
    returnedAt: openedAt,
    returnedBy: cashierId,
    refundAmount: 50,
    isFullReturn: false,
    items: [{
      lineId: order2.items[0]._id,
      menuItem: order2.items[0].menuItem,
      name: order2.items[0].name,
      qty: 1,
      unitPrice: 200,
      lineRefund: 50
    }]
  }];
  order2.totalReturnedAmount = 50;
  order2.updatedAt = openedAt;
  await order2.save();
  console.log('Created mock return on order:', order2._id);

  const breakdown = await aggregateSessionSalesBreakdown(tenantId, storeId, cashierId, openedAt, endDate);
  console.log('Breakdown calculated:', JSON.stringify(breakdown, null, 2));

  // Assertions
  if (breakdown.cashSales !== 350) { // order1 (150) + order2 (200)
    console.error(`FAIL: expected cashSales to be 350, got ${breakdown.cashSales}`);
  } else {
    console.log('PASS: cashSales correctly matches 350');
  }

  if (breakdown.cashRefunds !== 50) {
    console.error(`FAIL: expected cashRefunds to be 50, got ${breakdown.cashRefunds}`);
  } else {
    console.log('PASS: cashRefunds correctly matches 50');
  }

  // Cleanup
  await Order.deleteOne({ _id: order1._id });
  await Order.deleteOne({ _id: order2._id });
  console.log('Cleaned up mock orders');

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
