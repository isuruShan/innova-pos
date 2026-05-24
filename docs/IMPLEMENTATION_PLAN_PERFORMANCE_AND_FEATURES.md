# Implementation Plan — Performance Optimization, Store Address Splitting, and Feature Enhancements

**Date:** May 24, 2026  
**Author:** Development Team

---

## Table of Contents

1. [Performance Optimization: N+1 Presigning Fix](#1-performance-optimization-n1-presigning-fix)
2. [Store Address Splitting (Already Complete)](#2-store-address-splitting)
3. [Store Code Removal & Auto-Generation](#3-store-code-removal--auto-generation)
4. [Detailed Cost Breakdown Display](#4-detailed-cost-breakdown-display)
5. [Welcome Email Role-Based Content](#5-welcome-email-role-based-content)
6. [User Email Duplicate Verification](#6-user-email-duplicate-verification)
7. [Billing Inactive Users](#7-billing-inactive-users)
8. [Subscription Billing History Tabs](#8-subscription-billing-history-tabs)
9. [Next Subscription Date Highlight](#9-next-subscription-date-highlight)
10. [Force Password Reset on First Login](#10-force-password-reset-on-first-login)
11. [Remove Proration Explanation Line](#11-remove-proration-explanation-line)
12. [Menu Item Delete Confirmation Dialog](#12-menu-item-delete-confirmation-dialog)

---

## 1. Performance Optimization: N+1 Presigning Fix

### Problem
The pending approvals page is slow due to individual HTTP calls for S3 presigning in `attachFreshReceiptUrls`. While the function already uses `Promise.all`, the upload-service presign endpoint only accepts single keys, causing N network round-trips.

### Current Implementation
```javascript
// apps/admin-portal/server/src/routes/subscriptions.js
async function attachFreshReceiptUrls(receipts) {
  const keys = [...new Set(receipts.map((r) => r.receiptFileKey).filter(Boolean))];
  if (!keys.length) return receipts;
  const pairs = await Promise.all(keys.map(async (key) => [key, await presignObjectKey(key, 86400)]));
  // ...
}
```

### Solution
**Option A: Batch Presigning Endpoint (Recommended)**

1. **Add batch endpoint to upload-service:**
```javascript
// services/upload-service/src/routes/upload.js
router.post('/presign-batch', authenticateServiceKey, async (req, res) => {
  const { keys, expiresIn = 86400 } = req.body;
  if (!Array.isArray(keys) || !keys.length) {
    return res.status(400).json({ message: 'keys array required' });
  }
  const results = {};
  await Promise.all(keys.map(async (key) => {
    try {
      results[key] = await presignKey(key, expiresIn);
    } catch { results[key] = null; }
  }));
  res.json({ urls: results });
});
```

2. **Update s3Runtime utility:**
```javascript
// apps/admin-portal/server/src/utils/s3Runtime.js
async function presignObjectKeys(keys, expiresIn = 86400) {
  if (!keys?.length || !INTERNAL_SERVICE_KEY) return {};
  try {
    const { data } = await axios.post(
      `${UPLOAD_SERVICE_URL}/upload/presign-batch`,
      { keys, expiresIn },
      { headers: { 'x-service-key': INTERNAL_SERVICE_KEY }, timeout: 30000 }
    );
    return data?.urls || {};
  } catch { return {}; }
}
```

3. **Update attachFreshReceiptUrls:**
```javascript
async function attachFreshReceiptUrls(receipts) {
  if (!receipts?.length) return receipts;
  const keys = [...new Set(receipts.map((r) => r.receiptFileKey).filter(Boolean))];
  if (!keys.length) return receipts;
  const urls = await presignObjectKeys(keys, 86400); // Single batch call
  return receipts.map((r) => (r.receiptFileKey && urls[r.receiptFileKey]
    ? { ...r, receiptFileUrl: urls[r.receiptFileKey] }
    : r));
}
```

### Files to Modify
- `services/upload-service/src/routes/upload.js`
- `apps/admin-portal/server/src/utils/s3Runtime.js`
- `apps/pos/server/src/utils/s3Runtime.js` (same pattern)

### Estimated Time: 2 hours

---

## 2. Store Address Splitting

### Status: ✅ ALREADY IMPLEMENTED

The Store model already uses the split address structure:
```javascript
address: {
  type: mongoose.Schema.Types.Mixed,
  default: () => ({
    street1: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  }),
}
```

UIs in `StoresPage.jsx`, `StoreCreateDrawer.jsx`, and `MerchantWorkspacePage.jsx` already have the split address fields.

### No Action Required

---

## 3. Store Code Removal & Auto-Generation

### Problem
Store code inputs appear in UI but should be auto-generated. City should display in listings instead.

### Solution

#### 3.1 Backend Changes

**Already have auto-generation in `storeProvisioning.js`:**
```javascript
async function allocateStoreCode(tenantId, cityTrim, slug) {
  const base = deriveStoreCodeBase(cityTrim, slug);
  // Auto-allocates unique code
}
```

Ensure all store creation routes use auto-generation when code is empty.

#### 3.2 UI Changes

**Files to modify:**
1. `apps/admin-portal/client/src/pages/admin/StoresPage.jsx`
   - Remove "Store Code" column from table headers
   - Show city instead of code in listings
   - Remove code input from edit form

2. `apps/admin-portal/client/src/components/superadmin/StoreCreateDrawer.jsx`
   - Remove code input field

3. `apps/admin-portal/client/src/pages/superadmin/MerchantWorkspacePage.jsx`
   - Remove code display/input
   - Show city in store cards

4. `apps/pos/client/src/pages/manager/Settings.jsx` (if applicable)
   - Remove code from store list

#### 3.3 Display Changes

**In store listings, replace:**
```jsx
// Before
<td>{store.code}</td>

// After
<td>{store.address?.city || '—'}</td>
```

### Estimated Time: 3 hours

---

## 4. Detailed Cost Breakdown Display

### Problem
Payment approvals and history need detailed breakdowns showing users, stores, base costs, and prorations.

### Current State
`BillingBreakdownPanel.jsx` already exists with user/store detail expansion.

### Solution

#### 4.1 Enhance Backend Response

Ensure `computeSubscriptionRenewalExpected` returns detailed breakdown:
```javascript
// apps/admin-portal/server/src/lib/subscriptionBilling.js
async function computeSubscriptionRenewalExpected(tenant) {
  return {
    plan: { name, amount },
    addons: [...],
    storesDetail: [
      { name: 'Main Branch', code: 'COL01', city: 'Colombo', cost: 0, isFree: true },
      { name: 'Kandy Branch', code: 'KAN01', city: 'Kandy', cost: 2500, isFree: false },
    ],
    usersDetail: [
      { name: 'John Admin', email: '...', role: 'merchant_admin', cost: 0, isFree: true },
      { name: 'Jane Manager', email: '...', role: 'manager', cost: 1500, isFree: false, extraStoreSlots: 2, extraStoreSlotsCost: 500 },
    ],
    total,
    currency,
  };
}
```

#### 4.2 Payment Receipt Detail Modal

Add breakdown display to `PaymentReceiptDetailModal.jsx`:
```jsx
{receipt.paymentBreakdown && (
  <BillingBreakdownPanel breakdown={receipt.paymentBreakdown} />
)}
```

### Estimated Time: 4 hours

---

## 5. Welcome Email Role-Based Content

### Problem
Welcome emails contain trial/business-ownership text that shouldn't go to staff users.

### Solution

#### 5.1 Update `sendWelcomeEmail` function

**File:** `services/auth-service/src/utils/mailer.js` and `apps/admin-portal/server/src/utils/mailer.js`

```javascript
const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl, role }) => {
  const isOwner = role === 'merchant_admin';
  const isStaff = ['manager', 'cashier', 'kitchen'].includes(role);
  
  const heading = isOwner 
    ? 'Welcome to Cafinity! 🎉' 
    : `You've been added to a Cafinity team! 🎉`;
  
  const intro = isOwner
    ? 'Congratulations! Your merchant account has been verified and is now active. You can start using Cafinity to manage your café or restaurant right away.'
    : `Your administrator has created an account for you. Use the credentials below to log in and start using the ${role.replace('_', ' ')} dashboard.`;

  // Build email without trial text for staff
  const html = `
    ${emailHeading(heading, isOwner ? 'Your account is ready to use' : 'Your login credentials')}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph(intro)}
    ${emailPanel(`...credentials panel...`)}
    ${emailAlert('<strong>Security Notice:</strong> Please change your password immediately after your first login.', 'warning')}
    ${emailButton(loginUrl, '🔒 Login to Your Account')}
  `;
  await sendEmail({ to, subject: heading, html });
};
```

#### 5.2 Update all call sites to pass `role`:
- `fulfillCreateUser()` in `userLicenseFulfill.js`
- `POST /users` route
- Application approval flow

### Estimated Time: 2 hours

---

## 6. User Email Duplicate Verification

### Problem
New user emails should be checked against both active users AND pending `PaymentReceipt` documents of type `user_license` (`create_user`).

### Solution

**File:** `apps/admin-portal/server/src/routes/users.js`

```javascript
// In POST /users route, after email format validation:
const emailLower = email.toLowerCase().trim();

// Check active users
const exists = await User.findOne({ email: emailLower });
if (exists) return res.status(400).json({ message: 'Email already in use' });

// Check pending user license receipts
const pendingReceipt = await PaymentReceipt.findOne({
  receiptKind: 'user_license',
  userLicenseAction: 'create_user',
  status: 'pending',
  'userLicensePayload.email': emailLower,
});
if (pendingReceipt) {
  return res.status(400).json({ 
    message: 'A user creation request for this email is already pending approval' 
  });
}
```

### Already Partially Implemented
The check exists in the code — verify it's in all relevant routes.

### Estimated Time: 1 hour

---

## 7. Billing Inactive Users

### Problem
Inactive users should still be counted in billing until they are permanently deleted from the database.

### Current State
Need to verify `computeSubscriptionRenewalExpected` and user license billing logic.

### Solution

**File:** `apps/admin-portal/server/src/lib/subscriptionBilling.js`

Change user query from:
```javascript
const users = await User.find({ tenantId, isActive: true });
```

To:
```javascript
// Include all users (active and inactive) for billing
// Only permanently deleted users (removed from DB) are excluded
const users = await User.find({ tenantId });
```

Add UI indication for inactive users in breakdown:
```javascript
usersDetail: users.map(u => ({
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive, // <-- Add this
  cost: calculateUserCost(u),
  isFree: isFirstAdmin(u),
}))
```

**UI Display in `BillingBreakdownPanel.jsx`:**
```jsx
{!u.isActive && (
  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
    Inactive — billed until removed
  </span>
)}
```

### Estimated Time: 2 hours

---

## 8. Subscription Billing History Tabs

### Status: ✅ ALREADY IMPLEMENTED

`SubscriptionPage.jsx` already has:
```javascript
const [paymentsSubTab, setPaymentsSubTab] = useState('addons'); // 'addons' or 'periodic'
```

And displays:
- "Add-ons & User Licenses" tab
- "Periodic Subscription Payments" tab with Billing Period as first column

### No Action Required (verify UI matches requirements)

---

## 9. Next Subscription Date Highlight

### Problem
Display current billing period prominently and show warning banner for upcoming renewal.

### Solution

**File:** `apps/admin-portal/client/src/pages/admin/SubscriptionPage.jsx`

Add warning banner in overview tab:
```jsx
{latestSubscription && tenant.subscriptionStatus === 'active' && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
    <div>
      <p className="font-semibold text-amber-900 text-sm">
        Next billing date: {new Date(latestSubscription.endDate).toLocaleDateString('en-GB', { 
          day: 'numeric', month: 'long', year: 'numeric' 
        })}
      </p>
      <p className="text-xs text-amber-700 mt-1">
        Please submit payment before this date to avoid service interruption.
      </p>
    </div>
  </div>
)}
```

### Estimated Time: 1 hour

---

## 10. Force Password Reset on First Login

### Problem
Users logging in with system-generated temporary passwords must be forced to create their own password before accessing the application.

### Solution

#### 10.1 Backend: Already Tracks `isTemporaryPassword`

The User model already has:
```javascript
isTemporaryPassword: { type: Boolean, default: false }
```

And auth routes already include it in the JWT payload.

#### 10.2 Frontend: Add Password Reset Gate

**Create new component:**
```jsx
// apps/admin-portal/client/src/components/auth/ForcePasswordResetGate.jsx
// apps/pos/client/src/components/auth/ForcePasswordResetGate.jsx

export default function ForcePasswordResetGate({ children }) {
  const { user, updateUserLocally } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user?.isTemporaryPassword) return children;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.put('/auth/me', { currentPassword, newPassword });
      updateUserLocally(data.user);
      localStorage.setItem('token', data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Set Your New Password</h1>
        <p className="text-sm text-gray-600 mb-6">
          You're using a temporary password. For security, please create your own password to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current (Temporary) Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-brand-orange text-white rounded-lg font-semibold"
          >
            {loading ? 'Updating...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 10.3 Wrap App with Gate

**Admin Portal:** `apps/admin-portal/client/src/App.jsx`
```jsx
<AuthProvider>
  <ForcePasswordResetGate>
    <RouterProvider router={router} />
  </ForcePasswordResetGate>
</AuthProvider>
```

**POS:** `apps/pos/client/src/App.jsx`
```jsx
<AuthProvider>
  <ForcePasswordResetGate>
    <RouterProvider router={router} />
  </ForcePasswordResetGate>
</AuthProvider>
```

### Estimated Time: 3 hours

---

## 11. Remove Proration Explanation Line

### Problem
Remove the line: `"|Each line: (monthly price ÷ 30) × 30 days left in your current subscription (ends 23 May 2026). on your subscription"` from user subscription activation detail popup.

### Solution

**File:** `apps/admin-portal/client/src/components/billing/ProrationBreakdown.jsx`

Locate and remove or simplify the proration formula display. The current code shows:
```jsx
<p className="text-xs text-blue-700/90 font-mono bg-white/60 rounded px-2 py-1.5">
  ({formatMoney(cur, monthly, merchantSymbol)} ÷ {daysPerMonth} days) × {remainingDays} days
  remaining = {formatMoney(cur, due, merchantSymbol)}
</p>
```

**Option A:** Remove formula entirely, keep simple explanation
**Option B:** Simplify to just show the amount due without the calculation breakdown

```jsx
// Replace complex formula with simple text
<p className="text-xs text-blue-800/80">
  Prorated for {remainingDays} remaining days in your billing cycle.
</p>
```

### Estimated Time: 30 minutes

---

## 12. Menu Item Delete Confirmation Dialog

### Problem
Menu item deletion uses `confirm('Delete this item?')` browser dialog. Need a proper modal with context about what the user is losing.

### Solution

**File:** `apps/pos/client/src/pages/manager/MenuManagement.jsx`

#### 12.1 Add State for Delete Confirmation
```jsx
const [deleteTarget, setDeleteTarget] = useState(null);
```

#### 12.2 Create Confirmation Modal
```jsx
<ConfirmDialog
  open={Boolean(deleteTarget)}
  variant="delete"
  title="Delete Menu Item?"
  message={
    deleteTarget ? (
      <div className="space-y-3">
        <p>
          You are about to permanently delete <strong>{deleteTarget.name}</strong> 
          from your menu.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2 text-sm">
          <p className="font-semibold text-red-800">This action will:</p>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            <li>Remove the item from cashier ordering screens</li>
            <li>Break any combos that include this item</li>
            <li>Remove the item from QR ordering menus</li>
            <li>Delete all variant configurations</li>
            {deleteTarget.isCombo && (
              <li>Remove the combo bundle (individual items remain)</li>
            )}
          </ul>
        </div>
        <p className="text-gray-500 text-xs">
          Historical order data referencing this item will be preserved.
        </p>
      </div>
    ) : ''
  }
  confirmLabel="Delete Permanently"
  isLoading={deleteMutation.isPending}
  onConfirm={() => {
    deleteMutation.mutate(deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }}
  onCancel={() => setDeleteTarget(null)}
/>
```

#### 12.3 Update Delete Button
```jsx
// Change from:
<button onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(item._id); }}>

// To:
<button onClick={() => setDeleteTarget(item)}>
```

### Estimated Time: 2 hours

---

## Implementation Priority & Timeline

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 1 | N+1 Presigning Fix | 🔴 High | 2h | None |
| 10 | Force Password Reset | 🔴 High | 3h | None |
| 3 | Store Code Removal | 🟡 Medium | 3h | None |
| 5 | Welcome Email Roles | 🟡 Medium | 2h | None |
| 6 | Email Duplicate Check | 🟡 Medium | 1h | None |
| 7 | Billing Inactive Users | 🟡 Medium | 2h | None |
| 12 | Menu Delete Confirmation | 🟡 Medium | 2h | None |
| 11 | Remove Proration Line | 🟢 Low | 0.5h | None |
| 9 | Next Subscription Highlight | 🟢 Low | 1h | None |
| 4 | Detailed Cost Breakdown | 🟢 Low | 4h | #7 |
| 2 | Store Address Splitting | ✅ Done | — | — |
| 8 | Billing History Tabs | ✅ Done | — | — |

**Total Estimated Time:** ~20.5 hours (2-3 days)

---

## Testing Checklist

- [ ] Verify N+1 fix reduces API calls (check network tab)
- [ ] Confirm store codes auto-generate on creation
- [ ] Verify city displays in store listings
- [ ] Test welcome emails for different roles
- [ ] Test duplicate email prevention for pending receipts
- [ ] Verify inactive users appear in billing breakdown
- [ ] Test forced password reset flow in both portals
- [ ] Verify proration explanation line is removed
- [ ] Test menu item delete confirmation shows proper context
- [ ] Verify next subscription date warning displays

---

## Rollback Plan

All changes are additive and can be reverted by:
1. Reverting commits
2. No database migrations required
3. No breaking API changes

---

*Document maintained by Development Team*
