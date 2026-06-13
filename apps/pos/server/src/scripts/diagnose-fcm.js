/**
 * Firebase Push Notification Diagnostic Script
 * -----------------------------------------------
 * Run from the server directory:
 *   node src/scripts/diagnose-fcm.js [userId]
 *
 * If a userId is given, it will also attempt to send a real test push to that user.
 */
'use strict';

require('dotenv').config();

async function main() {
  // ─── 1. Load secrets from Key Vault / Secrets Manager ───────────────────────
  console.log('\n=== [1] Loading runtime secrets ===');
  try {
    const { loadSecretsEnvOrExit } = require('@innovapos/runtime-env');
    await loadSecretsEnvOrExit();
    console.log('✔ Secrets loaded into process.env');
  } catch (e) {
    console.error('✘ Failed to load secrets:', e.message);
    process.exit(1);
  }

  // ─── 2. Check Firebase credentials ──────────────────────────────────────────
  console.log('\n=== [2] Checking Firebase credentials ===');
  const projectId    = process.env.FIREBASE_PROJECT_ID;
  const clientEmail  = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey   = process.env.FIREBASE_PRIVATE_KEY;

  const rows = [
    { key: 'FIREBASE_PROJECT_ID',   value: projectId },
    { key: 'FIREBASE_CLIENT_EMAIL', value: clientEmail },
    { key: 'FIREBASE_PRIVATE_KEY',  value: privateKey },
  ];

  let allPresent = true;
  for (const row of rows) {
    if (row.value) {
      // For the private key, show a truncated safe preview
      const preview = row.key === 'FIREBASE_PRIVATE_KEY'
        ? row.value.replace(/\\n/g, '\n').substring(0, 60).replace(/\n/g, '\\n') + '...'
        : row.value;
      console.log(`  ✔ ${row.key} = "${preview}"`);
    } else {
      console.log(`  ✘ ${row.key} — MISSING`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    console.error('\n✘ One or more Firebase credentials are missing. Push notifications will not work.');
    console.error('  Make sure these keys exist in your Key Vault / Secrets Manager and the server can reach it.');
    process.exit(1);
  }

  // ─── 3. Validate private key format ─────────────────────────────────────────
  console.log('\n=== [3] Validating private key format ===');
  const formattedKey = privateKey.replace(/\\n/g, '\n');
  if (formattedKey.startsWith('-----BEGIN')) {
    console.log('  ✔ Private key starts with PEM header — looks valid.');
  } else {
    console.error('  ✘ Private key does NOT start with a PEM header!');
    console.error('    Make sure the secret value is the raw PEM content (not double-escaped).');
    console.error(`    First 80 chars: "${formattedKey.substring(0, 80)}"`);
  }

  // ─── 4. Initialise Firebase Admin and verify credentials ────────────────────
  console.log('\n=== [4] Initialising Firebase Admin SDK ===');
  let admin;
  try {
    admin = require('firebase-admin');
    if (admin.apps.length > 0) {
      console.log('  ✔ Reusing existing Firebase Admin app instance.');
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey: formattedKey }),
      });
      console.log('  ✔ Firebase Admin SDK initialised successfully.');
    }
  } catch (e) {
    console.error('  ✘ Firebase Admin initializeApp failed:', e.message);
    process.exit(1);
  }

  // ─── 5. Validate token access by checking the messaging service ──────────────
  console.log('\n=== [5] Verifying FCM messaging service access ===');
  try {
    // Send a dry-run multicast to a dummy token — this validates credentials
    // without actually delivering a message
    const dryRunResult = await admin.messaging().sendEachForMulticast({
      tokens: ['dry-run-invalid-token-for-credential-check'],
      notification: { title: 'Credential check', body: 'Dry run test' },
    });
    // Firebase responds with registration-token-not-registered for an invalid token
    // but if credentials are wrong we'd get an auth error instead
    const firstError = dryRunResult.responses[0]?.error;
    if (firstError && firstError.code !== 'messaging/registration-token-not-registered'
        && firstError.code !== 'messaging/invalid-registration-token') {
      console.error(`  ✘ Unexpected error from FCM: ${firstError.code} — ${firstError.message}`);
    } else {
      console.log('  ✔ FCM credentials are valid and service is reachable (dry-run token rejected as expected).');
    }
  } catch (e) {
    console.error('  ✘ FCM messaging call failed:', e.message);
    process.exit(1);
  }

  // ─── 6. Optional: send a real notification to a userId ──────────────────────
  const targetUserId = process.argv[2];
  if (targetUserId) {
    console.log(`\n=== [6] Sending test notification to userId: ${targetUserId} ===`);
    const mongoose = require('mongoose');
    const connectDB = require('../config/db');
    await connectDB(console);

    const User = require('../models/User');
    const user = await User.findById(targetUserId).select('_id name fcmTokens').lean();

    if (!user) {
      console.error(`  ✘ No user found with ID: ${targetUserId}`);
    } else {
      console.log(`  User: "${user.name || '(unnamed)'}", FCM tokens: ${user.fcmTokens?.length || 0}`);
      if (!user.fcmTokens?.length) {
        console.warn('  ✘ This user has no registered FCM tokens — the mobile app must call POST /api/users/push-token after login.');
      } else {
        const result = await admin.messaging().sendEachForMulticast({
          tokens: user.fcmTokens,
          notification: { title: '🔔 FCM Diagnostic Test', body: 'If you see this, push notifications are working!' },
          data: { type: 'diagnostic', ts: String(Date.now()) },
        });
        console.log(`  FCM result: successCount=${result.successCount}, failureCount=${result.failureCount}`);
        result.responses.forEach((r, i) => {
          if (r.success) {
            console.log(`    Token #${i}: ✔ delivered`);
          } else {
            console.error(`    Token #${i}: ✘ ${r.error?.code} — ${r.error?.message}`);
          }
        });
      }
    }
    await mongoose.disconnect();
  } else {
    console.log('\n  ℹ️  To also test delivery to a real user, pass their userId as an argument:');
    console.log('     node src/scripts/diagnose-fcm.js <userId>');
  }

  console.log('\n=== Diagnostic complete ===\n');
  process.exit(0);
}

main().catch(e => {
  console.error('\n[FATAL]', e.message, e.stack);
  process.exit(1);
});
