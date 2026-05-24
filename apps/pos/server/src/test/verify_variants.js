'use strict';

require('dotenv').config({ path: `${__dirname}/../../.env` });
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');

const VariantCriteria = require('../models/VariantCriteria');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const { enrichItems, mergeItemsForUpdate, appendItemsToOrder, recalculateOrderMoney } = require('../utils/orderHelpers');

const MONGO_URI = getMongoConnectionString({
  fallback: 'mongodb://127.0.0.1:27017/pos_fastfood',
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

async function run() {
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.');

  const tenantId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();

  console.log('\n--- 1. Testing VariantCriteria CRUD route logic ---');
  await VariantCriteria.deleteMany({ tenantId });
  
  const sizeCriteria = await VariantCriteria.create({
    tenantId,
    name: 'Size',
    values: ['Small', 'Medium']
  });
  assert(sizeCriteria.name === 'Size', 'Size criteria created');
  assert(sizeCriteria.values.length === 2, 'Size has 2 values');

  let cleanName = 'Size';
  let cleanValues = ['Medium', 'Large'];
  let existingCriteria = await VariantCriteria.findOne({
    tenantId,
    name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
  });
  assert(!!existingCriteria, 'Found existing Size criteria');
  const merged = [...new Set([...(existingCriteria.values || []), ...cleanValues])];
  existingCriteria.values = merged;
  await existingCriteria.save();
  
  assert(existingCriteria.values.length === 3, 'Size values merged to 3 unique values');
  assert(existingCriteria.values.includes('Large'), 'Merged size includes Large');

  console.log('\n--- 2. Testing MenuItem with variants ---');
  await MenuItem.deleteMany({ tenantId });

  const itemWithVariants = await MenuItem.create({
    tenantId,
    storeId,
    name: 'Coffee',
    code: 'COF',
    category: 'Beverages',
    price: 3.50,
    hasVariants: true,
    variantOptions: [
      { name: 'Size', values: ['Small', 'Large'] },
      { name: 'Flavor', values: ['Vanilla', 'Mocha'] }
    ],
    variants: [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Small / Vanilla',
        price: 4.00,
        attributes: [
          { name: 'Size', value: 'Small' },
          { name: 'Flavor', value: 'Vanilla' }
        ]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Small / Mocha',
        price: 4.50,
        attributes: [
          { name: 'Size', value: 'Small' },
          { name: 'Flavor', value: 'Mocha' }
        ]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Large / Vanilla',
        price: 5.00,
        attributes: [
          { name: 'Size', value: 'Large' },
          { name: 'Flavor', value: 'Vanilla' }
        ]
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Large / Mocha',
        price: 5.50,
        attributes: [
          { name: 'Size', value: 'Large' },
          { name: 'Flavor', value: 'Mocha' }
        ]
      }
    ]
  });

  assert(itemWithVariants.hasVariants === true, 'MenuItem registered hasVariants flag');
  assert(itemWithVariants.variants.length === 4, '4 variants created successfully');

  const normalItem = await MenuItem.create({
    tenantId,
    storeId,
    name: 'Croissant',
    code: 'CRO',
    category: 'Bakery',
    price: 2.75,
    hasVariants: false
  });

  console.log('\n--- 3. Testing enrichItems for orders ---');
  const variantMochaId = itemWithVariants.variants[1]._id;
  const variantLargeVanillaId = itemWithVariants.variants[2]._id;

  const rawOrderItems = [
    {
      menuItem: itemWithVariants._id,
      qty: 2,
      variantId: variantMochaId.toString(),
    },
    {
      menuItem: itemWithVariants._id,
      qty: 1,
      variantId: variantLargeVanillaId.toString(),
    },
    {
      menuItem: normalItem._id,
      qty: 3,
    }
  ];

  const enriched = await enrichItems(rawOrderItems, tenantId, storeId);
  
  assert(enriched.length === 3, 'Enriched 3 cart rows');
  assert(enriched[0].price === 4.50, 'First item price matches Small / Mocha variant price (4.50)');
  assert(enriched[0].variantName === 'Small / Mocha', 'First item name matches variant name');
  assert(enriched[0].variantAttributes.length === 2, 'First item has variant attributes');
  assert(enriched[1].price === 5.00, 'Second item price matches Large / Vanilla variant (5.00)');
  assert(enriched[1].variantName === 'Large / Vanilla', 'Second item name matches variant name');
  assert(enriched[2].price === 2.75, 'Third item price matches normal item price (2.75)');
  assert(enriched[2].variantId === null, 'Third item variantId is null');

  console.log('\n--- 4. Testing appendItemsToOrder (distinct cart rows check) ---');
  
  const order = new Order({
    tenantId,
    storeId,
    orderNumber: 'TEST-001',
    orderType: 'dine_in',
    status: 'pending',
    items: []
  });

  await appendItemsToOrder(order, [rawOrderItems[0]], tenantId, storeId);
  assert(order.items.length === 1, 'Added first item (Small / Mocha, qty 2) to empty order');
  assert(order.items[0].qty === 2, 'First item has qty 2');

  await appendItemsToOrder(order, [{
    menuItem: itemWithVariants._id,
    qty: 3,
    variantId: variantMochaId.toString(),
  }], tenantId, storeId);
  assert(order.items.length === 1, 'Same variant did not create new row, merged instead');
  assert(order.items[0].qty === 5, 'Merged quantity matches 2 + 3 = 5');

  await appendItemsToOrder(order, [{
    menuItem: itemWithVariants._id,
    qty: 1,
    variantId: variantLargeVanillaId.toString(),
  }], tenantId, storeId);
  
  assert(order.items.length === 2, 'Different variant created a separate row as expected!');
  assert(order.items[0].variantName === 'Small / Mocha', 'First row is Small / Mocha');
  assert(order.items[1].variantName === 'Large / Vanilla', 'Second row is Large / Vanilla');

  console.log('\n--- 5. Testing recalculateOrderMoney ---');
  await recalculateOrderMoney(order);
  assert(order.subtotal === 27.50, `Subtotal calculated correctly: ${order.subtotal}`);
  assert(order.totalAmount >= 27.50, `Total amount including default tax/service fees is: ${order.totalAmount}`);

  console.log('\n--- 6. Testing mergeItemsForUpdate ---');
  const incomingForUpdate = [
    {
      _id: order.items[0]._id,
      menuItem: itemWithVariants._id,
      qty: 3,
      variantId: variantMochaId.toString(),
    },
    {
      _id: order.items[1]._id,
      menuItem: itemWithVariants._id,
      qty: 1,
      variantId: variantLargeVanillaId.toString(),
    }
  ];

  const mergedUpdate = await mergeItemsForUpdate(order.items, incomingForUpdate, tenantId, storeId, order.status);
  assert(mergedUpdate.length === 2, 'Merged update contains 2 items');
  assert(mergedUpdate[0].qty === 3, 'Small / Mocha quantity updated to 3');
  assert(mergedUpdate[0].price === 4.50, 'Price of Small / Mocha variant verified at 4.50');

  await VariantCriteria.deleteMany({ tenantId });
  await MenuItem.deleteMany({ tenantId });
  console.log('\nCleaned up all test documents.');

  await mongoose.disconnect();
  console.log('Disconnected.');
  console.log('\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<');
}

run().catch((err) => {
  console.error('Test script failed with error:', err);
  mongoose.disconnect();
});
