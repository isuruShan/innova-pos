/**
 * Seed script: Creates the superadmin user if it doesn't exist.
 *
 * Usage:
 *   cd services/auth-service
 *   node src/seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(
    getMongoConnectionString({ fallback: 'mongodb://127.0.0.1:27017/innovapos' }),
  );
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ role: 'superadmin' });
  if (existing) {
    console.log(`Superadmin already exists: ${existing.email}`);
  } else {
    const superadmin = await User.create({
      name: 'Super Admin',
      email: 'superadmin@innovasolutions.com',
      password: 'Admin@1234',
      role: 'superadmin',
      tenantId: null,
      isTemporaryPassword: true,
    });
    console.log(`Superadmin created: ${superadmin.email}`);
    console.log('Temporary password: Admin@1234');
    console.log('IMPORTANT: Change this password after first login!');
  }

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
