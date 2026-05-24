'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const assert = require('assert');

// Stub mail transporter before requiring mailer
const mailTransport = require('@innovapos/mail-transport');
let capturedEmails = [];
mailTransport.getMailTransporter = () => ({
  sendMail: async (options) => {
    capturedEmails.push(options);
    return { messageId: 'mock-id' };
  }
});

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const PaymentReceipt = require('../models/PaymentReceipt');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const { buildCreateUserPayload } = require('../lib/userLicenseCheckout');
const { computeSubscriptionRenewalExpected } = require('../lib/addonBilling');
const { sendWelcomeEmail } = require('../utils/mailer');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/innovapos';

async function run() {
  console.log(`Connecting to: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('Connected to database.');

  // Find or create test tenant
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
  }

  let tenant = await Tenant.findOne({ slug: 'performance-test' });
  if (!tenant) {
    tenant = await Tenant.create({
      slug: 'performance-test',
      businessName: 'Performance Test POS',
      status: 'active',
      subscriptionStatus: 'active',
      assignedPlanId: plan._id,
      countryIso: 'LK',
    });
  }

  // Clean database collections for our test domain
  await User.deleteMany({ tenantId: tenant._id });
  await PaymentReceipt.deleteMany({ tenantId: tenant._id });

  console.log('\n--- Test 1: Welcome Email Customization based on Role ---');
  capturedEmails = [];
  
  // Test merchant admin welcome email context
  await sendWelcomeEmail({
    to: 'admin@testpos.com',
    name: 'Admin User',
    tempPassword: 'pass123admin',
    loginUrl: 'http://localhost:5174',
    role: 'merchant_admin'
  });
  
  assert.strictEqual(capturedEmails.length, 1);
  const adminEmail = capturedEmails[0];
  assert.ok(adminEmail.subject.includes('Welcome to Cafinity'));
  assert.ok(adminEmail.html.includes('Your merchant account has been verified'));
  assert.ok(adminEmail.html.includes('30-Day Free Trial')); // Merchant admins get the trial panel
  assert.ok(adminEmail.html.includes('Access Admin Portal'));

  // Test cashier/staff welcome email context
  await sendWelcomeEmail({
    to: 'cashier@testpos.com',
    name: 'Cashier User',
    tempPassword: 'pass123cashier',
    loginUrl: 'http://localhost:5173',
    role: 'cashier'
  });

  assert.strictEqual(capturedEmails.length, 2);
  const cashierEmail = capturedEmails[1];
  assert.ok(cashierEmail.subject.includes('Welcome to the Team'));
  assert.ok(cashierEmail.html.includes('Your administrator has created a Cafinity account'));
  assert.ok(!cashierEmail.html.includes('30-Day Free Trial')); // Staff should not get the trial panel
  assert.ok(cashierEmail.html.includes('Log In to POS'));

  console.log('✅ Role-based welcome email assertions passed.');


  console.log('\n--- Test 2: System-wide Email Validation ---');
  
  // Create an active user in the system
  const activeEmail = 'active_user@example.com';
  await User.create({
    tenantId: tenant._id,
    name: 'Active User',
    email: activeEmail,
    password: 'password123',
    role: 'cashier',
    isActive: true,
  });

  // Create a pending receipt requesting user creation
  const pendingEmail = 'pending_user@example.com';
  await PaymentReceipt.create({
    tenantId: tenant._id,
    receiptKind: 'user_license',
    userLicenseAction: 'create_user',
    status: 'pending',
    userLicensePayload: {
      email: pendingEmail,
      name: 'Pending User',
      role: 'cashier'
    },
    amount: 250,
    currency: 'LKR',
    bankReference: 'REF123',
    paymentDate: new Date(),
  });

  // Try checking out with active user email
  try {
    await buildCreateUserPayload(tenant._id, { name: 'New Cashier', email: activeEmail, role: 'cashier' }, new mongoose.Types.ObjectId());
    assert.fail('Should have failed because email is in use by active user');
  } catch (err) {
    assert.strictEqual(err.message, 'Email already in use');
    console.log('✅ Active user email conflict rejected correctly.');
  }

  // Try checking out with pending approval email
  try {
    await buildCreateUserPayload(tenant._id, { name: 'New Cashier', email: pendingEmail, role: 'cashier' }, new mongoose.Types.ObjectId());
    assert.fail('Should have failed because email is in a pending receipt');
  } catch (err) {
    assert.strictEqual(err.message, 'A user creation request for this email is already pending approval');
    console.log('✅ Pending receipt email conflict rejected correctly.');
  }

  // Verify that a fresh unregistered email is allowed
  const freshEmail = 'fresh_user@example.com';
  const freshPayload = await buildCreateUserPayload(tenant._id, { name: 'Fresh User', email: freshEmail, role: 'cashier' }, new mongoose.Types.ObjectId());
  assert.ok(freshPayload);
  assert.strictEqual(freshPayload.payload.email, freshEmail);
  console.log('✅ Unused/fresh email accepted correctly.');


  console.log('\n--- Test 3: Deactivated / Inactive User Billing ---');
  
  // Clean all users for billing test
  await User.deleteMany({ tenantId: tenant._id });

  // Create 1 admin (free) and 1 deactivated cashier
  await User.create({
    tenantId: tenant._id,
    name: 'Merchant Admin',
    email: 'admin@billingtest.com',
    password: 'password123',
    role: 'merchant_admin',
    isActive: true,
  });

  await User.create({
    tenantId: tenant._id,
    name: 'Inactive Cashier',
    email: 'inactive@billingtest.com',
    password: 'password123',
    role: 'cashier',
    isActive: false, // DEACTIVATED
  });

  // Run computeSubscriptionRenewalExpected
  const breakdown = await computeSubscriptionRenewalExpected(tenant);
  console.log('Breakdown summary with 1 active admin and 1 inactive cashier:');
  console.log(JSON.stringify(breakdown, null, 2));

  // Assert that the inactive user was counted and billed
  const cashierDetail = breakdown.usersDetail.find(u => u.email === 'inactive@billingtest.com');
  assert.ok(cashierDetail, 'Deactivated user should be present in billing details');
  assert.strictEqual(cashierDetail.isFree, false);
  console.log('✅ Deactivated/Inactive users are included in subscription renewal calculations.');


  // Clean up
  await User.deleteMany({ tenantId: tenant._id });
  await PaymentReceipt.deleteMany({ tenantId: tenant._id });
  console.log('\nCleaned up test data.');
  await mongoose.disconnect();
  console.log('Disconnected. All tests completed successfully!');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
