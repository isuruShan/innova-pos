/**
 * Automated Verification Script for POS Split Billing
 * ----------------------------------------------------
 * Run from the server directory:
 *   node src/scripts/test-split-bill.js
 */
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');

async function main() {
  console.log('\n=== [1] Loading runtime secrets ===');
  try {
    const { loadSecretsEnvOrExit } = require('@innovapos/runtime-env');
    await loadSecretsEnvOrExit();
    console.log('✔ Secrets loaded');
  } catch (e) {
    console.error('✘ Failed to load secrets:', e.message);
    process.exit(1);
  }

  console.log('\n=== [2] Connecting to Database ===');
  const connectDB = require('../config/db');
  await connectDB(console);

  const Order = require('../models/Order');
  
  // Create a mock tenant and store ID for the test
  const tenantId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  const mockItem1 = {
    _id: new mongoose.Types.ObjectId(),
    menuItem: new mongoose.Types.ObjectId(),
    name: 'Tacos',
    qty: 2,
    price: 15.00
  };

  const mockItem2 = {
    _id: new mongoose.Types.ObjectId(),
    menuItem: new mongoose.Types.ObjectId(),
    name: 'Soda',
    qty: 3,
    price: 3.00
  };

  console.log('\n=== [3] Creating Test Order ===');
  const order = new Order({
    tenantId,
    storeId,
    orderNumber: 99999,
    orderType: 'dine-in',
    tableNumber: '42',
    status: 'delivered', // Can be advanced to completed
    items: [mockItem1, mockItem2],
    subtotal: 39.00,
    discountTotal: 4.00,
    taxRate: 0.1,
    taxAmount: 3.50, // (39 - 4) * 0.1
    serviceFeeAmount: 1.50,
    totalAmount: 40.00, // 39 - 4 + 3.5 + 1.5
    paymentCollected: false,
    payments: [],
    createdBy: userId
  });

  await order.save();
  console.log(`✔ Order saved with totalAmount: $${order.totalAmount}`);

  // Test checkout validation functions simulating orders.js route
  async function simulateCheckout(orderId, body) {
    const targetOrder = await Order.findById(orderId);
    if (!targetOrder) throw new Error('Order not found');

    const nextStatus = 'completed';
    const { paymentType: pt, paymentAmount: pa, payments: bodyPayments } = body;

    if (Array.isArray(bodyPayments) && bodyPayments.length > 0) {
      targetOrder.payments = bodyPayments;
      const totalPaid = bodyPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const expected = Number(targetOrder.totalAmount || 0);
      if (totalPaid + 0.005 < expected) {
        throw new Error(`Total split payments of ${totalPaid.toFixed(2)} do not cover the order total of ${expected.toFixed(2)}.`);
      }
      targetOrder.paymentType = 'split';
      targetOrder.paymentAmount = totalPaid;
      targetOrder.paymentCollected = true;
    } else {
      const expected = Number(targetOrder.totalAmount || 0);
      const paid = Number(pa != null ? pa : expected);
      if (paid + 0.005 < expected) {
        throw new Error(`Collect ${expected.toFixed(2)} before completing this order.`);
      }
      targetOrder.payments = [{ paymentType: pt, amount: paid }];
      targetOrder.paymentType = pt;
      targetOrder.paymentAmount = paid;
      targetOrder.paymentCollected = true;
    }

    targetOrder.status = nextStatus;
    await targetOrder.save();
    return targetOrder;
  }

  try {
    console.log('\n=== [4] Testing Validation Failure (insufficient payment) ===');
    await simulateCheckout(order._id, {
      payments: [
        { paymentType: 'cash', amount: 15.00 },
        { paymentType: 'card', amount: 20.00 }
      ]
    });
    console.error('✘ Expected validation failure for insufficient payment but it succeeded!');
    process.exit(1);
  } catch (err) {
    console.log(`✔ Correctly rejected insufficient split payment: ${err.message}`);
  }

  console.log('\n=== [5] Testing Successful Split Payment (Custom split) ===');
  const customSplits = [
    { paymentType: 'cash', amount: 15.00, itemsPaid: [] },
    { paymentType: 'card', amount: 25.00, itemsPaid: [] }
  ];

  const paidOrder = await simulateCheckout(order._id, {
    payments: customSplits
  });

  console.log(`✔ Paid Order paymentCollected: ${paidOrder.paymentCollected}`);
  console.log(`✔ Paid Order status: ${paidOrder.status}`);
  console.log(`✔ Paid Order payments count: ${paidOrder.payments.length}`);

  if (paidOrder.paymentCollected !== true || paidOrder.status !== 'completed' || paidOrder.payments.length !== 2) {
    console.error('✘ Test failed: order did not update properly on success.');
    process.exit(1);
  }

  console.log('\n=== [6] Testing Successful Split Payment (Pay by Item Split) ===');
  // Reset order to unpaid
  paidOrder.status = 'delivered';
  paidOrder.paymentCollected = false;
  paidOrder.payments = [];
  await paidOrder.save();

  // Selected item split payload (Tacos subtotal $30, Soda subtotal $9. Original subtotal $39)
  // Ratio for Tacos: 30 / 39 = 0.769
  // Taco share: (30 - 4*0.769 + 3.5*0.769 + 1.5*0.769) = 30 - 3.076 + 2.69 + 1.15 = ~30.76
  // Soda share: remainder = ~9.24
  const itemSplits = [
    {
      paymentType: 'cash',
      amount: 30.76,
      itemsPaid: [{ itemId: mockItem1._id, qty: 2 }]
    },
    {
      paymentType: 'card',
      amount: 9.24,
      itemsPaid: [{ itemId: mockItem2._id, qty: 3 }]
    }
  ];

  const itemPaidOrder = await simulateCheckout(paidOrder._id, {
    payments: itemSplits
  });

  console.log(`✔ Item Paid Order paymentCollected: ${itemPaidOrder.paymentCollected}`);
  console.log(`✔ Item Paid Order payments count: ${itemPaidOrder.payments.length}`);
  console.log(`✔ First payment itemsPaid:`, itemPaidOrder.payments[0].itemsPaid);

  if (itemPaidOrder.payments[0].itemsPaid[0].qty !== 2) {
    console.error('✘ Test failed: itemPaid quantities did not match.');
    process.exit(1);
  }

  console.log('\n=== [7] Cleaning Up Test Order ===');
  await Order.deleteOne({ _id: order._id });
  console.log('✔ Cleaned up database.');

  await mongoose.disconnect();
  console.log('\n=== Verification complete. All tests PASSED. ===\n');
  process.exit(0);
}

main().catch(e => {
  console.error('\n[FATAL]', e.message, e.stack);
  process.exit(1);
});
