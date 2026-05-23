# Table Management Add-on Implementation Plan

> **Scope**: Transform table management into a paid add-on with 3 priority features:
> 1. Visual Floor Plan Editor
> 2. Reservations & Waitlist Management  
> 3. Table Turnover Analytics

---

## ✅ IMPLEMENTATION STATUS

| Phase | Component | Status |
|-------|-----------|--------|
| Phase 0 | Add-on Infrastructure | ✅ Complete |
| Phase 1 | Floor Plan Models & API | ✅ Complete |
| Phase 1 | Floor Plan UI | ✅ Complete |
| Phase 2 | Reservations Models & API | ✅ Complete |
| Phase 2 | Reservations UI | ✅ Complete |
| Phase 3 | Analytics Models & API | ✅ Complete |
| Phase 3 | Analytics UI | ✅ Complete |

### Files Created/Modified

**Backend (apps/pos/server/src/):**
- `models/FloorPlan.js` - Floor plan layout with table positions and zones
- `models/Reservation.js` - Guest reservations with status workflow
- `models/Waitlist.js` - Walk-in guest queue management
- `models/ReservationSettings.js` - Store-level reservation configuration
- `models/TableSession.js` - Analytics tracking for table occupancy
- `routes/floorPlan.js` - Floor plan CRUD and status overlay
- `routes/reservations.js` - Reservation management
- `routes/waitlist.js` - Waitlist queue management
- `routes/tableAnalytics.js` - Table analytics and KPIs
- `index.js` - Added route registrations

**Frontend (apps/pos/client/src/):**
- `pages/manager/FloorPlanEditorPage.jsx` - Drag-and-drop floor plan editor
- `pages/manager/FloorPlanViewPage.jsx` - Real-time floor plan view
- `pages/manager/ReservationsPage.jsx` - Reservation management
- `pages/manager/WaitlistPage.jsx` - Walk-in waitlist management
- `pages/manager/TableAnalyticsPage.jsx` - Analytics dashboard with KPIs
- `constants/managerLinks.js` - Added Table Management nav group
- `App.jsx` - Added route definitions

**Add-on Infrastructure:**
- `packages/paid-addons/src/index.js` - Added tableManagement entitlement
- `apps/admin-portal/server/src/lib/addonBilling.js` - Added table_management addon
- `apps/admin-portal/server/src/lib/addonPeriod.js` - Added expiry logic
- `apps/pos/server/src/routes/tenantAddons.js` - Returns tableManagement status
- `apps/pos/server/src/middleware/requirePaidAddon.js` - Added message
- `apps/pos/server/src/models/Tenant.js` - Added tableManagement schema
- `apps/admin-portal/server/src/models/Tenant.js` - Added tableManagement schema
- `apps/pos/server/src/models/CafeTable.js` - Added capacity field

---

## Phase 0: Add-on Infrastructure (Foundation) ✅ COMPLETE

### 0.1 Register Add-on Definition

**File**: `apps/admin-portal/server/src/lib/addonBilling.js`

Add to `DEFAULT_ADDONS` array:

```javascript
{
  code: 'table_management',
  name: 'Table Management',
  shortDescription: 'Visual floor plans, reservations, waitlist, and table analytics.',
  longDescription:
    'Full table management suite: design your floor layout with drag-and-drop, accept online/phone reservations with SMS confirmations, ' +
    'manage walk-in waitlists with accurate wait times, and track table turnover and revenue per cover. ' +
    'Pricing follows your subscription billing period (monthly or yearly).',
  screenshotUrls: [],
  isActive: true,
  sortOrder: 2,
}
```

### 0.2 Update Entitlement Mapping

**File**: `packages/paid-addons/src/index.js`

```javascript
const ENTITLEMENT_BY_CODE = {
  qr_ordering: 'qrOrdering',
  loyalty: 'loyalty',
  table_management: 'tableManagement',  // NEW
};

// Add helper function
function isTableManagementEffective(paidAddons) {
  return isPaidAddonEffective(paidAddons, 'tableManagement');
}

module.exports = {
  // ... existing exports
  isTableManagementEffective,
};
```

### 0.3 Add Schema Field to Tenant

**File**: `apps/pos/server/src/models/Tenant.js` (and admin-portal copy)

Add to `paidAddons` schema:

```javascript
tableManagement: {
  active: { type: Boolean, default: false },
  activatedAt: { type: Date, default: null },
  amountPerCycle: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: '', trim: true, uppercase: true },
  periodEndsAt: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  trialActivatedAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
}
```

### 0.4 Update Expiry Logic

**File**: `apps/admin-portal/server/src/lib/addonPeriod.js`

```javascript
async function applyPaidAddonExpiryIfNeeded(tenant) {
  let t = tenant;
  t = await applyAddonExpiryIfNeeded(t, 'qrOrdering');
  t = await applyAddonExpiryIfNeeded(t, 'loyalty');
  t = await applyAddonExpiryIfNeeded(t, 'tableManagement');  // NEW
  return t;
}
```

### 0.5 Create Middleware Guard

**File**: `apps/pos/server/src/middleware/requirePaidAddon.js`

Ensure `requirePaidAddon('tableManagement')` works (already generic).

### 0.6 Update POS Tenant Add-ons Endpoint

**File**: `apps/pos/server/src/routes/tenantAddons.js`

```javascript
const { isLoyaltyEffective, isQrOrderingEffective, isTableManagementEffective } = require('@innovapos/paid-addons');

// In the route handler:
res.json({
  loyalty: isLoyaltyEffective(paidAddons),
  qrOrdering: isQrOrderingEffective(paidAddons),
  tableManagement: isTableManagementEffective(paidAddons),  // NEW
});
```

### 0.7 Migration: Existing Table Users → Trial

Run one-time script to grant 14-day trial to tenants with `tableManagementEnabled: true` on any store:

```javascript
// scripts/migrate-table-management-addon.js
const stores = await Store.find({ tableManagementEnabled: true }).distinct('tenantId');
for (const tenantId of stores) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant.paidAddons?.tableManagement?.active) {
    tenant.paidAddons = tenant.paidAddons || {};
    tenant.paidAddons.tableManagement = {
      active: true,
      activatedAt: new Date(),
      trialActivatedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    };
    await tenant.save();
  }
}
```

---

## Phase 1: Visual Floor Plan Editor

### 1.1 Database Schema

**New Model**: `apps/pos/server/src/models/FloorPlan.js`

```javascript
const mongoose = require('mongoose');

const tablePositionSchema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', required: true },
  x: { type: Number, required: true },           // Grid X position
  y: { type: Number, required: true },           // Grid Y position
  width: { type: Number, default: 1 },           // Grid units wide
  height: { type: Number, default: 1 },          // Grid units tall
  shape: { type: String, enum: ['rectangle', 'round', 'booth', 'bar'], default: 'rectangle' },
  rotation: { type: Number, default: 0 },        // Degrees (0, 90, 180, 270)
  capacity: { type: Number, default: 4, min: 1, max: 20 },
}, { _id: false });

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#3b82f6' },   // Zone background color
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  isOutdoor: { type: Boolean, default: false },
  availableFrom: { type: String, default: null }, // HH:mm or null (always)
  availableUntil: { type: String, default: null },
}, { _id: true });

const floorPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  name: { type: String, default: 'Main Floor', trim: true },
  gridWidth: { type: Number, default: 20 },      // Grid columns
  gridHeight: { type: Number, default: 15 },     // Grid rows
  cellSizePx: { type: Number, default: 50 },     // Pixel size per cell (for rendering)
  tables: [tablePositionSchema],
  zones: [zoneSchema],
  isDefault: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

floorPlanSchema.index({ tenantId: 1, storeId: 1 });

module.exports = mongoose.model('FloorPlan', floorPlanSchema);
```

**Update CafeTable Model**: Add capacity field

```javascript
capacity: { type: Number, default: 4, min: 1, max: 20 },
```

### 1.2 API Routes

**File**: `apps/pos/server/src/routes/floorPlan.js`

```javascript
const express = require('express');
const FloorPlan = require('../models/FloorPlan');
const CafeTable = require('../models/CafeTable');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('tableManagement');

router.use(protect, tenantScope, requireTableMgmt);

// GET floor plan for store
router.get('/', resolveSelectedStore, async (req, res) => {
  const storeId = req.storeId || await resolveWriteStoreId(req);
  if (!storeId) return res.status(400).json({ message: 'Store required' });
  
  let plan = await FloorPlan.findOne({ tenantId: req.tenantId, storeId }).lean();
  if (!plan) {
    // Auto-create default floor plan with existing tables
    const tables = await CafeTable.find({ tenantId: req.tenantId, storeId }).lean();
    plan = await FloorPlan.create({
      tenantId: req.tenantId,
      storeId,
      name: 'Main Floor',
      tables: tables.map((t, i) => ({
        tableId: t._id,
        x: (i % 5) * 2,
        y: Math.floor(i / 5) * 2,
        width: 1,
        height: 1,
        shape: 'rectangle',
        capacity: t.capacity || 4,
      })),
    });
  }
  res.json(plan);
});

// PUT update floor plan (full replace)
router.put('/', authorize('manager', 'merchant_admin', 'superadmin'), resolveSelectedStore, async (req, res) => {
  const storeId = await resolveWriteStoreId(req);
  if (!storeId) return res.status(400).json({ message: 'Store required' });
  
  const { gridWidth, gridHeight, cellSizePx, tables, zones, name } = req.body;
  
  const plan = await FloorPlan.findOneAndUpdate(
    { tenantId: req.tenantId, storeId },
    {
      $set: {
        ...(name && { name }),
        ...(gridWidth && { gridWidth }),
        ...(gridHeight && { gridHeight }),
        ...(cellSizePx && { cellSizePx }),
        ...(tables && { tables }),
        ...(zones && { zones }),
        updatedBy: req.user.id,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(plan);
});

// GET real-time table status overlay
router.get('/status', resolveSelectedStore, async (req, res) => {
  const storeId = req.storeId;
  if (!storeId) return res.status(400).json({ message: 'Store required' });
  
  const Order = require('../models/Order');
  const Reservation = require('../models/Reservation');
  
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  // Active orders by table
  const activeOrders = await Order.find({
    tenantId: req.tenantId,
    storeId,
    tableId: { $ne: null },
    status: { $nin: ['completed', 'cancelled'] },
  }).select('tableId status orderNumber createdAt').lean();
  
  // Upcoming reservations
  const upcomingReservations = await Reservation.find({
    tenantId: req.tenantId,
    storeId,
    tableId: { $ne: null },
    status: { $in: ['confirmed', 'seated'] },
    reservationTime: { $lte: twoHoursFromNow },
  }).select('tableId reservationTime partySize status guestName').lean();
  
  const statusByTable = {};
  
  activeOrders.forEach(o => {
    statusByTable[String(o.tableId)] = {
      status: 'occupied',
      orderId: o._id,
      orderNumber: o.orderNumber,
      orderStatus: o.status,
      seatedAt: o.createdAt,
    };
  });
  
  upcomingReservations.forEach(r => {
    const key = String(r.tableId);
    if (!statusByTable[key]) {
      statusByTable[key] = {
        status: r.status === 'seated' ? 'occupied' : 'reserved',
        reservationId: r._id,
        reservationTime: r.reservationTime,
        guestName: r.guestName,
        partySize: r.partySize,
      };
    }
  });
  
  res.json(statusByTable);
});

module.exports = router;
```

### 1.3 Frontend Components

**File**: `apps/pos/client/src/components/FloorPlanEditor.jsx`

```jsx
// Key features:
// - Drag-and-drop table placement using react-dnd or @dnd-kit
// - Grid-based snapping
// - Table shape selection (round, rectangle, booth, bar)
// - Zone creation with color picker
// - Capacity input per table
// - Real-time preview
// - Undo/redo with state history

// Component structure:
// <FloorPlanEditor>
//   <FloorPlanToolbar />        // Shape selector, zoom, grid toggle
//   <FloorPlanCanvas>           // Main drag-drop area
//     <ZoneLayer />             // Background zones
//     <GridLayer />             // Optional grid overlay
//     <TablesLayer />           // Draggable table elements
//   </FloorPlanCanvas>
//   <FloorPlanSidebar />        // Table properties, zone list
// </FloorPlanEditor>
```

**File**: `apps/pos/client/src/components/FloorPlanView.jsx`

```jsx
// Read-only view for cashiers with real-time status:
// - Color-coded tables: green (available), red (occupied), yellow (reserved soon)
// - Click table to view order details or seat guests
// - Timer showing how long each table has been occupied
// - Quick actions: assign order, clear table, view bill
```

### 1.4 Estimated Effort

| Task | Complexity | Hours |
|------|-----------|-------|
| FloorPlan model + API | Medium | 8 |
| Floor plan editor component | High | 24 |
| Real-time status view | Medium | 12 |
| Integration with orders | Medium | 8 |
| Testing & polish | Medium | 8 |
| **Total Phase 1** | | **60 hours** |

---

## Phase 2: Reservations & Waitlist Management

### 2.1 Database Schema

**New Model**: `apps/pos/server/src/models/Reservation.js`

```javascript
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  
  // Guest info
  guestName: { type: String, required: true, trim: true },
  guestPhone: { type: String, required: true, trim: true },
  guestEmail: { type: String, default: '', trim: true, lowercase: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  
  // Reservation details
  reservationTime: { type: Date, required: true, index: true },
  partySize: { type: Number, required: true, min: 1, max: 50 },
  duration: { type: Number, default: 90 },  // Expected minutes
  
  // Table assignment
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', default: null },
  tableLabel: { type: String, default: '' },
  zonePreference: { type: String, default: '' },  // "outdoor", "window", etc.
  
  // Status workflow
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'reminded', 'arrived', 'seated', 'completed', 'no_show', 'cancelled'],
    default: 'pending',
  },
  
  // Notifications
  confirmationSentAt: { type: Date, default: null },
  reminderSentAt: { type: Date, default: null },
  reminderScheduledFor: { type: Date, default: null },
  
  // Source & notes
  source: { type: String, enum: ['phone', 'walk_in', 'website', 'google', 'api'], default: 'phone' },
  specialRequests: { type: String, default: '', maxlength: 500 },
  internalNotes: { type: String, default: '', maxlength: 500 },
  
  // Deposit (optional)
  depositAmount: { type: Number, default: 0 },
  depositPaid: { type: Boolean, default: false },
  depositPaymentId: { type: String, default: '' },
  
  // Timestamps
  arrivedAt: { type: Date, default: null },
  seatedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: '' },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

reservationSchema.index({ tenantId: 1, storeId: 1, reservationTime: 1 });
reservationSchema.index({ tenantId: 1, guestPhone: 1 });
reservationSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
```

**New Model**: `apps/pos/server/src/models/Waitlist.js`

```javascript
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  
  // Guest info
  guestName: { type: String, required: true, trim: true },
  guestPhone: { type: String, required: true, trim: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  
  // Party details
  partySize: { type: Number, required: true, min: 1, max: 50 },
  zonePreference: { type: String, default: '' },
  
  // Queue position
  position: { type: Number, required: true },
  estimatedWaitMinutes: { type: Number, default: null },
  quotedWaitMinutes: { type: Number, default: null },  // What we told the guest
  
  // Status
  status: {
    type: String,
    enum: ['waiting', 'notified', 'ready', 'seated', 'left', 'no_show'],
    default: 'waiting',
  },
  
  // Notifications
  notifiedAt: { type: Date, default: null },
  notificationMethod: { type: String, enum: ['sms', 'call', 'pager', 'none'], default: 'sms' },
  
  // Timestamps
  joinedAt: { type: Date, default: Date.now },
  seatedAt: { type: Date, default: null },
  leftAt: { type: Date, default: null },
  
  // Optional assigned table when ready
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', default: null },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

waitlistSchema.index({ tenantId: 1, storeId: 1, status: 1, position: 1 });

module.exports = mongoose.model('Waitlist', waitlistSchema);
```

**New Model**: `apps/pos/server/src/models/ReservationSettings.js`

```javascript
const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0=Sunday
  openTime: { type: String, required: true },  // "11:00"
  closeTime: { type: String, required: true }, // "22:00"
  slotDurationMinutes: { type: Number, default: 15 },
  maxPartySizePerSlot: { type: Number, default: null }, // null = unlimited
}, { _id: false });

const reservationSettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  
  // General settings
  enabled: { type: Boolean, default: true },
  maxPartySize: { type: Number, default: 12 },
  minLeadTimeMinutes: { type: Number, default: 60 },      // Min advance booking
  maxLeadTimeDays: { type: Number, default: 30 },         // Max advance booking
  defaultDurationMinutes: { type: Number, default: 90 },
  bufferMinutes: { type: Number, default: 15 },           // Between reservations
  
  // Time slots per day
  timeSlots: [timeSlotSchema],
  
  // Confirmation settings
  requireConfirmation: { type: Boolean, default: true },
  autoConfirmOnline: { type: Boolean, default: false },
  confirmationMessage: { type: String, default: 'Your reservation is confirmed for {time} on {date}. Reply CANCEL to cancel.' },
  
  // Reminder settings
  sendReminder: { type: Boolean, default: true },
  reminderHoursBefore: { type: Number, default: 24 },
  reminderMessage: { type: String, default: 'Reminder: Your reservation is tomorrow at {time}. Reply CANCEL to cancel.' },
  
  // No-show policy
  noShowGracePeriodMinutes: { type: Number, default: 15 },
  
  // Deposit settings (future)
  requireDeposit: { type: Boolean, default: false },
  depositAmount: { type: Number, default: 0 },
  depositCurrency: { type: String, default: 'LKR' },
  
  // Waitlist settings
  waitlistEnabled: { type: Boolean, default: true },
  waitlistMaxSize: { type: Number, default: 50 },
  waitlistNotifyWhenReady: { type: Boolean, default: true },
  waitlistNotifyMessage: { type: String, default: 'Hi {name}! Your table is ready at {store}. Please check in within 10 minutes.' },
  
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

reservationSettingsSchema.index({ tenantId: 1, storeId: 1 }, { unique: true });

module.exports = mongoose.model('ReservationSettings', reservationSettingsSchema);
```

### 2.2 API Routes

**File**: `apps/pos/server/src/routes/reservations.js`

```javascript
const express = require('express');
const Reservation = require('../models/Reservation');
const ReservationSettings = require('../models/ReservationSettings');
const CafeTable = require('../models/CafeTable');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('tableManagement');

router.use(protect, tenantScope, requireTableMgmt);

// GET /reservations - List reservations for date range
router.get('/', async (req, res) => {
  const { date, startDate, endDate, status } = req.query;
  // ... filter by date range, status, return with table info
});

// POST /reservations - Create reservation
router.post('/', async (req, res) => {
  // Validate time slot availability
  // Auto-assign table if possible
  // Queue SMS confirmation
});

// GET /reservations/availability - Check available slots
router.get('/availability', async (req, res) => {
  const { date, partySize } = req.query;
  // Return available time slots with table options
});

// PUT /reservations/:id/status - Update status (confirm, seat, complete, no-show, cancel)
router.put('/:id/status', async (req, res) => {
  // Handle status transitions
  // Trigger notifications
});

// PUT /reservations/:id/assign-table - Assign/reassign table
router.put('/:id/assign-table', async (req, res) => {
  // Validate table availability for time slot
});

// Settings routes
router.get('/settings', async (req, res) => { /* ... */ });
router.put('/settings', authorize('manager', 'merchant_admin'), async (req, res) => { /* ... */ });

module.exports = router;
```

**File**: `apps/pos/server/src/routes/waitlist.js`

```javascript
const express = require('express');
const Waitlist = require('../models/Waitlist');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('tableManagement');

router.use(protect, tenantScope, requireTableMgmt);

// GET /waitlist - Current waitlist
router.get('/', async (req, res) => {
  // Return sorted by position, with estimated wait times
});

// POST /waitlist - Add to waitlist
router.post('/', async (req, res) => {
  // Calculate position and estimated wait
  // Send SMS with position
});

// PUT /waitlist/:id/notify - Send "table ready" notification
router.put('/:id/notify', async (req, res) => {
  // Send SMS/notification
  // Update status to 'notified'
});

// PUT /waitlist/:id/seat - Mark as seated
router.put('/:id/seat', async (req, res) => {
  // Create order if needed
  // Remove from queue
});

// DELETE /waitlist/:id - Remove from waitlist (left or no-show)
router.delete('/:id', async (req, res) => { /* ... */ });

// GET /waitlist/estimate - Get estimated wait time for party size
router.get('/estimate', async (req, res) => {
  const { partySize } = req.query;
  // Calculate based on current queue and average turnover
});

module.exports = router;
```

### 2.3 SMS Integration

**File**: `packages/sms-transport/src/index.js` (New Package)

```javascript
// Abstract SMS provider interface
// Implementations: Twilio, Nexmo, local gateway
// Queue-based sending with retry logic
// Template variable substitution

module.exports = {
  sendSms,
  queueSms,
  processQueue,
};
```

**File**: `apps/pos/server/src/jobs/reservationReminders.js`

```javascript
// Cron job to:
// - Send reminders for reservations (X hours before)
// - Mark no-shows (past grace period)
// - Clean up old waitlist entries
```

### 2.4 Public Booking Widget

**File**: `apps/public-web/client/src/pages/Reservations.jsx`

```jsx
// Embedded widget or standalone page:
// - Date picker
// - Party size selector
// - Available time slots display
// - Guest info form
// - Confirmation display
// - SMS verification (optional)
```

### 2.5 Frontend Components

```
apps/pos/client/src/pages/manager/
├── ReservationsPage.jsx       // Daily/weekly calendar view
├── ReservationForm.jsx        // Create/edit reservation modal
├── ReservationSettings.jsx    // Settings management
└── WaitlistPage.jsx           // Real-time waitlist queue

apps/pos/client/src/components/
├── ReservationCalendar.jsx    // Weekly calendar with drag support
├── TimeSlotPicker.jsx         // Time slot selection
├── WaitlistQueue.jsx          // Live-updating queue display
└── WaitEstimator.jsx          // Wait time calculation display
```

### 2.6 Estimated Effort

| Task | Complexity | Hours |
|------|-----------|-------|
| Reservation model + CRUD API | Medium | 12 |
| Waitlist model + API | Medium | 8 |
| Availability calculation logic | High | 16 |
| SMS integration package | Medium | 12 |
| Reminder cron job | Low | 4 |
| Reservation calendar UI | High | 20 |
| Waitlist queue UI | Medium | 10 |
| Public booking widget | Medium | 12 |
| Settings UI | Low | 6 |
| Testing & polish | Medium | 10 |
| **Total Phase 2** | | **110 hours** |

---

## Phase 3: Table Turnover Analytics

### 3.1 Database Schema

**New Model**: `apps/pos/server/src/models/TableSession.js`

```javascript
const mongoose = require('mongoose');

// Captures each table occupancy session for analytics
const tableSessionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', required: true, index: true },
  tableLabel: { type: String, default: '' },
  
  // Session timing
  seatedAt: { type: Date, required: true, index: true },
  clearedAt: { type: Date, default: null },
  durationMinutes: { type: Number, default: null },
  
  // Party info
  partySize: { type: Number, default: null },
  source: { type: String, enum: ['walk_in', 'reservation', 'waitlist', 'qr_order'], default: 'walk_in' },
  
  // Revenue data (denormalized for fast queries)
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  orderTotal: { type: Number, default: 0 },
  revenuePerCover: { type: Number, default: 0 },
  
  // Reservation/waitlist reference
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  waitlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Waitlist', default: null },
  
  // Day parts for aggregation
  dayOfWeek: { type: Number, min: 0, max: 6 },  // 0=Sunday
  hourOfDay: { type: Number, min: 0, max: 23 },
  dayPart: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'late_night'], default: 'lunch' },
  
  // Service quality indicators
  firstItemOrderedMinutes: { type: Number, default: null },  // Time to first order
  lastItemServedMinutes: { type: Number, default: null },    // Time to last item served
  paymentCollectedMinutes: { type: Number, default: null },  // Time to payment
  
}, { timestamps: true });

tableSessionSchema.index({ tenantId: 1, storeId: 1, seatedAt: -1 });
tableSessionSchema.index({ tenantId: 1, storeId: 1, tableId: 1, seatedAt: -1 });

module.exports = mongoose.model('TableSession', tableSessionSchema);
```

### 3.2 Session Tracking Logic

**File**: `apps/pos/server/src/lib/tableSessionTracker.js`

```javascript
// Triggered when:
// 1. Order created with tableId → start session (if not exists)
// 2. Reservation seated → start session
// 3. Waitlist seated → start session
// 4. Order completed/cancelled → end session (if last order on table)
// 5. Table manually cleared → end session

async function startTableSession({ tenantId, storeId, tableId, partySize, source, orderId, reservationId, waitlistId }) {
  // Check if session already exists for this table
  // Create new TableSession record
  // Return session ID
}

async function endTableSession({ tenantId, storeId, tableId, orderId }) {
  // Find active session for table
  // Calculate duration, revenue metrics
  // Update session record
}

async function updateSessionRevenue({ orderId }) {
  // Called when order totals change
  // Update denormalized revenue fields
}
```

### 3.3 Analytics API

**File**: `apps/pos/server/src/routes/tableAnalytics.js`

```javascript
const express = require('express');
const TableSession = require('../models/TableSession');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();
const requireTableMgmt = requirePaidAddon('tableManagement');

router.use(protect, tenantScope, requireTableMgmt);

// GET /table-analytics/summary - Dashboard summary
router.get('/summary', authorize('manager', 'merchant_admin'), async (req, res) => {
  const { startDate, endDate, storeId } = req.query;
  
  const pipeline = [
    { $match: { tenantId, storeId, seatedAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        totalRevenue: { $sum: '$orderTotal' },
        totalCovers: { $sum: '$partySize' },
        avgDuration: { $avg: '$durationMinutes' },
        avgRevenuePerCover: { $avg: '$revenuePerCover' },
      },
    },
  ];
  
  const result = await TableSession.aggregate(pipeline);
  res.json(result[0] || {});
});

// GET /table-analytics/by-table - Per-table breakdown
router.get('/by-table', authorize('manager', 'merchant_admin'), async (req, res) => {
  const pipeline = [
    { $match: { /* date range */ } },
    {
      $group: {
        _id: '$tableId',
        tableLabel: { $first: '$tableLabel' },
        sessions: { $sum: 1 },
        totalRevenue: { $sum: '$orderTotal' },
        avgDuration: { $avg: '$durationMinutes' },
        avgRevenuePerCover: { $avg: '$revenuePerCover' },
        turnoversPerDay: { /* calculated */ },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];
  
  res.json(await TableSession.aggregate(pipeline));
});

// GET /table-analytics/by-hour - Hourly heatmap
router.get('/by-hour', authorize('manager', 'merchant_admin'), async (req, res) => {
  // Group by dayOfWeek + hourOfDay
  // Return matrix for heatmap visualization
});

// GET /table-analytics/by-day-part - Breakfast/lunch/dinner breakdown
router.get('/by-day-part', authorize('manager', 'merchant_admin'), async (req, res) => {
  // Group by dayPart
});

// GET /table-analytics/turnover-trend - Daily turnover rate trend
router.get('/turnover-trend', authorize('manager', 'merchant_admin'), async (req, res) => {
  // Daily series of turnover rate (sessions / tables)
});

// GET /table-analytics/service-times - Service quality metrics
router.get('/service-times', authorize('manager', 'merchant_admin'), async (req, res) => {
  // Avg time to first order, avg total duration, avg payment time
  // By server (if tracked), by day, by hour
});

module.exports = router;
```

### 3.4 Frontend Components

```
apps/pos/client/src/pages/manager/
├── TableAnalyticsPage.jsx     // Main analytics dashboard
└── TableAnalyticsSettings.jsx // Goal setting, alerts

apps/pos/client/src/components/analytics/
├── RevenueSummaryCards.jsx    // KPI cards
├── TablePerformanceTable.jsx  // Sortable table list
├── TurnoverHeatmap.jsx        // Hour x Day heatmap
├── TurnoverTrendChart.jsx     // Line chart over time
├── DayPartComparison.jsx      // Bar chart by meal period
└── ServiceTimesChart.jsx      // Service quality metrics
```

### 3.5 Scheduled Aggregation (Optional for Performance)

**File**: `apps/pos/server/src/jobs/aggregateTableAnalytics.js`

```javascript
// Nightly job to pre-aggregate daily/weekly/monthly summaries
// Store in TableAnalyticsSummary collection for fast dashboard loads
// Useful when session data grows large
```

### 3.6 Estimated Effort

| Task | Complexity | Hours |
|------|-----------|-------|
| TableSession model | Low | 4 |
| Session tracking logic | Medium | 12 |
| Analytics aggregation API | Medium | 16 |
| Summary dashboard UI | Medium | 12 |
| Per-table breakdown UI | Medium | 8 |
| Heatmap visualization | Medium | 10 |
| Trend charts | Medium | 8 |
| Export to CSV/PDF | Low | 6 |
| Testing & polish | Medium | 8 |
| **Total Phase 3** | | **84 hours** |

---

## Implementation Timeline

```
Week 1-2:   Phase 0 (Add-on Infrastructure) + Phase 1 Start
Week 3-4:   Phase 1 Complete (Floor Plan Editor)
Week 5-7:   Phase 2 (Reservations & Waitlist)
Week 8-9:   Phase 3 (Analytics)
Week 10:    Integration testing, bug fixes, documentation
```

### Total Estimated Effort

| Phase | Hours |
|-------|-------|
| Phase 0: Add-on Infrastructure | 16 |
| Phase 1: Visual Floor Plan | 60 |
| Phase 2: Reservations & Waitlist | 110 |
| Phase 3: Table Analytics | 84 |
| **Grand Total** | **270 hours** |

---

## Marketing Feature Matrix

| Feature | Competitor Comparison | Pricing Tier |
|---------|----------------------|--------------|
| Floor Plan Editor | Toast $165/mo, Square $60/mo | Included |
| Reservations | OpenTable $249/mo, Resy $249/mo | Included |
| Waitlist | Yelp Waitlist $249/mo | Included |
| SMS Notifications | $0.05/SMS (pass-through) | Usage-based |
| Analytics Dashboard | Requires enterprise tier elsewhere | Included |
| Google Reserve Integration | OpenTable extra | Future |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SMS costs spiral | Rate limiting, daily caps per tenant |
| Floor plan complexity | Start with grid-based, defer freeform |
| Reservation conflicts | Pessimistic locking on table assignments |
| Analytics performance | Pre-aggregate nightly, index optimization |
| Migration disruption | 14-day trial for existing users |

---

## Success Metrics

1. **Adoption**: 30% of active tenants enable add-on within 90 days
2. **Retention**: <5% churn rate on add-on after first billing cycle
3. **Engagement**: Avg 15+ reservations/week for enabled venues
4. **Revenue Impact**: Tables with analytics show 12%+ higher revenue/cover
