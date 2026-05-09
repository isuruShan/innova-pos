/**
 * Migration: Add tenantId to all existing documents
 *
 * This script should be run ONCE on an existing single-tenant database
 * to prepare it for the multi-tenant architecture.
 *
 * It:
 * 1. Creates a default Tenant document for the existing data
 * 2. Backfills all existing documents with that tenantId
 * 3. Updates the User.role for the first manager found to 'merchant_admin'
 * 4. Fixes the Order.orderNumber unique constraint (removes global unique index)
 *
 * Usage (from repo root, after `pnpm install`):
 *   pnpm migrate:tenant
 * Or:
 *   node ./scripts/migrate-add-tenantid.js
 * Loads MONGO_URI from apps/pos/server/.env by default.
 */

require('dotenv').config({ path: `${__dirname}/../apps/pos/server/.env` });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pos_fastfood';

const tenantSchema = new mongoose.Schema({
  slug: String,
  businessName: String,
  status: { type: String, default: 'active' },
  subscriptionStatus: { type: String, default: 'active' },
  trialEndsAt: Date,
  adminCount: { type: Number, default: 1 },
  settings: {
    primaryColor: { type: String, default: '#1a1a2e' },
    accentColor: { type: String, default: '#e94560' },
    logoUrl: { type: String, default: '' },
    logoKey: { type: String, default: '' },
    paymentMethods: { type: [String], default: ['cash'] },
  },
  createdAt: Date,
  updatedAt: Date,
});

async function run() {
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db;

  // Step 1 — Create default tenant
  const Tenant = mongoose.model('Tenant', tenantSchema);
  let tenant = await Tenant.findOne({ slug: 'default' });

  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'default',
      businessName: 'Default Business',
      status: 'active',
      subscriptionStatus: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created default tenant: ${tenant._id}`);
  } else {
    console.log(`Using existing default tenant: ${tenant._id}`);
  }

  const tenantId = tenant._id;

  // Step 2 — Backfill all collections
  const collections = [
    'menuitem', 'menuitems',
    'order', 'orders',
    'inventory', 'inventories',
    'supplier', 'suppliers',
    'category', 'categories',
    'promotion', 'promotions',
    'settings',
    'user', 'users',
  ];

  const existingCollections = await db.listCollections().toArray();
  const existingNames = existingCollections.map(c => c.name.toLowerCase());

  for (const collName of collections) {
    if (!existingNames.includes(collName)) continue;
    const coll = db.collection(collName);
    const result = await coll.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId } }
    );
    if (result.modifiedCount > 0) {
      console.log(`  ${collName}: backfilled ${result.modifiedCount} documents with tenantId`);
    } else {
      console.log(`  ${collName}: no documents needed backfill`);
    }
  }

  // Step 3 — Update User roles: add isActive, isTemporaryPassword
  const usersResult = await db.collection('users').updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true, isTemporaryPassword: false } }
  );
  console.log(`\nUsers: set isActive=true on ${usersResult.modifiedCount} users`);

  // Step 4 — Fix Settings: remove old singleton field
  await db.collection('settings').updateMany(
    { singleton: { $exists: true } },
    { $unset: { singleton: '' } }
  );
  console.log('Settings: removed legacy singleton field');

  // Step 5 — Drop the old global unique index on orders.orderNumber if it exists
  try {
    const ordersColl = db.collection('orders');
    const indexes = await ordersColl.indexes();
    const globalOrderNumIdx = indexes.find(
      idx => idx.key && idx.key.orderNumber === 1 && !idx.key.tenantId
    );
    if (globalOrderNumIdx) {
      await ordersColl.dropIndex(globalOrderNumIdx.name);
      console.log('Orders: dropped global orderNumber unique index');
    }
  } catch (err) {
    console.log('Orders: could not drop old index (may not exist):', err.message);
  }

  console.log('\nMigration complete!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
