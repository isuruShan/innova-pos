# Backend Middleware Application Guide

## Status: Middleware Created ✅ | Application Pending ⏳

The `subscriptionCheck` middleware has been created and exported from `@innovapos/shared-middleware`, but it needs to be applied to routes for full functionality.

## Where to Apply

### Admin Portal Server (`apps/admin-portal/server/src/index.js`)

#### Option 1: Global Application (Recommended for Production)
```javascript
const {
  subscriptionCheck,
  allowSubscriptionPageAccess,
  requireTenantServiceWhenInactive,
} = require('@innovapos/shared-middleware');

// Replace or augment existing middleware
app.use('/api', attachUserIfToken, subscriptionCheck);

// Exception routes that should skip subscription check:
// - /api/auth/* (authentication)
// - /api/applications/* (super admin)
// - /api/tenants/* (super admin)
// - /api/migrations/* (super admin)  
// - /api/subscriptions/* (with allowSubscriptionPageAccess)
```

#### Option 2: Route-Level Application (For Gradual Rollout)
Apply to specific protected routes:
```javascript
const { subscriptionCheck } = require('@innovapos/shared-middleware');

// Example: Apply to users route
app.use('/api/users', subscriptionCheck, require('./routes/users'));
app.use('/api/stores', subscriptionCheck, require('./routes/stores'));
app.use('/api/analytics', subscriptionCheck, require('./routes/analytics'));
// ... apply to other protected routes
```

### POS Server (`apps/pos/server/src/index.js`)

Same pattern as Admin Portal:
```javascript
const { subscriptionCheck } = require('@innovapos/shared-middleware');

// Global or route-level application
app.use('/api', attachUserIfToken, subscriptionCheck);

// All POS routes should be protected except:
// - /api/auth/*
// - /api/subscription/* (for dismissing banner)
```

## Testing the Middleware Logic

To test without applying globally:

### Test 1: Middleware Function Test
```javascript
// Test file: test-subscription-middleware.js
const { subscriptionCheck } = require('@innovapos/shared-middleware');

const mockRequest = {
  user: { id: '123', role: 'cashier', tenantId: 'tenant-id' },
  tenant: { subscription: { status: 'suspended' } }
};

const mockResponse = {
  status: (code) => ({
    json: (data) => {
      console.log('Response:', code, data);
      return data;
    }
  })
};

const mockNext = () => console.log('Next called');

subscriptionCheck(mockRequest, mockResponse, mockNext);
// Expected: 403 with subscription_required error
```

### Test 2: Super Admin Bypass
```javascript
const mockRequest = {
  user: { id: '123', role: 'superadmin', tenantId: 'tenant-id' },
  tenant: { subscription: { status: 'suspended' } }
};

subscriptionCheck(mockRequest, mockResponse, mockNext);
// Expected: Next called (no blocking)
```

### Test 3: Merchant Admin Exception
```javascript
const mockRequest = {
  user: { id: '123', role: 'merchantadmin', tenantId: 'tenant-id' },
  tenant: { subscription: { status: 'suspended' } },
  path: '/api/subscription/renew'
};

subscriptionCheck(mockRequest, mockResponse, mockNext);
// Expected: Next called (allowed to access subscription endpoints)
```

## Current Status

✅ **Phase 1:** Database schema updated (19 tenants migrated)  
⏳ **Phase 2:** Backend middleware created but not applied to routes  
✅ **Phase 3 (Partial):** Frontend guards implemented and integrated  

## Next Steps for Production

1. **Test in Development:**
   - Apply middleware to one route and test
   - Verify super admin bypass works
   - Verify merchant admin exception works
   - Test all user roles with suspended tenant

2. **Gradual Rollout:**
   - Apply to non-critical routes first
   - Monitor logs for unexpected blocks
   - Expand to all protected routes

3. **Full Deployment:**
   - Apply globally with proper exceptions
   - Update documentation
   - Train support team on subscription management

## Notes

- The frontend guards are **already active** and will redirect users to `/subscription-expired` page
- Backend middleware is an **additional security layer** to prevent API bypass
- Super admins always have full access (for support purposes)
- Merchant admins can access subscription management even when suspended
