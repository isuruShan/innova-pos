require('dotenv').config();
const { sendPushNotification } = require('../lib/pushNotifier');
const User = require('../models/User');
const connectDB = require('../config/db');
const mongoose = require('mongoose');

const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
};

async function testPush() {
  console.log('Connecting to database...');
  await connectDB(logger);

  try {
    // 1. Fetch user to register token
    const testUser = await User.findOne();
    if (!testUser) {
      console.log('No user found to test with.');
      return;
    }

    const testToken = 'mock_token_' + Date.now();
    
    // Register token
    await User.findByIdAndUpdate(testUser._id, {
      $addToSet: { fcmTokens: testToken }
    });

    console.log(`Registered mock token: ${testToken} on user: ${testUser.name}`);

    // Send push notification
    await sendPushNotification(
      testUser._id,
      {
        title: 'Promotion Pending Review',
        body: 'A manager submitted a "Buy 1 Get 1 Free" promotion.',
        meta: {
          resourceType: 'promotion',
          resourceId: 'test_promo_id',
        }
      },
      logger
    );

    // Verify token remains (in fallback, no tokens are purged since failure is simulated only when credentials exist)
    const checkUser = await User.findById(testUser._id).lean();
    if (checkUser.fcmTokens.includes(testToken)) {
      console.log('SUCCESS: Mock FCM token registered and logged correctly.');
    } else {
      console.error('ERROR: Token missing from user!');
    }

    // Clean up
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { fcmTokens: testToken }
    });
    console.log('Cleaned up mock token.');

  } catch (err) {
    console.error('Push test failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('DB connection closed.');
  }
}

testPush();
