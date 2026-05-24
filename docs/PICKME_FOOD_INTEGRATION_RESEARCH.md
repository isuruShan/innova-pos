# PickMe Food Integration Research

**Date:** May 24, 2026  
**Platform:** [PickMe Food](https://pickme.lk/food)  
**Merchant Portal:** [merchant.pickme.lk](https://merchant.pickme.lk/)  
**Legal Entity:** Digital Mobility Solutions Lanka PLC

---

## Executive Summary

PickMe Food is Sri Lanka's leading food delivery platform with 4000+ restaurant partners. Unlike Uber Eats, **PickMe Food does not offer a publicly documented developer API** for menu synchronization or order management. The platform operates on a more traditional, manual onboarding model.

This document outlines findings from researching PickMe's merchant integration capabilities and provides recommendations for implementing integration features within our POS application.

---

## Current State: PickMe Food Merchant Integration

### Onboarding Process

Based on research of `merchant.pickme.lk` and the partner page:

1. **Manual Registration Flow**
   - Merchants sign up via `merchant.pickme.lk`
   - Required documents: Business registration, VAT cert, ID, Food certificate
   - **Menu submitted via Excel template** (downloadable from registration portal)
   - Dish images uploaded as JPG files

2. **Menu Management**
   - Menu items are manually entered during onboarding
   - Changes require contacting PickMe support or using their merchant dashboard
   - No API endpoint for programmatic menu updates (unlike Uber Eats)

3. **Order Management**
   - PickMe provides a **Merchant App** (mobile) for order acceptance
   - No evidence of webhook/POS integration APIs
   - Orders appear in their mobile app, not pushed to external systems

### Technical Architecture (Observed)

| Feature | Uber Eats | PickMe Food |
|---------|-----------|-------------|
| Public Developer API | ✅ Yes (`api.uber.com`) | ❌ No public API found |
| OAuth 2.0 Integration | ✅ Yes | ❌ Not available |
| Menu Sync API | ✅ `PUT /eats/stores/{id}/menus` | ❌ Manual upload only |
| Webhook Events | ✅ `orders.notification`, etc. | ❌ Not documented |
| POS Integration SDK | ✅ Yes | ❌ No SDK found |
| Item Activation/Deactivation | ✅ Via API | ❌ Via dashboard only |
| Price Override | ✅ Via menu payload | ❌ Manual change |

---

## Feature Requirements vs. PickMe Capabilities

### 1. Menu Sync
| Requirement | PickMe Support | Notes |
|-------------|----------------|-------|
| Push menu items to platform | ❌ | No API; requires manual Excel upload |
| Automatic sync on POS change | ❌ | Not possible without API |
| Category mapping | ❌ | Manual during onboarding |

### 2. Menu Item Activation/Deactivation on Demand
| Requirement | PickMe Support | Notes |
|-------------|----------------|-------|
| Toggle item availability | ⚠️ Partial | Only via PickMe dashboard/app |
| Real-time sync from POS | ❌ | Not possible without API |
| Bulk operations | ❌ | No API support |

### 3. Price Override for Integration
| Requirement | PickMe Support | Notes |
|-------------|----------------|-------|
| Platform-specific pricing | ❌ | Must contact support to change |
| Automatic price multiplier | ❌ | Not available |
| Currency handling | N/A | LKR only |

### 4. Selective Item Sync
| Requirement | PickMe Support | Notes |
|-------------|----------------|-------|
| Choose which items appear | ⚠️ Partial | During initial menu upload only |
| Dynamic inclusion/exclusion | ❌ | Not possible without API |

---

## Implementation Options

### Option A: Wait for PickMe API (Recommended Long-term)

**Strategy:** Engage PickMe's business development team to discuss API partnership.

**Actions:**
1. Contact PickMe B2B team via `partners@pickme.lk` or their LinkedIn
2. Propose technical partnership for POS integration
3. Request access to any existing merchant API (may be private/NDA)
4. Negotiate webhook endpoints for order flow

**Pros:**
- Clean, automated integration similar to Uber Eats
- Scales across all merchants automatically
- Real-time sync capabilities

**Cons:**
- Timeline dependent on PickMe's development roadmap
- May require revenue sharing or partnership fees
- PickMe may not prioritize API development

---

### Option B: Excel Export Automation (Manual-Assisted)

**Strategy:** Generate PickMe-compatible Excel files from POS menu data.

**Implementation:**
```
┌─────────────────────────────────────────────────────────────┐
│ POS Menu Database                                          │
│   └─► Filter items flagged for PickMe                      │
│       └─► Apply PickMe price overrides                     │
│           └─► Generate Excel file (PickMe template format) │
│               └─► Merchant downloads & uploads to PickMe   │
└─────────────────────────────────────────────────────────────┘
```

**Features to Build:**

1. **PickMe Item Selection Flag**
   ```javascript
   // In MenuItem schema
   pickmeSync: {
     enabled: { type: Boolean, default: false },
     priceOverride: { type: Number, default: null }, // null = use master price
     lastExportedAt: { type: Date, default: null },
   }
   ```

2. **Export Endpoint**
   ```
   GET /api/pickme/export/menu?storeId=...&format=xlsx
   ```
   - Filters items where `pickmeSync.enabled = true`
   - Applies `priceOverride` if set, else uses `price`
   - Outputs in PickMe's required Excel format

3. **Admin UI**
   - Checkbox per item: "Include in PickMe"
   - Price override field per item
   - "Download PickMe Menu" button
   - Instructions panel linking to PickMe merchant dashboard

**Pros:**
- Can be built immediately without PickMe cooperation
- Gives merchants some automation
- Low development effort

**Cons:**
- Still requires manual upload step
- No real-time availability sync
- No order integration

---

### Option C: Browser Automation / Scraping (Not Recommended)

**Strategy:** Automate PickMe merchant dashboard via browser automation.

**Why Not Recommended:**
- Violates PickMe Terms of Service
- Fragile (breaks on UI changes)
- Security risks (credential storage)
- Potential legal issues

---

### Option D: Middleware Partner Approach

**Strategy:** Check if middleware POS aggregators already integrate with PickMe.

**Potential Partners:**
- Deliverect (global aggregator)
- Otter (by Cloudkitchens)
- Hubster

**Actions:**
1. Research if these platforms operate in Sri Lanka
2. Check their PickMe integration status
3. Consider becoming a middleware partner

**Pros:**
- Leverages existing infrastructure
- May include multiple platforms (PickMe, UberEats, etc.)

**Cons:**
- Additional subscription costs for merchants
- Loss of direct control
- May not be available in LK market

---

## Recommended Implementation Plan

### Phase 1: Manual Export Tool (Immediate - 2 weeks)

Build a PickMe-specific menu export feature:

1. **Database Changes**
   - Add `pickmeSync` subdocument to `MenuItem` model
   - Add store-level PickMe config to `Store` model

2. **Backend API**
   - `GET /api/pickme/export/menu` - Excel export
   - `PUT /api/pickme/items/:id/config` - Toggle/price override

3. **Admin Portal UI**
   - "PickMe Integration" tab in Store Settings
   - Item-level sync toggles in Menu Management
   - Price override column
   - Export button with download

4. **POS Manager UI**
   - Quick toggle for PickMe availability (if needed urgently)

### Phase 2: Business Development (Parallel - Ongoing)

1. Submit formal partnership proposal to PickMe
2. Request API documentation (if exists as private/partner-only)
3. Propose webhook integration for orders
4. Negotiate technical partnership terms

### Phase 3: Full Integration (If API Access Granted)

Mirror the Uber Eats architecture:
- OAuth 2.0 flow
- Menu sync service
- Webhook handler for orders
- Order management API calls

---

## Data Model Additions

### MenuItem Schema Extension

```javascript
const menuItemSchema = {
  // ... existing fields ...
  
  // Integration overrides per platform
  platformOverrides: {
    pickme: {
      enabled: { type: Boolean, default: false },
      priceOverride: { type: Number, default: null },
      nameOverride: { type: String, default: '' },
      lastSyncedAt: { type: Date, default: null },
      syncStatus: { 
        type: String, 
        enum: ['pending', 'synced', 'error', 'not_applicable'], 
        default: 'not_applicable' 
      },
    },
    uberEats: {
      // Similar structure for consistency
      enabled: { type: Boolean, default: true }, // default true for Uber
      priceOverride: { type: Number, default: null },
      nameOverride: { type: String, default: '' },
    },
  },
};
```

### Store Schema Extension

```javascript
const storeSchema = {
  // ... existing fields ...
  
  pickmeConfig: {
    enabled: { type: Boolean, default: false },
    storeId: { type: String, default: '' }, // PickMe's internal ID if known
    defaultPriceMultiplier: { type: Number, default: 1.0 }, // e.g., 1.15 for 15% markup
    lastExportAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
};
```

---

## UI Mockup Concept

### Menu Management - PickMe Column

```
┌───────────────────────────────────────────────────────────────────────┐
│ Menu Items                                           [+ Add Item]     │
├───────────────────────────────────────────────────────────────────────┤
│ Name          │ Price    │ Active │ Uber │ PickMe │ PickMe Price     │
├───────────────┼──────────┼────────┼──────┼────────┼──────────────────┤
│ Cheese Burger │ Rs. 850  │   ✓    │  ✓   │   ✓    │ Rs. 950 (custom) │
│ Fries         │ Rs. 350  │   ✓    │  ✓   │   ✓    │ Rs. 350 (master) │
│ Milkshake     │ Rs. 450  │   ✓    │  ✓   │   ✗    │ —                │
│ Staff Meal    │ Rs. 0    │   ✓    │  ✗   │   ✗    │ —                │
└───────────────┴──────────┴────────┴──────┴────────┴──────────────────┘

                              [Export PickMe Menu ↓]
```

### Store Settings - PickMe Tab

```
┌───────────────────────────────────────────────────────────────────────┐
│ PickMe Food Integration                                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│ ⚠️ PickMe Food does not currently support automatic API sync.        │
│    Use this panel to prepare your menu for manual upload.            │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Default Price Markup        [  15  ] %                          │  │
│ │ (Applied to items without custom PickMe price)                  │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐  │
│ │ Items enabled for PickMe:   24 of 45                            │  │
│ │ Last export:                May 20, 2026 at 3:45 PM             │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ [Download PickMe Menu (Excel)]     [Open PickMe Dashboard →]          │
│                                                                       │
│ ───────────────────────────────────────────────────────────────────  │
│ Instructions:                                                         │
│ 1. Click "Download PickMe Menu" to get your menu file                │
│ 2. Log into merchant.pickme.lk                                       │
│ 3. Navigate to Menu Management                                       │
│ 4. Upload the downloaded Excel file                                  │
│ 5. Review and publish changes                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## PickMe Excel Template Format

Based on merchant onboarding requirements, the export should generate:

| Column | Description | Example |
|--------|-------------|---------|
| Item Name | Menu item name | Cheese Burger |
| Description | Item description | Juicy beef patty with cheese |
| Category | Menu category | Burgers |
| Price | Selling price (LKR) | 950 |
| Preparation Time | Minutes to prepare | 15 |
| Available | Yes/No | Yes |
| Image Filename | Reference to uploaded image | cheese_burger.jpg |

---

## Comparison Summary

| Feature | Uber Eats (Current) | PickMe (Proposed) |
|---------|---------------------|-------------------|
| Sync Method | Real-time API | Excel export + manual upload |
| Item Toggle | Instant API call | Export → Upload |
| Price Override | Instant API call | Export → Upload |
| Order Flow | Webhook → POS | Separate app (no integration) |
| Development Effort | Done ✅ | Phase 1: 2 weeks |
| Merchant Effort | None (auto) | Manual upload required |

---

## Next Steps

1. **Immediate:** Begin Phase 1 development (export tool)
2. **This Week:** Draft partnership proposal for PickMe B2B team
3. **Ongoing:** Monitor PickMe for API announcements
4. **Q3 2026:** Re-evaluate based on PickMe partnership response

---

## Contact Points

- **PickMe Merchant Support:** merchant.pickme.lk contact form
- **PickMe General:** contact@pickme.lk
- **LinkedIn:** Digital Mobility Solutions Lanka PLC
- **HQ:** Colombo, Sri Lanka

---

## Appendix: Uber Eats Integration Architecture (Reference)

Our current Uber Eats integration follows this flow:

```
OAuth Flow:
┌────────────┐      ┌─────────────┐      ┌───────────┐
│ Admin UI   │──────│ POS Server  │──────│ Uber OAuth│
│ Connect Btn│      │ /auth/init  │      │ Authorize │
└────────────┘      └─────────────┘      └───────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Store Tokens  │
                    │ in Tenant doc │
                    └───────────────┘

Menu Sync:
┌────────────┐      ┌─────────────┐      ┌───────────┐
│ Admin UI   │──────│ POS Server  │──────│ Uber API  │
│ Sync Btn   │      │ /menu/sync  │ PUT  │ /menus    │
└────────────┘      └─────────────┘      └───────────┘

Order Flow:
┌───────────┐      ┌─────────────┐      ┌───────────┐
│ Uber Eats │──────│ POS Server  │──────│ POS Client│
│ Webhook   │ POST │ /webhook    │ SSE  │ Cashier   │
└───────────┘      └─────────────┘      └───────────┘
```

This architecture should be replicated for PickMe once API access is available.
