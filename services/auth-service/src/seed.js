/**
 * Seed script: creates the superadmin user if none exists (same `users` collection
 * as admin-portal and POS — MongoDB must match your deployed apps).
 *
 * Usage (from repo root or auth-service):
 *   pnpm --filter @services/auth-service exec node src/seed.js
 *   cd services/auth-service && node src/seed.js
 *
 * Env (optional overrides — defaults shown):
 *   SUPERADMIN_EMAIL     default superadmin@innovasolutions.com
 *   SUPERADMIN_PASSWORD  default Admin@1234 (min 8 chars; change after first login)
 *   SUPERADMIN_NAME      default Super Admin
 *
 * Requires MONGO_URI (or MONGODB_URI / MONGODB_ATLAS_URI), from .env or AWS Secrets Manager.
 */

const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const { loadEnvForScripts } = require('./lib/load-env-for-scripts');
const User = require('./models/User');

async function seed() {
  await loadEnvForScripts();

  const uri = getMongoConnectionString({ fallback: 'mongodb://127.0.0.1:27017/innovapos' });
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  try {
    const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@innovasolutions.com').toLowerCase().trim();
    const password = process.env.SUPERADMIN_PASSWORD || 'Admin@1234';
    const name = process.env.SUPERADMIN_NAME || 'Super Admin';

    if (password.length < 8) {
      throw new Error('SUPERADMIN_PASSWORD must be at least 8 characters');
    }

    const existingByRole = await User.findOne({ role: 'superadmin' });
    if (existingByRole) {
      console.log(`Superadmin already exists: ${existingByRole.email} (id ${existingByRole._id})`);
      console.log('To remove and recreate, run: node src/remove-super-admin.js --help');
      return;
    }

    const taken = await User.findOne({ email });
    if (taken) {
      throw new Error(
        `Email ${email} is already used by a user with role "${taken.role}". ` +
          'Pick another SUPERADMIN_EMAIL or delete/rename that user first.',
      );
    }

    const superadmin = await User.create({
      name,
      email,
      password,
      role: 'superadmin',
      tenantId: null,
      isTemporaryPassword: true,
    });
    console.log(`Superadmin created: ${superadmin.email}`);
    console.log('Temporary password was set from SUPERADMIN_PASSWORD (default Admin@1234).');
    console.log('IMPORTANT: Change this password after first login!');
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
