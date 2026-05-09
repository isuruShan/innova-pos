require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const MenuItem = require('./models/MenuItem');
const Inventory = require('./models/Inventory');
const Category = require('./models/Category');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected for seeding');
};

const users = [
  { name: 'Admin Manager', email: 'manager@pos.com', password: 'manager123', role: 'manager' },
  { name: 'Sarah Cashier', email: 'cashier@pos.com', password: 'cashier123', role: 'cashier' },
  { name: 'John Kitchen', email: 'kitchen@pos.com', password: 'kitchen123', role: 'kitchen' },
];

const menuItems = [
  { name: 'Classic Burger', category: 'Burgers', price: 5.99, description: 'Juicy beef patty with lettuce, tomato, and our special sauce', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80', available: true },
  { name: 'Cheese Burger', category: 'Burgers', price: 6.99, description: 'Classic burger topped with melted American cheese', image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=300&q=80', available: true },
  { name: 'Double Smash Burger', category: 'Burgers', price: 9.49, description: 'Two smashed patties with double cheese and caramelized onions', image: 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?w=300&q=80', available: true },
  { name: 'Spicy Crispy Chicken', category: 'Burgers', price: 7.49, description: 'Crispy fried chicken with spicy mayo and pickles', image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=300&q=80', available: true },

  { name: 'French Fries', category: 'Sides', price: 2.49, description: 'Golden crispy fries, seasoned to perfection', image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&q=80', available: true },
  { name: 'Onion Rings', category: 'Sides', price: 2.99, description: 'Battered and deep-fried golden onion rings', image: 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=300&q=80', available: true },
  { name: 'Coleslaw', category: 'Sides', price: 1.99, description: 'Creamy homestyle coleslaw', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&q=80', available: true },
  { name: 'Chicken Nuggets (6pc)', category: 'Sides', price: 3.99, description: 'Crispy golden nuggets with dipping sauce', image: 'https://images.unsplash.com/photo-1562802378-063ec186a863?w=300&q=80', available: true },

  { name: 'Cola', category: 'Drinks', price: 1.49, description: 'Refreshing cola — regular or diet', image: 'https://images.unsplash.com/photo-1581098365948-6a5a912b7a49?w=300&q=80', available: true },
  { name: 'Lemonade', category: 'Drinks', price: 1.99, description: 'Freshly squeezed lemonade', image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=300&q=80', available: true },
  { name: 'Milkshake', category: 'Drinks', price: 3.99, description: 'Thick creamy milkshake — chocolate, vanilla, or strawberry', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&q=80', available: true },
  { name: 'Water', category: 'Drinks', price: 0.99, description: 'Still mineral water', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&q=80', available: true },

  { name: 'Burger Combo', category: 'Combos', price: 9.99, description: 'Classic Burger + Fries + Cola', image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=300&q=80', available: true },
  { name: 'Chicken Combo', category: 'Combos', price: 10.99, description: 'Spicy Crispy Chicken + Fries + Lemonade', image: 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=300&q=80', available: true },

  { name: 'Chocolate Brownie', category: 'Desserts', price: 2.99, description: 'Warm fudgy chocolate brownie', image: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=300&q=80', available: true },
  { name: 'Ice Cream Cup', category: 'Desserts', price: 1.99, description: 'Vanilla soft serve ice cream', image: 'https://images.unsplash.com/photo-1567206563114-c179706c315a?w=300&q=80', available: true },
];

const inventoryItems = [
  { itemName: 'Burger Buns', unit: 'pcs', quantity: 150, minThreshold: 50 },
  { itemName: 'Beef Patties', unit: 'pcs', quantity: 18, minThreshold: 30 },
  { itemName: 'Chicken Fillets', unit: 'pcs', quantity: 40, minThreshold: 20 },
  { itemName: 'Potatoes (Fries)', unit: 'kg', quantity: 5, minThreshold: 10 },
  { itemName: 'Cooking Oil', unit: 'L', quantity: 25, minThreshold: 5 },
  { itemName: 'Cheese Slices', unit: 'pcs', quantity: 80, minThreshold: 40 },
  { itemName: 'Lettuce', unit: 'kg', quantity: 3, minThreshold: 2 },
  { itemName: 'Tomatoes', unit: 'kg', quantity: 4, minThreshold: 3 },
  { itemName: 'Cola Syrup', unit: 'L', quantity: 20, minThreshold: 10 },
  { itemName: 'Milkshake Mix', unit: 'kg', quantity: 8, minThreshold: 5 },
  { itemName: 'Napkins', unit: 'packs', quantity: 30, minThreshold: 10 },
  { itemName: 'Take-out Boxes', unit: 'pcs', quantity: 200, minThreshold: 50 },
];

const seed = async () => {
  try {
    await connectDB();

    await User.deleteMany({});
    await MenuItem.deleteMany({});
    await Inventory.deleteMany({});
    await Category.deleteMany({});

    const createdUsers = await User.create(users);
    console.log(`Seeded ${createdUsers.length} users`);

    const createdMenu = await MenuItem.create(menuItems);
    console.log(`Seeded ${createdMenu.length} menu items`);

    const createdInventory = await Inventory.create(inventoryItems);
    console.log(`Seeded ${createdInventory.length} inventory items`);

    const defaultCategories = ['Burgers', 'Sides', 'Drinks', 'Combos', 'Desserts', 'Other'];
    const createdCategories = await Category.create(defaultCategories.map(name => ({ name })));
    console.log(`Seeded ${createdCategories.length} categories`);

    console.log('\n--- Default Login Credentials ---');
    console.log('Manager:  manager@pos.com  / manager123');
    console.log('Cashier:  cashier@pos.com  / cashier123');
    console.log('Kitchen:  kitchen@pos.com  / kitchen123');
    console.log('---------------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
