require('dotenv').config({ path: 'apps/pos/server/.env' });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Store = mongoose.model('Store', new mongoose.Schema({}, { strict: false }), 'stores');
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');

  const usersCount = await User.countDocuments();
  console.log('Users count:', usersCount);
  if (usersCount > 0) {
    const oneUser = await User.findOne();
    console.log('Sample User:', JSON.stringify(oneUser, null, 2));
  }

  const storesCount = await Store.countDocuments();
  console.log('Stores count:', storesCount);
  if (storesCount > 0) {
    const oneStore = await Store.findOne();
    console.log('Sample Store:', JSON.stringify(oneStore, null, 2));
  }

  const tenantsCount = await Tenant.countDocuments();
  console.log('Tenants count:', tenantsCount);
  if (tenantsCount > 0) {
    const oneTenant = await Tenant.findOne();
    console.log('Sample Tenant:', JSON.stringify(oneTenant, null, 2));
  }

  process.exit(0);
}
check().catch(console.error);
