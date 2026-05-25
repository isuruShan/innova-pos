require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const User = require('./models/User');
const Store = require('./models/Store');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const CashierSession = require('./models/CashierSession');

const connectDB = async () => {
  await mongoose.connect(
    getMongoConnectionString({ fallback: 'mongodb://127.0.0.1:27017/innovapos' }),
  );
  console.log('MongoDB connected for seeding reports data');
};

const defaultMenuItems = [
  { name: 'Classic Beef Burger', category: 'Burgers', price: 590, description: 'Juicy beef patty with lettuce, tomato, and special sauce' },
  { name: 'Double Cheese Burger', category: 'Burgers', price: 790, description: 'Double patties topped with double melted cheddar' },
  { name: 'Crispy Chicken Burger', category: 'Burgers', price: 490, description: 'Spicy crispy breast, lettuce, and premium mayo' },
  { name: 'French Fries (Large)', category: 'Sides', price: 250, description: 'Crispy salted golden potato fries' },
  { name: 'Onion Rings', category: 'Sides', price: 300, description: 'Battered golden deep-fried onion rings' },
  { name: 'Coca Cola Can', category: 'Drinks', price: 150, description: '330ml chilled carbonated drink' },
  { name: 'Iced Coffee', category: 'Drinks', price: 350, description: 'Premium brewed chilled coffee with sweet milk' },
  { name: 'Chocolate Brownie', category: 'Desserts', price: 290, description: 'Fudgy warm double chocolate brownie' }
];

const refundReasons = [
  'Customer changed mind',
  'Cold food served',
  'Incorrect item prepared',
  'Long wait time',
  'Billing error'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const seedReports = async () => {
  try {
    await connectDB();

    // 1. Get all distinct tenantIds from registered users
    const users = await User.find({ tenantId: { $ne: null } });
    const tenantIdsSet = new Set(users.map(u => String(u.tenantId)));
    const tenantIds = Array.from(tenantIdsSet).map(id => new mongoose.Types.ObjectId(id));

    console.log(`Found ${tenantIds.length} tenants in the system to seed.`);

    for (const tenantId of tenantIds) {
      console.log(`\n--------------------------------------------`);
      console.log(`Processing Tenant: ${tenantId}`);

      // 2. Ensure Tenant has a Store
      let store = await Store.findOne({ tenantId });
      if (!store) {
        store = await Store.create({
          tenantId,
          name: 'Central Diner',
          code: 'CDNR',
          address: '456 Galle Road, Colombo',
          phone: '0112345678',
          paymentMethods: ['cash', 'card', 'mobile_wallet'],
          isActive: true,
          isDefault: true,
        });
        console.log(`- Created default store "${store.name}" for tenant.`);
      } else {
        console.log(`- Found existing store: "${store.name}"`);
      }

      // Update all users for this tenant to have this storeId in their list
      await User.updateMany(
        { tenantId },
        { $addToSet: { storeIds: store._id }, $set: { defaultStoreId: store._id } }
      );

      // 3. Ensure Tenant has Menu Items
      let menuItems = await MenuItem.find({ tenantId });
      if (menuItems.length === 0) {
        const itemsToCreate = defaultMenuItems.map(item => ({
          ...item,
          tenantId,
          available: true
        }));
        menuItems = await MenuItem.create(itemsToCreate);
        console.log(`- Seeded ${menuItems.length} menu items for tenant.`);
      } else {
        console.log(`- Found ${menuItems.length} existing menu items.`);
      }

      // 4. Get active Cashiers & Managers for this tenant (with fallbacks)
      const tenantUsers = await User.find({ tenantId });
      if (tenantUsers.length === 0) {
        console.log(`- Skipping orders seeding: Tenant has no users at all.`);
        continue;
      }

      let tenantCashiers = tenantUsers.filter(u => ['cashier', 'manager'].includes(u.role));
      let tenantManagers = tenantUsers.filter(u => ['manager', 'merchant_admin'].includes(u.role));

      if (tenantCashiers.length === 0) {
        tenantCashiers = tenantUsers; // Fallback to any user
      }
      if (tenantManagers.length === 0) {
        tenantManagers = tenantUsers; // Fallback to any user
      }

      const cashier = tenantCashiers[0];
      const manager = tenantManagers[0];

      // 5. Seed Orders (generate 25 completed orders over the last 30 days)
      const orderCount = await Order.countDocuments({ tenantId });
      console.log(`- Current order count: ${orderCount}`);
      
      if (orderCount < 15) {
        await Order.deleteMany({ tenantId });
        console.log(`- Re-seeding orders to guarantee clean analytics ranges...`);

        const newOrders = [];
        const baseDate = new Date();

        for (let i = 0; i < 25; i++) {
          // Distribute dates over last 28 days
          const orderDate = new Date(baseDate);
          orderDate.setDate(orderDate.getDate() - getRandomInt(0, 27));
          // Set random hour
          orderDate.setHours(getRandomInt(8, 22), getRandomInt(0, 59), 0);

          // Select 1 to 3 random menu items
          const itemsCount = getRandomInt(1, 3);
          const orderItems = [];
          let subtotal = 0;

          for (let j = 0; j < itemsCount; j++) {
            const mItem = getRandomItem(menuItems);
            const qty = getRandomInt(1, 2);
            subtotal += mItem.price * qty;

            orderItems.push({
              menuItem: mItem._id,
              name: mItem.name,
              category: mItem.category,
              qty,
              price: mItem.price,
              isCombo: false,
              comboItems: [],
              deliveredToTable: true,
              kitchenNew: false
            });
          }

          const taxRate = 10; // 10% tax
          const taxAmount = Math.round(subtotal * 0.1 * 100) / 100;
          const serviceFeeAmount = 0;
          const totalAmount = subtotal + taxAmount;

          const isReturned = i < 3; // Make 3 orders have returns (refunds report)
          const returnsList = [];
          let totalReturnedAmount = 0;

          if (isReturned) {
            const retItem = orderItems[0];
            const retAmount = retItem.price * retItem.qty;
            totalReturnedAmount = retAmount;
            returnsList.push({
              returnedAt: new Date(orderDate.getTime() + 10 * 60000), // 10 mins later
              returnedBy: cashier._id,
              approvedBy: manager._id,
              reason: getRandomItem(refundReasons),
              refundAmount: retAmount,
              isFullReturn: itemsCount === 1,
              items: [{
                lineId: new mongoose.Types.ObjectId(),
                menuItem: retItem.menuItem,
                name: retItem.name,
                qty: retItem.qty,
                unitPrice: retItem.price,
                lineRefund: retAmount
              }]
            });
          }

          newOrders.push({
            tenantId,
            storeId: store._id,
            orderNumber: i + 1,
            orderType: getRandomItem(['dine-in', 'takeaway', 'uber-eats', 'pickme']),
            tableNumber: String(getRandomInt(1, 12)),
            items: orderItems,
            status: 'completed',
            subtotal,
            discountTotal: 0,
            appliedPromotions: [],
            appliedAutomaticLoyalty: [],
            taxRate,
            taxAmount,
            serviceFeeRate: 0,
            serviceFeeFixed: 0,
            serviceFeeType: 'percentage',
            serviceFeeAmount: 0,
            paymentType: getRandomItem(['cash', 'card', 'mobile_wallet']),
            paymentAmount: totalAmount,
            paymentCollected: true,
            totalAmount,
            orderSource: getRandomItem(['pos', 'qr']),
            customerId: null,
            loyaltyPointsEarned: 0,
            createdBy: cashier._id,
            createdAt: orderDate,
            updatedAt: orderDate,
            totalReturnedAmount,
            returns: returnsList
          });
        }

        // Insert orders without triggering pre-save hook sequence numbers so dates are preserved
        await Order.insertMany(newOrders);
        console.log(`- Successfully seeded 25 orders.`);
      }

      // 6. Seed Cashier Sessions (generate 6 closed shift sessions)
      const sessionCount = await CashierSession.countDocuments({ tenantId });
      console.log(`- Current cashier session count: ${sessionCount}`);

      if (sessionCount < 5) {
        await CashierSession.deleteMany({ tenantId });
        console.log(`- Re-seeding cashier sessions for shift audits...`);

        const baseDate = new Date();
        const newSessions = [];

        for (let i = 0; i < 6; i++) {
          const shiftDate = new Date(baseDate);
          shiftDate.setDate(shiftDate.getDate() - (i * 4)); // space sessions out

          const openTime = new Date(shiftDate);
          openTime.setHours(8, 0, 0);

          const closeTime = new Date(shiftDate);
          closeTime.setHours(16, 0, 0);

          const openingFloat = 5000;
          const salesExpected = getRandomInt(12000, 35000);
          
          // Seed some variances (red marks)
          let varianceAmount = 0;
          if (i === 1) varianceAmount = -250; // shortage
          if (i === 3) varianceAmount = 120;  // overage

          const countedAmount = openingFloat + salesExpected + varianceAmount;

          newSessions.push({
            tenantId,
            storeId: store._id,
            cashierId: cashier._id,
            status: 'closed',
            openingCashBalance: openingFloat,
            expectedCashInDrawer: openingFloat + salesExpected,
            closingCountedCash: countedAmount,
            varianceAmount,
            openedAt: openTime,
            closedAt: closeTime,
            createdAt: openTime,
            updatedAt: closeTime
          });
        }

        await CashierSession.insertMany(newSessions);
        console.log(`- Successfully seeded 6 closed cashier sessions.`);
      }
    }

    console.log('\n============================================');
    console.log('Seeding reports analytics data completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding reports error:', err);
    process.exit(1);
  }
};

seedReports();
