'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserLicensePricing = require('../models/UserLicensePricing');
const { ensureDefaultUserLicensePricing } = require('../lib/userLicensePricing');
const { computeSubscriptionRenewalExpected } = require('../lib/addonBilling');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/innovapos';

async function run() {
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.');

  // Ensure default plans and pricing exist
  await ensureDefaultUserLicensePricing();
  
  // Set up mock/default plan if none exists
  let plan = await SubscriptionPlan.findOne({ isActive: true });
  if (!plan) {
    plan = await SubscriptionPlan.create({
      name: 'Standard Monthly',
      code: 'standard_monthly',
      amount: 5000,
      currency: 'LKR',
      billingCycle: 'monthly',
      durationDays: 30,
      isActive: true,
      isDefault: true,
    });
    console.log(`Created default plan: ${plan.name}`);
  }

  // Find a tenant
  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'test-business',
      businessName: 'Test Business POS',
      status: 'active',
      subscriptionStatus: 'active',
      assignedPlanId: plan._id,
      countryIso: 'LK',
    });
    console.log(`Created test tenant: ${tenant.businessName}`);
  } else {
    // Make sure it has plan assigned
    if (!tenant.assignedPlanId) {
      tenant.assignedPlanId = plan._id;
      await tenant.save();
    }
  }

  // Clean existing users for clean run
  await User.deleteMany({ tenantId: tenant._id });

  // Create primary merchant admin
  const mainAdmin = await User.create({
    tenantId: tenant._id,
    name: 'Primary Admin',
    email: 'admin@testpos.com',
    password: 'password123',
    role: 'merchant_admin',
    isActive: true,
  });
  console.log(`Created primary admin: ${mainAdmin.name} (${mainAdmin.role})`);

  // Compute breakdown with 1 user
  let breakdown = await computeSubscriptionRenewalExpected(tenant);
  console.log('\n--- Breakdown with 1 user (Free included seat) ---');
  console.log(JSON.stringify(breakdown, null, 2));

  // Update default pricing amounts for cashier user seats so it's not 0
  const cashierPricing = await UserLicensePricing.findOne({ role: 'cashier' });
  if (cashierPricing) {
    cashierPricing.userSeatMonthlyAmount = 250;
    cashierPricing.userSeatYearlyAmount = 2400;
    cashierPricing.isActive = true;
    await cashierPricing.save();
  }

  // Create 2 cashier users
  const cashier1 = await User.create({
    tenantId: tenant._id,
    name: 'Cashier One',
    email: 'cashier1@testpos.com',
    password: 'password123',
    role: 'cashier',
    isActive: true,
  });
  const cashier2 = await User.create({
    tenantId: tenant._id,
    name: 'Cashier Two',
    email: 'cashier2@testpos.com',
    password: 'password123',
    role: 'cashier',
    isActive: true,
  });
  console.log(`Created 2 active cashiers.`);

  // Compute breakdown with 3 total active users (2 extra cashiers)
  breakdown = await computeSubscriptionRenewalExpected(tenant);
  console.log('\n--- Breakdown with 3 users (2 extra cashiers @ LKR 250/mo each) ---');
  console.log(JSON.stringify(breakdown, null, 2));

  // Update manager pricing so it's not 0
  const managerPricing = await UserLicensePricing.findOne({ role: 'manager' });
  if (managerPricing) {
    managerPricing.userSeatMonthlyAmount = 500;
    managerPricing.extraStoreMonthlyAmount = 300;
    managerPricing.isActive = true;
    await managerPricing.save();
  }

  // Create a manager with 3 licensed store slots (which means 2 extra stores)
  const manager = await User.create({
    tenantId: tenant._id,
    name: 'Manager Bob',
    email: 'bob@testpos.com',
    password: 'password123',
    role: 'manager',
    licensedStoreSlots: 3,
    isActive: true,
  });
  console.log(`Created active manager Bob with 3 licensed store slots.`);

  // Compute breakdown with Bob added
  breakdown = await computeSubscriptionRenewalExpected(tenant);
  console.log('\n--- Breakdown with Bob added (Manager Seat @ 500/mo + 2 Extra Stores @ 300/mo each) ---');
  console.log(JSON.stringify(breakdown, null, 2));

  // Clean up
  await User.deleteMany({ tenantId: tenant._id });
  console.log('\nCleaned up test users.');

  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch((err) => {
  console.error(err);
  mongoose.disconnect();
});
