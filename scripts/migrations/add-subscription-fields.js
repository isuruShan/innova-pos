/**
 * Migration: Add subscription fields to Tenant model
 * 
 * This migration adds:
 * - subscription.status (active, trial, suspended, past_due, cancelled)
 * - subscription.plan, dates, billing cycle
 * - subscription.suspendedAt, suspensionReason, autoSuspended
 * - subscription.expiryWarningShownAt, expiryWarningDismissedBy (for banner tracking)
 * - features object (maxUsers, maxLocations, etc.)
 * 
 * Safe to run multiple times - only updates tenants that don't have these fields.
 * 
 * Usage:
 *   node scripts/migrations/add-subscription-fields.js
 *   OR use Super Admin migration UI
 */

const mongoose = require('mongoose');
const { loadSecretsEnv } = require('@innovapos/runtime-env');

// Import Tenant model from auth-service
const Tenant = require('../../services/auth-service/src/models/Tenant');

async function runMigration() {
  try {
    console.log('🔄 Starting subscription fields migration...\n');
    
    // Load environment
    await loadSecretsEnv();
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find tenants without subscription.status field
    const tenantsToUpdate = await Tenant.find({
      $or: [
        { 'subscription.status': { $exists: false } },
        { 'features': { $exists: false } }
      ]
    });
    
    console.log(`📊 Found ${tenantsToUpdate.length} tenants to update\n`);
    
    if (tenantsToUpdate.length === 0) {
      console.log('✨ All tenants already have subscription fields. Migration not needed.');
      return { success: true, tenantsUpdated: 0, message: 'No updates needed' };
    }
    
    let updated = 0;
    let errors = 0;
    
    for (const tenant of tenantsToUpdate) {
      try {
        // Set default subscription fields (all existing tenants get 1 year active subscription)
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        // Only set if doesn't exist
        if (!tenant.subscription) {
          tenant.subscription = {};
        }
        
        if (!tenant.subscription.status) {
          tenant.subscription.status = 'active';
        }
        
        if (!tenant.subscription.plan) {
          tenant.subscription.plan = 'professional';
        }
        
        if (!tenant.subscription.startDate) {
          tenant.subscription.startDate = new Date();
        }
        
        if (!tenant.subscription.endDate) {
          tenant.subscription.endDate = oneYearFromNow;
        }
        
        if (!tenant.subscription.billingCycle) {
          tenant.subscription.billingCycle = 'annual';
        }
        
        if (!tenant.subscription.currency) {
          tenant.subscription.currency = 'USD';
        }
        
        if (tenant.subscription.autoRenew === undefined) {
          tenant.subscription.autoRenew = true;
        }
        
        if (tenant.subscription.amountDue === undefined) {
          tenant.subscription.amountDue = 0;
        }
        
        // Set feature flags if don't exist
        if (!tenant.features) {
          tenant.features = {
            maxUsers: 10,
            maxLocations: 1,
            analyticsEnabled: true,
            loyaltyEnabled: true,
            multiLocationEnabled: false,
            apiAccess: false
          };
        }
        
        await tenant.save();
        updated++;
        console.log(`  ✅ Updated: ${tenant.businessName || tenant._id}`);
      } catch (error) {
        errors++;
        console.error(`  ❌ Failed: ${tenant.businessName || tenant._id} - ${error.message}`);
      }
    }
    
    console.log(`\n📈 Migration Summary:`);
    console.log(`   - Total tenants checked: ${tenantsToUpdate.length}`);
    console.log(`   - Successfully updated: ${updated}`);
    console.log(`   - Errors: ${errors}`);
    console.log(`\n✅ Migration completed successfully!`);
    
    return {
      success: true,
      tenantsUpdated: updated,
      errors,
      message: `Updated ${updated} tenant(s)`
    };
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export for use in migration UI
module.exports = { runMigration };
