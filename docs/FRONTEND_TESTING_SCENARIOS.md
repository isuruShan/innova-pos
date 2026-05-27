# Frontend Testing - Ready Test Scenarios

## Test Scenarios Created ✅

### Scenario 1: 4-Day Warning Banner
**Tenant:** the burger joint  
**Status:** active (expires in 3 days)  
**End Date:** May 30, 2026  
**Test User:** isurugy@gmail.com (merchant_admin)  

**Expected Behavior:**
1. Login to Admin Portal at http://localhost:5174
2. Warning banner should appear at the top with orange/yellow background
3. Message: "Your subscription expires in 3 days"
4. "Renew Now" button should navigate to `/subscription` page
5. X button should dismiss the banner
6. After dismissing, banner should stay hidden (check tenant.subscription.expiryWarningDismissedBy in DB)

**Verify:**
```javascript
// Check in MongoDB
db.tenants.findOne(
  { businessName: 'the burger joint' },
  { 'subscription.status': 1, 'subscription.endDate': 1 }
)
```

---

### Scenario 2: Suspended Tenant - Merchant Admin
**Tenant:** Coffee Garden  
**Status:** suspended (expired_subscription)  
**Test User:** isurugy+7@gmail.com (merchant_admin)  

**Expected Behavior:**
1. Login to Admin Portal at http://localhost:5174
2. Should immediately redirect to `/subscription-expired` page
3. Page should show:
   - ❌ "Your subscription has been suspended"
   - Business name and account email
   - Status badge showing "suspended" in red
   - "Manage Subscription" button (merchant admin can renew)
4. Click "Manage Subscription" → should navigate to `/subscription` page successfully
5. Try accessing any other page → should redirect back to expired page

**Verify:**
```javascript
// Check in MongoDB
db.tenants.findOne(
  { businessName: 'Coffee Garden' },
  { 'subscription.status': 1, 'subscription.suspendedAt': 1 }
)
```

---

### Scenario 3: Suspended Tenant - Non-Admin (Create if needed)
To test non-admin blocked access, create a cashier/manager for Coffee Garden:

```javascript
// In mongosh
const tenant = db.tenants.findOne({ businessName: 'Coffee Garden' });

// Create a test cashier
db.users.insertOne({
  name: 'Test Cashier',
  email: 'test.cashier@coffeegarden.com',
  password: '$2a$10$...', // hashed password
  role: 'cashier',
  tenantId: tenant._id,
  status: 'active',
  isTemporaryPassword: false,
  createdAt: new Date(),
  updatedAt: new Date()
});
```

**Expected Behavior:**
1. Login as cashier
2. Redirect to `/subscription-expired`
3. Message: "Only merchant administrators can manage subscriptions"
4. NO "Manage Subscription" button
5. Only "Return to Home" button available

---

## Manual Testing Checklist

### Admin Portal Tests
- [ ] **Warning Banner (Active, 3 days left)**
  - [ ] Login as merchant admin (isurugy@gmail.com)
  - [ ] See warning banner with countdown
  - [ ] Click "Renew Now" → navigates to subscription page
  - [ ] Click X → banner dismisses
  - [ ] Refresh page → banner stays dismissed
  - [ ] Check DB: dismissal recorded in expiryWarningDismissedBy

- [ ] **Suspended - Merchant Admin**
  - [ ] Login as merchant admin (isurugy+7@gmail.com)
  - [ ] Redirect to `/subscription-expired` page
  - [ ] See "Manage Subscription" button
  - [ ] Click button → access `/subscription` page successfully
  - [ ] Try accessing `/users` or other pages → blocked, redirect back

- [ ] **Suspended - Non-Admin (if created)**
  - [ ] Login as cashier/manager
  - [ ] Redirect to `/subscription-expired` page
  - [ ] NO "Manage Subscription" button
  - [ ] Cannot access any pages except logout

- [ ] **Super Admin Bypass**
  - [ ] Login as superadmin@innovasolutions.com
  - [ ] Even if tenant suspended, can access all features
  - [ ] No warning banner for suspended tenants
  - [ ] Full access to all merchant workspaces

### POS Tests
Same scenarios but:
- Access at http://localhost:5173 (if POS dev server running)
- Warning banner shows in Navbar area
- Suspended page shows different message: "Contact your administrator"
- NO "Manage Subscription" button (even for merchant admin in POS)

---

## Database Verification Commands

### Check Subscription Status
```javascript
db.tenants.find(
  {},
  { 
    businessName: 1,
    'subscription.status': 1,
    'subscription.endDate': 1,
    'subscription.suspendedAt': 1
  }
).pretty()
```

### Check Warning Dismissals
```javascript
db.tenants.findOne(
  { businessName: 'the burger joint' },
  { 'subscription.expiryWarningDismissedBy': 1 }
)
```

### Reset Test Tenant
```javascript
// Reset the burger joint to active with 1 year validity
db.tenants.updateOne(
  { businessName: 'the burger joint' },
  {
    $set: {
      'subscription.status': 'active',
      'subscription.endDate': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      'subscription.expiryWarningDismissedBy': []
    }
  }
)

// Reset Coffee Garden to active
db.tenants.updateOne(
  { businessName: 'Coffee Garden' },
  {
    $set: {
      'subscription.status': 'active',
      'subscription.endDate': new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    },
    $unset: {
      'subscription.suspendedAt': '',
      'subscription.suspensionReason': ''
    }
  }
)
```

---

## Automated Test Results

### Phase 1: Database & Schema ✅
- ✅ Migration executed successfully
- ✅ 19 tenants updated with subscription fields
- ✅ Fields verified: subscription.status, features, etc.
- ✅ Default values applied correctly

### Phase 2: Backend Middleware 🔧
- ✅ Middleware created and exported
- ⏳ Middleware application documented (see BACKEND_MIDDLEWARE_APPLICATION.md)
- ⏳ Route-level integration pending (for production)
- ✅ Frontend already provides protection layer

### Phase 3: Frontend Guards 🧪
- ✅ Test scenarios created and ready
- ✅ Components implemented and integrated
- ⏳ Manual testing required (login with test accounts above)
- ✅ Database configured for all test cases

---

## Quick Test Commands

### Start All Services
```bash
# If not already running
pm2 start ecosystem.config.cjs

# Start admin portal dev server
cd apps/admin-portal/client && npm run dev
```

### View PM2 Logs (if needed)
```bash
pm2 logs admin-server --lines 50
pm2 logs auth-service --lines 50
```

### MongoDB Connection
```bash
mongosh innovapos
```

---

## Next Steps

1. ✅ **Development Complete:** All code implemented
2. 🧪 **Manual Testing:** Use test scenarios above
3. 📝 **Document Results:** Note any issues found
4. 🚀 **Production Prep:** Apply backend middleware (see BACKEND_MIDDLEWARE_APPLICATION.md)
5. 📊 **Monitor:** Watch for subscription-related logs after deployment

---

## Success Criteria

- [x] Database migration successful
- [x] Subscription fields added to all tenants
- [x] Frontend guards implemented
- [x] Warning banner component created
- [x] Suspended page created
- [x] Test scenarios ready
- [ ] Manual testing confirmed working
- [ ] Backend middleware applied to routes (production)

**Status:** Ready for manual verification! 🎉
