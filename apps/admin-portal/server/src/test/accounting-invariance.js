'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');

console.log('Running double-entry invariance test...');

// 1. Test balanced journal entry validation
try {
  const balancedEntry = new JournalEntry({
    tenantId: new mongoose.Types.ObjectId(),
    date: new Date(),
    reference: 'Test Balanced',
    lines: [
      { accountId: new mongoose.Types.ObjectId(), debit: 150.50, credit: 0 },
      { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 150.50 }
    ]
  });

  const err = balancedEntry.validateSync();
  assert.strictEqual(err, undefined, 'Balanced entry should pass validation');
  console.log('✓ Balanced entry passed validation');
} catch (e) {
  console.error('FAIL: Balanced entry failed:', e.message);
  process.exit(1);
}

// 2. Test unbalanced journal entry validation (should fail)
try {
  const unbalancedEntry = new JournalEntry({
    tenantId: new mongoose.Types.ObjectId(),
    date: new Date(),
    reference: 'Test Unbalanced',
    lines: [
      { accountId: new mongoose.Types.ObjectId(), debit: 150.50, credit: 0 },
      { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 150.00 } // unbalanced
    ]
  });

  // Check the pre-save hook check
  // Note: pre-save save checks sumDebits - sumCredits in save middleware, which is triggered when calling validate() or save().
  // Wait, pre-save hooks only run on save(), but let's see if we can trigger the pre-save save middleware function manually or by invoking the pre hook function directly.
  const preSaveHooks = unbalancedEntry.schema.s.hooks._pres.get('save');
  let hookError;
  for (const h of preSaveHooks) {
    try {
      h.fn.call(unbalancedEntry, (err) => {
        if (err) hookError = err;
      });
    } catch (err) {
      hookError = err;
    }
  }

  assert.ok(hookError, 'Pre-save hook should fail on unbalanced credits/debits');
  assert.ok(hookError.message.includes('Double-entry check failed'), 'Error message should match Double-entry check failed');
  console.log('✓ Unbalanced entry correctly rejected by pre-save hook');
} catch (e) {
  console.error('FAIL: Unbalanced entry test failed:', e.stack);
  process.exit(1);
}

// 3. Test epsilon boundary check (tolerance <= 0.01)
try {
  const epsilonBalancedEntry = new JournalEntry({
    tenantId: new mongoose.Types.ObjectId(),
    date: new Date(),
    reference: 'Test Epsilon Balanced',
    lines: [
      { accountId: new mongoose.Types.ObjectId(), debit: 150.501, credit: 0 },
      { accountId: new mongoose.Types.ObjectId(), debit: 0, credit: 150.509 } // difference = 0.008 (<= 0.01)
    ]
  });

  const preSaveHooks = epsilonBalancedEntry.schema.s.hooks._pres.get('save');
  let hookError;
  for (const h of preSaveHooks) {
    try {
      h.fn.call(epsilonBalancedEntry, (err) => {
        if (err) hookError = err;
      });
    } catch (err) {
      hookError = err;
    }
  }
  assert.strictEqual(hookError, undefined, 'Epsilon within 0.01 should pass');
  console.log('✓ Epsilon check boundary <= 0.01 passed');
} catch (e) {
  console.error('FAIL: Epsilon check failed:', e.message);
  process.exit(1);
}

console.log('ALL TESTS PASSED SUCCESSFULLY!');
process.exit(0);
