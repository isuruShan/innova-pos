require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const Tenant = require('./models/Tenant');
const Store = require('./models/Store');
const User = require('./models/User');
const Category = require('./models/Category');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');

const connectDB = async () => {
  const uri = getMongoConnectionString({ fallback: 'mongodb://127.0.0.1:27017/innovapos' });
  console.log(`Connecting to database: ${uri}`);
  await mongoose.connect(uri);
  console.log('Database connected successfully.');
};

const demoCategories = [
  {
    name: 'Burgers',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=400&q=80',
    sortOrder: 1,
  },
  {
    name: 'Pizzas',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&h=400&q=80',
    sortOrder: 2,
  },
  {
    name: 'Sides',
    imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&h=400&q=80',
    sortOrder: 3,
  },
  {
    name: 'Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&h=400&q=80',
    sortOrder: 4,
  },
  {
    name: 'Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&h=400&q=80',
    sortOrder: 5,
  }
];

const demoMenuItems = [
  // Burgers
  {
    name: 'Classic Beef Burger',
    category: 'Burgers',
    price: 8.99,
    description: 'Juicy prime beef patty, melted cheddar, crisp lettuce, fresh tomato, and our signature burger sauce.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Double Bacon Cheese',
    category: 'Burgers',
    price: 11.49,
    description: 'Two flame-grilled beef patties, double applewood smoked bacon, double cheddar, and caramelized onions.',
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Spicy Crispy Chicken',
    category: 'Burgers',
    price: 9.49,
    description: 'Crispy golden fried chicken breast, spicy house-made mayo, sweet pickles, and crunchy slaw.',
    image: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?auto=format&fit=crop&w=600&h=400&q=80',
  },

  // Pizzas
  {
    name: 'Pepperoni Supreme',
    category: 'Pizzas',
    price: 14.99,
    description: 'Loaded with premium cured beef pepperoni, mozzarella cheese, and fresh Italian herb marinara.',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Classic Margherita',
    category: 'Pizzas',
    price: 12.99,
    description: 'Fresh mozzarella cheese, heirloom tomatoes, fragrant fresh basil leaves, and extra virgin olive oil drizzle.',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&h=400&q=80',
  },

  // Sides
  {
    name: 'Truffle Parmesan Fries',
    category: 'Sides',
    price: 4.49,
    description: 'Golden crispy skin-on fries tossed in white truffle oil, freshly grated parmesan cheese, and rosemary.',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Gourmet Onion Rings',
    category: 'Sides',
    price: 3.99,
    description: 'Thick-cut sweet white onions in light, crispy craft-beer batter, served with chipotle dipping sauce.',
    image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Mozzarella Sticks',
    category: 'Sides',
    price: 5.99,
    description: 'Stretchy herb-breaded mozzarella cheese sticks served golden-brown with marinara dipping sauce.',
    image: 'https://images.unsplash.com/photo-1531749668029-2db88e4b76ce?auto=format&fit=crop&w=600&h=400&q=80',
  },

  // Drinks
  {
    name: 'Chilled Cola',
    category: 'Drinks',
    price: 2.49,
    description: 'Chilled carbonated cola beverage served with ice and lemon slice.',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Iced Caramel Latte',
    category: 'Drinks',
    price: 4.99,
    description: 'Espresso with cold milk, sweet caramel syrup, served over ice.',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Fresh Berry Lemonade',
    category: 'Drinks',
    price: 3.99,
    description: 'Hand-squeezed refreshing lemonade infused with sweet wild berries and fresh mint.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&h=400&q=80',
  },

  // Desserts
  {
    name: 'Chocolate Fudge Lava Cake',
    category: 'Desserts',
    price: 6.99,
    description: 'Warm dark chocolate cake with a rich liquid chocolate center, served with vanilla bean ice cream.',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&h=400&q=80',
  },
  {
    name: 'Strawberry Cheesecake',
    category: 'Desserts',
    price: 5.99,
    description: 'Creamy New York style cheesecake topped with fresh strawberry glaze and graham cracker crust.',
    image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&h=400&q=80',
  }
];

const refundReasons = [
  'Customer changed mind',
  'Ordered incorrect item',
  'Cold food served',
  'Long preparation wait time'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const runSeeder = async () => {
  try {
    await connectDB();

    // 1. Get or pick tenant
    let tenantIdStr = process.argv.find(arg => arg.startsWith('--tenantId='))?.split('=')[1];
    let tenant;

    if (tenantIdStr) {
      tenant = await Tenant.findById(tenantIdStr);
      if (!tenant) {
        console.error(`Specified Tenant ID ${tenantIdStr} not found!`);
        process.exit(1);
      }
    } else {
      tenant = await Tenant.findOne();
      if (!tenant) {
        // Create a default tenant if none exists
        tenant = await Tenant.create({
          slug: 'demo-customer',
          businessName: 'Demo Gourmet Kitchen',
          status: 'active',
          subscriptionStatus: 'active',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
        console.log(`No tenants found. Created default demo tenant: ${tenant._id}`);
      }
    }

    const tenantId = tenant._id;
    console.log(`Using Tenant: ${tenant.businessName} (${tenantId})`);

    // 2. Ensure Store exists
    let store = await Store.findOne({ tenantId });
    if (!store) {
      store = await Store.create({
        tenantId,
        name: 'Main Bistro & Grill',
        code: 'MBST',
        address: '123 Gourmet Ave, Food City',
        phone: '0119876543',
        paymentMethods: ['cash', 'card', 'mobile_wallet'],
        isActive: true,
        isDefault: true,
      });
      console.log(`Created default Store: ${store.name} (${store._id})`);
    } else {
      console.log(`Using Store: ${store.name} (${store._id})`);
    }

    // 3. Clear existing Category and MenuItem for this tenant to avoid duplicate index issues or clutter
    console.log('Cleaning up existing menu items and categories for this tenant...');
    await MenuItem.deleteMany({ tenantId });
    await Category.deleteMany({ tenantId });

    // 4. Create Categories
    const categoriesData = demoCategories.map(cat => ({
      ...cat,
      tenantId,
      storeId: store._id
    }));
    const createdCategories = await Category.create(categoriesData);
    console.log(`Created ${createdCategories.length} categories.`);

    // 5. Create Menu Items
    const menuItemsData = demoMenuItems.map(item => ({
      ...item,
      tenantId,
      storeId: store._id,
      available: true,
      images: [{ url: item.image, key: '' }]
    }));
    const createdMenuItems = await MenuItem.create(menuItemsData);
    console.log(`Created ${createdMenuItems.length} menu items.`);

    // 6. Get cashiers/users for order creation attribution
    const users = await User.find({ tenantId });
    const cashier = users.length > 0 ? users[0] : null;

    // 7. Seed historical orders for the last 10 days
    console.log('Seeding historical orders for the last 10 days...');
    // Delete existing orders for this tenant to ensure a fresh, consistent week of data
    await Order.deleteMany({ tenantId });

    const totalDays = 10;
    const baseDate = new Date();
    const ordersToInsert = [];
    let currentOrderNumber = 1;

    for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(currentDate.getDate() - dayOffset);

      // Number of orders per day (e.g. 15 to 35 orders to represent healthy business)
      const dailyOrderCount = getRandomInt(15, 35);
      console.log(`- Day -${dayOffset} (${currentDate.toDateString()}): Generating ${dailyOrderCount} orders`);

      for (let orderIndex = 0; orderIndex < dailyOrderCount; orderIndex++) {
        // Set timestamp across operating hours (11:00 AM to 10:00 PM)
        const orderTime = new Date(currentDate);
        orderTime.setHours(getRandomInt(11, 21), getRandomInt(0, 59), getRandomInt(0, 59));

        // Pick 1 to 4 unique items
        const numItems = getRandomInt(1, 4);
        const selectedItems = [];
        const itemsCopy = [...createdMenuItems];
        
        for (let k = 0; k < numItems; k++) {
          const idx = getRandomInt(0, itemsCopy.length - 1);
          selectedItems.push(itemsCopy.splice(idx, 1)[0]);
        }

        const orderItems = [];
        let subtotal = 0;

        for (const item of selectedItems) {
          const qty = getRandomInt(1, 3);
          subtotal += item.price * qty;

          orderItems.push({
            menuItem: item._id,
            name: item.name,
            category: item.category,
            qty,
            price: item.price,
            deliveredToTable: true
          });
        }

        const taxRate = 8; // 8% tax
        const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
        const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

        // 5% chance of return/refund for realistic data reporting
        const isReturned = Math.random() < 0.05;
        const returnsList = [];
        let totalReturnedAmount = 0;

        if (isReturned && orderItems.length > 0) {
          const returnedItem = orderItems[0];
          const refundQty = getRandomInt(1, returnedItem.qty);
          const refundAmount = returnedItem.price * refundQty;
          totalReturnedAmount = refundAmount;

          returnsList.push({
            returnedAt: new Date(orderTime.getTime() + getRandomInt(5, 60) * 60000),
            returnedBy: cashier?._id || new mongoose.Types.ObjectId(),
            approvedBy: cashier?._id || new mongoose.Types.ObjectId(),
            reason: getRandomItem(refundReasons),
            refundAmount,
            isFullReturn: refundQty === returnedItem.qty && orderItems.length === 1,
            items: [{
              lineId: new mongoose.Types.ObjectId(),
              menuItem: returnedItem.menuItem,
              name: returnedItem.name,
              qty: refundQty,
              unitPrice: returnedItem.price,
              lineRefund: refundAmount
            }]
          });
        }

        ordersToInsert.push({
          tenantId,
          storeId: store._id,
          orderNumber: currentOrderNumber++,
          orderType: getRandomItem(['dine-in', 'takeaway', 'uber-eats', 'pickme']),
          tableNumber: String(getRandomInt(1, 20)),
          items: orderItems,
          status: 'completed',
          subtotal,
          discountTotal: 0,
          taxRate,
          taxAmount,
          paymentType: getRandomItem(['cash', 'card', 'mobile_wallet']),
          paymentAmount: totalAmount,
          paymentCollected: true,
          totalAmount,
          orderSource: getRandomItem(['pos', 'qr']),
          createdBy: cashier?._id || null,
          createdAt: orderTime,
          updatedAt: orderTime,
          totalReturnedAmount,
          returns: returnsList
        });
      }
    }

    // Insert all generated orders in bulk
    console.log(`Inserting ${ordersToInsert.length} orders into the database...`);
    await Order.insertMany(ordersToInsert);

    console.log('\nSeeding completed successfully!');
    console.log(`Seeded for Tenant ID: ${tenantId}`);
    console.log(`Created ${createdCategories.length} Categories and ${createdMenuItems.length} Menu Items.`);
    console.log(`Generated ${ordersToInsert.length} completed transactions over the last 10 days.`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed with error:', error);
    process.exit(1);
  }
};

runSeeder();
