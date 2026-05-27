# Subscription-Based Access Control Implementation Plan

**Objective:** Block access to POS and Admin Portal when subscription is expired/suspended, while allowing merchant admins restricted access to subscription payment page only.

---

## Requirements Summary

### When Subscription is Active (Status: `active`)
- ✅ All users can access POS and Admin Portal normally
- ✅ All features available

### When Subscription Expires → Immediate Suspension
- 🔄 **Automated Process**: When subscription `endDate` passes, system automatically suspends (no grace period)
- 📧 Merchant admins receive email notification about suspension
- ⚠️ **Pre-Expiration Warning**: Closable banner shown 4 days before expiry at every login (POS & Admin Portal)

### When Subscription is Suspended (Status: `suspended`, `expired`, `past_due`)
- ❌ **Regular users** (cashier, manager, staff) → Completely blocked from POS and Admin Portal
- ✅ **Merchant admins** → Can access ONLY the subscription/billing page in Admin Portal
- ❌ **Merchant admins** → Cannot access any other pages (dashboard, menu, orders, etc.)
- ✅ **Super admins** → Full access (for support purposes)

### Subscription States
- `active` - Subscription is active and valid
- `trial` - In trial period (new merchants)
- `suspended` - Subscription expired or manually suspended (no access except payment page for merchant admins)
- `past_due` - Auto-renewal payment failed, pending retry attempts
- `cancelled` - Merchant voluntarily cancelled subscription

**Note:** No grace period - suspension happens immediately when subscription expires.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  User Login                                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Auth Service - Check User + Tenant Subscription            │
│  - Returns: user role + subscription status                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
              ┌───────────┴───────────┐
              │                       │
    Subscription Active      Subscription Suspended/Expired
              │                       │
              ↓                       ↓
    ┌─────────────────┐    ┌──────────────────────────┐
    │ Full Access     │    │ Check User Role          │
    │ - All features  │    │                          │
    └─────────────────┘    └──────────────────────────┘
                                      ↓
                        ┌─────────────┴──────────────┐
                        │                            │
                 Super Admin               Merchant Admin / Others
                        │                            │
                        ↓                            ↓
            ┌────────────────────┐      ┌────────────────────────┐
            │ Full Access        │      │ Merchant Admin:        │
            │ (support override) │      │ → Subscription page    │
            └────────────────────┘      │ → Make payment         │
                                        │ → Reactivate account   │
                                        │                        │
                                        │ Others (cashier/staff):│
                                        │ → Blocked, show notice │
                                        └────────────────────────┘

Automated Suspension Flow:
┌────────────────┐   4 days before    ┌────────────────┐   Cron Job    ┌──────────────┐
│ Active         │   ─────────────►   │ Active         │  (Daily 2AM)  │ Suspended    │
│ subscription   │   Show warning     │ + Warning      │ ───────────►  │ immediate    │
│                │   banner (login)   │ banner shown   │   if expired  │ suspension   │
└────────────────┘                    └────────────────┘               └──────────────┘
                                                                               │
                                                                               │
                                                        Payment ───────────────┘
                                                           ↓
                                                    ┌──────────────┐
                                                    │ Active       │
                                                    │ reactivated  │
                                                    └──────────────┘
```

---

## Phase 1: Database Schema Updates

### 1.1 Add Subscription Status to Tenant Model

**File:** `/services/auth-service/src/models/Tenant.js` (or wherever Tenant is defined)

```javascript
const tenantSchema = new mongoose.Schema({
  businessName: String,
  contactEmail: String,
  // ... existing fields

  // Subscription fields
  subscription: {
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'past_due', 'cancelled'],
      default: 'trial',
      // Status flow: active → suspended (immediately when endDate passes, no grace period)
    },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      default: 'starter'
    },
    startDate: Date,
    endDate: Date,
    trialEndDate: Date,
    lastPaymentDate: Date,
    nextBillingDate: Date,
    autoRenew: { type: Boolean, default: true },
    
    // Warning banner tracking
    expiryWarningShownAt: Date, // Track when warning was first shown
    expiryWarningDismissedBy: [{ 
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      dismissedAt: Date 
    }], // Track which users dismissed the warning (resets daily)
    
    // Payment details
    amountDue: Number,
    currency: { type: String, default: 'USD' },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly'
    },

    // Suspension details
    suspendedAt: Date, // null if auto-suspended
    suspensionReason: {
      type: String,
      enum: ['payment_failure', 'expired_subscription', 'manual_suspension', 'policy_violation']
    },
    suspensionNotes: String,
    autoSuspended: { type: Boolean, default: false } // true if suspended by system, false if by adming,
    suspensionNotes: String
  },

  // Feature flags (can disable features based on plan)
  features: {
    maxUsers: { type: Number, default: 5 },
    maxLocations: { type: Number, default: 1 },
    analyticsEnabled: { type: Boolean, default: true },
    loyaltyEnabled: { type: Boolean, default: true },
    multiLocationEnabled: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

### 1.2 Migration Script

**File:** `/scripts/migrate-add-subscription-status.js`

```javascript
const mongoose = require('mongoose');
const Tenant = require('../services/auth-service/src/models/Tenant');
const { loadSecretsEnv } = require('@innovapos/runtime-env');

async function migrateSubscriptionStatus() {
  await loadSecretsEnv();
  await mongoose.connect(process.env.MONGO_URI);

  console.log('Adding subscription status to existing tenants...');

  const result = await Tenant.updateMany(
    { 'subscription.status': { $exists: false } },
    {
      $set: {
        'subscription.status': 'active', // Default existing tenants to active
        'subscription.plan': 'professional',
        'subscription.startDate': new Date(),
        'subscription.endDate': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        'subscription.autoRenew': true,
        'features.maxUsers': 10,
        'features.maxLocations': 1
      }
    }
  );

  console.log(`✅ Updated ${result.modifiedCount} tenants`);
  await mongoose.disconnect();
}

migrateSubscriptionStatus().catch(console.error);
```

---

## Phase 2: Backend Middleware

### 2.1 Subscription Check Middleware

**File:** `/packages/shared-middleware/src/subscriptionCheck.js`

```javascript
/**
 * Middleware to check tenant subscription status
 * Blocks access if subscription is expired/suspended (except for super admins)
 * 
 * Usage:
 *   router.get('/api/orders', protect, tenantScope, subscriptionCheck, getOrders);
 */

const subscriptionCheck = async (req, res, next) => {
  try {
    const user = req.user;
    const tenant = req.tenant;

    // Super admins can always access (for support)
    if (user.role === 'superad
      return next();
    }

    // Check subscription status
    const status = tenant.subscription?.status;
    const blockedStatuses = ['expired', 'suspended', 'past_due', 'cancelled'];

    if (blockedStatuses.includes(status)) {
      // Check if user is accessing subscription/billing endpoints
      const isSubscriptionEndpoint = 
        req.path.includes('/api/subscription') || 
        req.path.includes('/api/billing') ||
        req.path.includes('/api/payment');

      // Merchant admins can access subscription endpoints only
      if (user.role === 'merchantadmin' && isSubscriptionEndpoint) {
        return next();
      }

      // All other access is blocked
      return res.status(403).json({
        success: false,
        error: 'subscription_required',
        message: 'Your subscription has expired or been suspended. Please contact your administrator.',
        subscriptionStatus: status,
        canRenew: user.role === 'merchantadmin',
        renewUrl: user.role === 'merchantadmin' ? '/subscription' : null
      });
    }

    // Subscription is active
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    return res.status(500).json({
      success: false,
      error: 'subscription_check_failed',
      message: 'Unable to verify subscription status'
    });
  }
};

/**
 * Middleware specifically for merchant admin subscription page access
 * Allows access even when subscription is expired
 */
const allowSubscriptionPageAccess = (req, res, next) => {
  const user = req.user;
  
  // Only merchant admins and super admins can access
  if (!['merchantadmin', 'superadmin'].includes(user.role)) {
    return res.status(403).json({
      success: false,
      error: 'insufficient_permissions',
      message: 'Only administrators can manage subscriptions'
    });
  }

  next();
};

module.exports = { subscriptionCheck, allowSubscriptionPageAccess };
```

### 2.2 Apply Middleware to Routes

**POS Server Routes** - `/apps/pos/server/src/index.js`:

```javascript
const { subscriptionCheck } = require('@innovapos/shared-middleware');

// Apply to all API routes except auth
app.use('/api/orders', protect, tenantScope, subscriptionCheck, ordersRouter);
app.use('/api/menu', protect, tenantScope, subscriptionCheck, menuRouter);
app.use('/api/customers', protect, tenantScope, subscriptionCheck, customersRouter);
// ... other routes

// Subscription endpoints (merchant admins can access even when expired)
app.use('/api/subscription', protect, tenantScope, allowSubscriptionPageAccess, subscriptionRouter);
```

**Admin Portal Server Routes** - `/apps/admin-portal/server/src/index.js`:

```javascript
const { subscriptionCheck } = require('@innovapos/shared-middleware');

// Apply to all routes except subscription management
app.use('/api/analytics', protect, authorize('merchantadmin', 'manager'), tenantScope, subscriptionCheck, analyticsRouter);
app.use('/api/menu', protect, authorize('merchantadmin', 'manager'), tenantScope, subscriptionCheck, menuRouter);
// ... other routes

// Subscription page - allow merchant admins even when expired
app.use('/api/subscription', protect, authorize('merchantadmin', 'superadmin'), tenantScope, allowSubscriptionPageAccess, subscriptionRouter);
```

---

## Phase 3: Frontend Route Guards

### 3.1 POS Client - Route Guard

**File:** `/apps/pos/client/src/hooks/useSubscriptionGuard.js`

```javascript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function useSubscriptionGuard() {
  const navigate = useNavigate();
  const { user, tenant } = use

  useEffect(() => {
    if (!user || !tenant) return;

    const status = tenant.subscription?.status;
    const blockedStatuses = ['expired', 'suspended', 'past_due', 'cancelled'];

    if (blockedStatuses.includes(status)) {
      // Super admins can access everything
      if (user.role === 'superadmin') return;

      // All other users are blocked from POS
      navigate('/subscription-expired', { replace: true });
    }
  }, [user, tenant, navigate]);
}
```

**File:** `/apps/pos/client/src/pages/SubscriptionExpired.jsx`

```jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle } from 'lucide-react';

export default function SubscriptionExpired() {
  const { user, tenant, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Required
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your subscription has {tenant.subscription?.status === 'suspended' ? 'been suspended' : 'expired'}. 
          Please contact your administrator to renew.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="text-sm text-gray-700 space-y-1">
            <div><strong>Status:</strong> {tenant.subscription?.status}</div>
            {tenant.subscription?.endDate && (
              <div><strong>Expired:</strong> {new Date(tenant.subscription.endDate).toLocaleDateString()}</div>
            )}
          </div>
        </div>

        {user.role === 'merchantadmin' ? (
          <p className="text-sm text-blue-600 mb-4">
            As an administrator, please visit the Admin Portal to manage your subscription.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            Contact: {tenant.contactEmail}
          </p>
        )}

        <button
          onClick={logout}
          className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
```

**Update POS App.jsx:**

```javascript
// Add route
<Route path="/subscription-expired" element={<SubscriptionExpired />} />


### 3.3 Expiry Warning Banner Component (System-Wide)

**File:** `/packages/ui-components/src/ExpiryWarningBanner.jsx` (or in each app)

```javascript
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * System-wide expiry warning banner
 * Shows 4 days before subscription expires
 * Closable per user (resets daily)
 */
export default function ExpiryWarningBanner() {
  const { user, tenant, updateTenant } = useAuth();
  const [visible, setVisible] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    if (!tenant?.subscription) return;

    const sub = tenant.subscription;
    const now = new Date();
    const endDate = new Date(sub.endDate);
    const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    // Show banner if 4 days or less until expiry and subscription is active
    if (sub.status === 'active' && daysUntilExpiry <= 4 && daysUntilExpiry > 0) {
      setDaysLeft(daysUntilExpiry);

      // Check if current user dismissed the banner today
      const dismissals = sub.expiryWarningDismissedBy || [];
      const userDismissal = dismissals.find(d => 
        d.userId === user.id && 
        new Date(d.dismissedAt).toDateString() === now.toDateString()
      );

      // Show banner if not dismissed today
      setVisible(!userDismissal);
    } else {
      setVisible(false);
    }
  }, [tenant, user]);

  const handleDismiss = async () => {
    try {
      // Call API to track dismissal
      await fetch('/api/subscription/dismiss-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      setVisible(false);
    } catch (error) {
      console.error('Failed to dismiss warning:', error);
      setVisible(false); // Hide anyway for UX
    }
  };

  if (!visible) return null;

  return (
    <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">
              ⚠️ Your subscription expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Renew now to avoid service interruption. All access will be suspended after expiration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user.role === 'merchantadmin' && (
            <button
              onClick={() => window.location.href = '/subscription'}
              className="text-sm font-medium text-orange-900 hover:text-orange-800 underline whitespace-nowrap"
            >
              Renew Now
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-orange-600 hover:text-orange-800 p-1"
            aria-label="Dismiss warning"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Usage in POS App.jsx:**

```javascript
import ExpiryWarningBanner from './components/ExpiryWarningBanner';

function App() {
  return (
    <AuthProvider>
      <ExpiryWarningBanner /> {/* Show at top of app */}
      <Router>
        {/* routes */}
      </Router>
    </AuthProvider>
  );
}
```

**Usage in Admin Portal App.jsx:**

```javascript
import ExpiryWarningBanner from './components/ExpiryWarningBanner';

function App() {
  return (
    <AuthProvider>
      <ExpiryWarningBanner /> {/* Show at top of app */}
      <Router>
        {/* routes */}
      </Router>
    </AuthProvider>
  );
}
```
// Add guard to protected routes
function ProtectedRoute({ children }) {
  useSubscriptionGuard();
  return children;
}
```

### 3.2 Admin Portal - Route Guard with Subscription Page Exception

**File:** `/apps/admin-portal/client/src/hooks/useSubscriptionGuard.js`

```javascript
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function useSubscriptionGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant } = useAuth();

  useEffect(() => {
    if (!user || !tenant) return;

    const status = tenant.subscription?.status;
    const blockedStatuses = ['expired', 'suspended', 'past_due', 'cancelled'];

    if (blockedStatuses.includes(status)) {
      // Super admins can access everything
      if (user.role === 'superadmin') return;

      // Merchant admins can only access subscription page
      if (user.role === 'merchantadmin') {
        const allowedPaths = ['/subscription', '/subscription/payment', '/subscription/history'];
        const isOnAllowedPage = allowedPaths.some(path => location.pathname.startsWith(path));
        
        if (!isOnAllowedPage) {
          navigate('/subscription', { replace: true });
        }
        return;
      }

      // All other users (managers, staff) are completely blocked
      navigate('/subscription-expired', { replace: true });
    }
  }, [user, tenant, location.pathname, navigate]);
}
```

**File:** `/apps/admin-portal/client/src/pages/SubscriptionPage.jsx`

```jsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, CreditCard, Calendar, DollarSign } from 'lucide-react';

export default function SubscriptionPage() {
  const { tenant } = useAuth();
  const sub = tenant.subscription;

  const isBlocked = ['expired', 'suspended', 'past_due'].includes(sub?.status);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {isBlocked && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-orange-900">Subscription Required</h3>
            <p className="text-sm text-orange-700 mt-1">
              Your subscription has {sub.status === 'suspended' ? 'been suspended' : 'expired'}. 
              Please renew to restore access to all features.
            </p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-6">Subscription & Billing</h1>

      {/* Current Status Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Current Subscription</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block w-2 h-2 rounded-full ${
                sub.status === 'active' ? 'bg-green-500' :
                sub.status === 'trial' ? 'bg-blue-500' :
                'bg-red-500'
              }`} />
              <span className="font-medium capitalize">{sub.status}</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500">Plan</label>
            <div className="font-medium capitalize mt-1">{sub.plan}</div>
          </div>

          <div>
            <label className="text-sm text-gray-500">Billing Cycle</label>
            <div className="font-medium capitalize mt-1">{sub.billingCycle}</div>
          </div>

          <div>
            <label className="text-sm text-gray-500">Next Billing Date</label>
            <div className="font-medium mt-1">
              {sub.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>

          {sub.amountDue > 0 && (
            <div className="md:col-span-2">
              <label className="text-sm text-gray-500">Amount Due</label>
              <div className="text-2xl font-bold text-red-600 mt-1">
                ${sub.amountDue.toFixed(2)} {sub.currency}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Button */}
      {isBlocked && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Renew Subscription</h2>
          <p className="text-gray-600 mb-4">
            Make a payment to reactivate your subscription and restore access.
          </p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Pay ${sub.amountDue?.toFixed(2) || '0.00'}
          </button>
        </div>
      )}

      {/* Feature Limits */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Plan Features</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Max Users</span>
            <span className="font-medium">{tenant.features?.maxUsers || 'Unlimited'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Locations</span>
            <span className="font-medium">{tenant.features?.maxLocations || 'Unlimited'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Analytics</span>
            <span className="font-medium">{tenant.features?.analyticsEnabled ? '✓ Enabled' : '✗ Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Loyalty Program</span>
            <span className="font-medium">{tenant.features?.loyaltyEnabled ? '✓ Enabled' : '✗ Disabled'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 4: Auth Service Updates

### 4.1 Include Subscription in Token Payload

**File:** `/services/auth-service/src/controllers/authController.js`

```javascript
async function login(req, res) {
  // ... existing login logic

  // Include subscription status in token payload (or fetch on each request)
  const payload = {
    userId: user._id,
    tenantId: user.tenantId,
    role: user.role,
    subscriptionStatus: tenant.subscription?.status || 'active'
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    tenant: {
      id: tenant._id,
      businessName: tenant.businessName,
      subscription: tenant.subscription,
      features: tenant.features
    }
  });
}
```

### 4.2 Refresh Subscription Status on Each Request

**File:** `/packages/shared-middleware/src/tenantScope.js`

```javascript
// Update existing tenantScope middleware to include subscription
const tenantScope = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const tenant = await Tenant.findById(tenantId)
      .select('businessName contactEmail subscription features')
      .lean();

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load tenant' });
  }
};
```

---

## Phase 5: Subscription Management API

### 5.1 Subscription Routes

**File:** `/apps/admin-portal/server/src/routes/subscription.js`

```javascript
const express = require('express');
const router = express.Router();
// Dismiss expiry warning (track per-user dismissal)
router.post('/dismiss-warning', protect, tenantScope, async (req, res) => {
  try {
    const { userId } = req.body;
    const tenant = await Tenant.findById(req.tenant._id);
    
    if (!tenant.subscription.expiryWarningDismissedBy) {
      tenant.subscription.expiryWarningDismissedBy = [];
    }
    
    // Remove old dismissals for this user
    tenant.subscription.expiryWarningDismissedBy = tenant.subscription.expiryWarningDismissedBy.filter(
      d => d.userId.toString() !== userId
    );
    
    // Add new dismissal
    tenant.subscription.expiryWarningDismissedBy.push({
      userId,
      dismissedAt: new Date()
  await mongoose.connect(process.env.MONGO_URI);

  const now = new Date();
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  // 1. Find tenants with subscriptions expiring in 4 days (email warning)
  const expiringTenants = await Tenant.find({
    'subscription.status': 'active',
    'subscription.endDate': {
      $gte: now,
      $lte: fourDaysFromNow
    }
  });

  for (const tenant of expiringTenants) {
    const daysLeft = Math.ceil(
      (new Date(tenant.subscription.endDate) - now) / (1000 * 60 * 60 * 24)
    );
    console.log(`⚠️  Tenant ${tenant.businessName} subscription expires in ${daysLeft} days`);
    
    // Send email warning (once when 4 days or less)
    if (!tenant.subscription.expiryWarningShownAt || 
        new Date(tenant.subscription.expiryWarningShownAt).toDateString() !== now.toDateString()) {
      await sendExpirationWarningEmail(tenant, daysLeft);
      tenant.subscription.expiryWarningShownAt = now;
      await tenant.save();
    }
  }

  // 2. AUTO-SUSPEND: Find expired subscriptions → immediate suspension (NO GRACE PERIOD)
  const expiredTenants = await Tenant.find({
    'subscription.status': 'active',
    'subscription.endDate': { $lt: now }
  });

  for (const tenant of expiredTenants) {
    console.log(`🚫 AUTO-SUSPENDING ${tenant.businessName} - subscription expired (immediate)`);
    
    tenant.subscription.status = 'suspended';
    tenant.subscription.suspendedAt = now;
    tenant.subscription.suspendedBy = null; // null = auto-suspended by system
    tenant.subscription.suspensionReason = 'expired_subscription';
    tenant.subscription.autoSuspended = true;
    tenant.subscription.suspensionNotes = 'Automatically suspended - subscription expired';
    tenant.subscription.amountDue = calculateSubscriptionAmount(
      tenant.subscription.plan,
      tenant.subscription.billingCycle
    );
    
    await tenant.save();
    
    // Send suspension notification
    await sendAccountSuspendedEmail(tenant);
    
    // Log to audit trail
    await logAuditEvent({
      tenantId: tenant._id,
      action: 'tenant_auto_suspended',
      performedBy: 'system',
      reason: 'Subscription expired - immediate suspension',
      metadata: {
        subscriptionEndDate: tenant.subscription.endDate,
        amountDue: tenant.subscription.amountDue
      }
    });
  }

  // 3. Clean up old dismissal records (older than 7 days)
  await Tenant.updateMany(
    {
      'subscription.expiryWarningDismissedBy.dismissedAt': {
        $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      }
    },
    {
      $pull: {
        'subscription.expiryWarningDismissedBy': {
          dismissedAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        }
      }
    }
  );

  console.log(`
    ✅ Subscription Check Complete:
    - Expiring soon (≤4 days): ${expiringTenants.length}
    - Auto-suspended (expired today): ${expiredTenants.length}
  `);
  

// Super admin: Manually suspend subscription
router.post('/suspend', protect, authorize('superadmin'), tenantScope, async (req, res) => {
  try {
    const { reason, notes } = req.body;
    const tenant = await Tenant.findById(req.tenant._id);
    
    tenant.subscription.status = 'suspended';
    tenant.subscription.suspendedAt = new Date();
    tenant.subscription.suspendedBy = req.user._id;
    tenant.subscription.suspensionReason = reason || 'manual_suspension';
    tenant.subscription.suspensionNotes = notes;
    tenant.subscription.autoSuspended = false; // Manual suspension by admin
    
    await tenant.save();
    
    // Log audit event
    await logAuditEvent({
      tenantId: tenant._id,
      action: 'tenant_manually_suspended',
      performedBy: req.user._id,
      reason: notes
    });
    
    // Notify merchant admins
    await sendManualSuspensionEmail(tenant, req.user, reason);
    
    res.json({ success: true, message: 'Subscription suspended manually' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Super admin: Reactivate subscription
router.post('/reactivate', protect, authorize('superadmin'), tenantScope, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id);
    
    tenant.subscription.status = 'active';
    tenant.subscription.suspendedAt = null;
    tenant.subscription.suspendedBy = null;
    tenant.subscription.suspensionReason = null;
    
    await tenant.save();
    
    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

---

## Phase 6: Automated Subscription Monitoring

### 6.1 Cron Job to Check Expiring Subscriptions

**File:** `/scripts/check-subscription-status.js`

```javascript
const mongoose = require('mongoose');
const Tenant = require('../services/auth-service/src/models/Tenant');
const { loadSecretsEnv } = require('@innovapos/runtime-env');
const { sendEmail } = require('@innovapos/mail-transport');

async function checkSubscriptionStatus() {
  await loadSecretsEnv();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Find tenants with subscriptions expiring in 3 days (warning)
  const expiringTenants = await Tenant.find({
    'subscription.status': 'active',
    'subscription.endDate': {
      $gte: now,
      $lte: threeDaysFromNow // Past date
    'subscription.suspendedAt': new Date('2026-05-10'),
    'subscription.autoSuspended': true,
    'subscription.suspensionReason': 'expired_subscription'
  }}
)

# 6. Login as cashier → should be completely blocked from POS
# 7. Login as merchant admin → should only access /subscription page
# 8. Login as super admin → should have full access
# 9. Process payment as merchant admin
# 10. Verify subscription status changes from 'suspended' to 'active'
# 11. Login as cashier → should now have full access
# 12. Run cron job manually: node scripts/check-subscription-status.js
# 13. Verify immediate auto-suspension on expiry (no grace period)
    console.log(`⏰ Marking ${tenant.businessName} as expired (grace period starts)`);
    
    const gracePeriodEnd = new Date(tenant.subscription.endDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 days grace period
    
    tenant.subscription.status = 'expired';
    tenant.subscription.gracePeriodEndDate = gracePeriodEnd;
    tenant.subscription.amountDue = calculateSubscriptionAmount(
      tenant.subscription.plan,
      tenant.subscription.billingCycle
    );
    await tenant.save();
    
    await sendSubscriptionExpiredEmail(tenant);
  }

  // 3. AUTO-SUSPEND: Find expired subscriptions past grace period → suspend
  const tenantsToSuspend = await Tenant.find({
    'subscription.status': 'expired',
    'subscription.gracePeriodEndDate': { $lt: now }
  });

  for (const tenant of tenantsToSuspend) {
    console.log(`🚫 AUTO-SUSPENDING ${tenant.businessName} - grace period ended`);
    
    tenant.subscription.status = 'suspended';
    tenant.subscription.suspendedAt = now;
    tenant.subscription.suspendedBy = null; // null = auto-suspended by system
    tenant.subscription.suspensionReason = 'expired_subscription';
    tenant.subscription.autoSuspended = true;
    tenant.subscription.suspensionNotes = 'Automatically suspended after grace period ended';
    
    await tenant.save();
    
    // Send suspension notification
    await sendAccountSuspendedEmail(tenant);
    
    // Log to audit trail
    await logAuditEvent({
      tenantId: tenant._id,
      action: 'tenant_auto_suspended',
      performedBy: 'system',
      reason: 'Subscription expired and grace period ended',
      metadata: {
        subscriptionEndDate: tenant.subscription.endDate,
        gracePeriodEndDate: tenant.subscription.gracePeriodEndDate,
        amountDue: tenant.subscription.amountDue
      }
    });
  }

  // 4. Send daily reminders during grace period
  const gracePeriodTenants = await Tenant.find({
    'subscription.status': 'expired',
    'subscription.gracePeriodEndDate': { $gte: now }
  });

  for (const tenant of gracePeriodTenants) {
    const daysLeft = Math.ceil(
      (new Date(tenant.subscription.gracePeriodEndDate) - now) / (1000 * 60 * 60 * 24)
    );3-4 days

**Priority Order:**
1. Database schema updates (remove grace period fields, add banner tracking) (0.5 day)
2. Backend middleware for subscription checks (0.5 day)
3. Warning banner component (system-wide, closable) (1 day)
4. Frontend route guards (0.5 day)
5. Subscription management API with immediate suspension logic (0.5 day)
6. Automated suspension cron job (immediate suspension on expiry) (0.5 day)
7. Payment integration with auto-reactivation (1 day)
8. Email notification system (0.5 day)
9. Testing all scenarios (1 day)

**Business Logic:**
- ⚠️ **Warning Period**: 4 days before expiry, show closable banner at login
- 🚫 **Immediate Suspension**: No grace period - suspension happens immediately when subscription expires
- 📧 **Email Notifications**: Only at 4 days warning and on suspension
- 💳 **Self-Service**: Merchant admins can pay and reactivate without support
- 🔧 **Manual Override**: Super admins can suspend/reactivate for policy violations
- 🔄 **Banner Reset**: Dismissals reset daily, banner shows again at next day's first login
}

// Run with: node scripts/check-subscription-status.js
// Or add to crontab: 0 2 * * * cd /path/to/app && node scripts/check-subscription-status.js
checkSubscriptionStatus().catch(console.error);
```

### 6.2 Add to PM2 Ecosystem (Optional - Using PM2 Cron)

**File:** `ecosystem.config.cjs`

```javascript
{
  name: 'subscription-checker',
  script: './scripts/check-subscription-status.js',
  instances: 1,
  cron_restart: '0 2 * * *', // Run at 2 AM daily
  autorestart: false,
  env_production: {
    NODE_ENV: 'production',
    ...cloudEnv,
  },
}
```(Within Grace Period) - All Users**
- ⚠️ Users can still access but see warning banner
- 📧 Merchant admins receive daily email reminders
- ⏰ Grace period: 7 days

**Scenario 3: Auto-Suspended Subscription (After Grace Period) - Merchant Admin**
- ✅ Can access Admin Portal subscription page only
- ❌ Cannot access any other Admin Portal pages (redirected to /subscription)
- ❌ Cannot access POS at all
- 📧 Receives "Account Suspended" email

**Scenario 4: Auto-Suspended Subscription - Regular User (Cashier/Manager)**
- ❌ Cannot 6: Payment and Reactivation**
- ✅ Merchant admin pays on subscription page (even when suspended)
- ✅ Subscription status changes from "suspended" → "active"
- ✅ All users regain access immediately (within seconds)
- ✅ Suspension flags cleared automatically
- 📧 "Subscription Reactivated" confirmation email sent

**Scenario 7: Super Admin Override**
- ✅ Super admin can access everything regardless of subscription status
- ✅ Can manually reactivate suspended accounts without payment
- ✅ Can suspend accounts manually for policy violation
 (still in grace period)
mongo
use innovapos
db.tenants.updateOne(
  { businessName: 'Test Restaurant' },
  { $set: { 
    'subscription.status': 'expired',
    'subscription.endDate': new Date('2026-05-20'),
    'subscription.gracePeriodEndDate': new Date('2026-05-27')
  }}
)

# 2. Login as any user → should show warning banner but still have access

# 3. Create test tenant with suspended subscription (grace period ended)
db.tenants.updateOne(
  { businessName: 'Test Restaurant' },
  { $set: { 
    'subscription.status': 'suspended',
    'subscription.endDate': new Date('2026-05-10'),
    'subscription.gracePeriodEndDate': new Date('2026-05-17'),
    'subscription.suspendedAt': new Date('2026-05-17'),
    'subscription.autoSuspended': true,
    'subscription.suspensionReason': 'expired_subscription'
  }}
)

# 4. Login as cashier → should be completely blocked from POS
# 5. Login as merchant admin → should only access /subscription page
# 6. Login as super admin → should have full access
# 7. Process payment as merchant admin
# 8. Verify subscription status changes from 'suspended' to 'active'
# 9. Login as cashier → should now have full access
# 10. Run cron job manually: node scripts/check-subscription-status.js
# 11. Verify auto-suspension works correctly

**Scenario 6: Super Admin Override**
- ✅ Super admin can access everything regardless of subscription status

### 7.2 Manual Testing Steps

```bash
# 1. Create test tenant with expired subscription
mongo
use innovapos
db.tenants.updateOne(
  { businessName: 'Test Restaurant' },
  { $set: { 
    'subscription.status': 'expired',
    'subscription.endDate': new Date('2026-01-01')
  }}
)

# 2. Login as cashier → should be blocked from POS
# 3. Login as merchant admin → should only access /subscription page
# 4. Login as super admin → should have full access
# 5. Process payment as merchant admin
# 6. Verify subscription status changes to active
# 7. Login as cashier → should now have full access
```

---

## Phase 8: Deployment Checkli"Renewal Reminder" email
2. **3 days before expiry** - "Urgent: Subscription Expiring Soon" email
3. **On expiry day** - "Subscription Expired - Grace Period Started" email (7 days to pay)
4. **Daily during grace period** - "Payment Reminder: X days left" email
5. **On auto-suspension** - "⚠️ Account Suspended - Payment Required" email
6. **On manual suspension** - "Account Suspended by Administrator" email with reason
7. **On payment/renewal** - "✅ Subscription Reactivated" confirmation email

### Notification Recipients

- **Merchant Admins Only:** Receive all subscription-related emails
- **All Users:** See in-app notifications/banners
- **Super Admins:** Receive alert when tenant is auto-suspended (for monitoring)check
- [ ] Deploy auth service with subscription in token with grace period tracking
2. ✅ **Backend Middleware:** Check subscription on every API call (except subscription endpoints)
3. ✅ **Frontend Guards:** Redirect based on role and subscription status
4. ✅ **Exception for Merchant Admins:** Allow subscription page access even when suspended
5. ✅ **Payment Flow:** Restricted payment page that reactivates subscription automatically
6. ✅ **Automated Suspension:** Daily cron job that auto-suspends merchants after grace period
7. ✅ **Grace Period:** 7-day grace period after expiration before auto-suspension
8. ✅ **Email Notifications:** Comprehensive email flow from warning to suspension
9. ✅ **Super Admin Override:** Support access and manual suspension/reactivation
10. ✅ **Audit Trail:** Log all suspension/reactivation events

**Suspension Flow:**
```
Active → Expires → Grace Period (7 days) → Auto-Suspended → Payment → Reactivated
  ↑                                             ↓
  └─────────────────── Payment ────────────────┘
```

**Estimated Implementation Time:** 4-6 days

**Priority Order:**
1. Database schema with grace period fields (0.5 day)
2. Backend middleware for subscription checks (1 day)
3. Frontend route guards with grace period warnings (1 day)
4. Subscription management API with suspension logic (1 day)
5. Automated suspension cron job (1 day)
6. Payment integration with auto-reactivation (1-2 days)
7. Email notification system (0.5 day)
8. Testing all suspension scenarios (1 day)

**Business Logic:**
- ⏰ **Grace Period**: 7 days after expiration before suspension
- 📧 **Notifications**: Daily reminders during grace period
- 🚫 **Auto-Suspension**: System automatically suspends after grace period
- 💳 **Self-Service**: Merchant admins can pay and reactivate without support
- 🔧 **Manual Override**: Super admins can suspend/reactivate for policy violations
## Phase 9: Grace Period & Notifications

### Grace Period Logic

```javascript
// In subscription check middleware
const hasGracePeriod = tenant.subscription.gracePeriodEndDate && 
                       new Date() < new Date(tenant.subscription.gracePeriodEndDate);

if (hasGracePeriod) {
  // Allow access but show warning banner
  req.gracePeriodActive = true;
  return next();
}
```

### Email Notifications

1. **7 days before expiry** - Reminder email
2. **3 days before expiry** - Urgent reminder
3. **On expiry** - "Subscription expired" email
4. **Daily during grace period** - Payment reminder
5. **After grace period** - "Access suspended" email
6. **On renewal** - "Subscription activated" confirmation

---

## Summary

**Key Implementation Points:**

1. ✅ **Database:** Add subscription status to Tenant model
2. ✅ **Backend Middleware:** Check subscription on every API call (except subscription endpoints)
3. ✅ **Frontend Guards:** Redirect based on role and subscription status
4. ✅ **Exception for Merchant Admins:** Allow subscription page access when expired
5. ✅ **Payment Flow:** Restricted payment page that reactivates subscription
6. ✅ **Automated Monitoring:** Daily cron job to check and update subscription status
7. ✅ **Super Admin Override:** Support access regardless of subscription

**Estimated Implementation Time:** 3-5 days

**Priority Order:**
1. Database schema (0.5 day)
2. Backend middleware (1 day)
3. Frontend route guards (1 day)
4. Subscription management API (1 day)
5. Payment integration (1-2 days)
6. Cron job + notifications (0.5 day)
7. Testing (1 day)
