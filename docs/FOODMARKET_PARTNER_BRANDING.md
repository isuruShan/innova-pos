# Food Market Partner Branding Implementation

## Overview
Implemented dynamic partner branding system allowing food delivery partners (Uber Eats, PickMe, etc.) to have custom logos and colors displayed throughout the POS system.

## Date
June 1, 2026

## Changes Made

### 1. Database Schema Updates

#### FoodmarketPartner Model
**Files:**
- `/apps/pos/server/src/models/FoodmarketPartner.js`
- `/apps/admin-portal/server/src/models/FoodmarketPartner.js`

**New Fields:**
- `logoUrl` (String): Cloud storage URL for partner logo image
- `logoKey` (String): Storage key for S3/Azure Blob reference
- `icon` (String): Emoji fallback icon (default: 🛵)
- `color` (String): Hex color for badge display (default: #10b981)

#### Order Model
**Files:**
- `/apps/pos/server/src/models/Order.js`
- `/apps/admin-portal/server/src/models/Order.js`

**New Field:**
- `orderTypeBranding` (Object): Stores partner branding at order creation time
  - `logoUrl` (String)
  - `icon` (String)
  - `color` (String)

### 2. Admin Portal Updates

#### FoodmarketPartnersPage.jsx
**File:** `/apps/admin-portal/client/src/pages/admin/FoodmarketPartnersPage.jsx`

**Features Added:**
- Logo image upload with preview
- Icon selector (9 emoji options)
- Color picker (6 preset colors)
- Logo display in partner cards
- File validation (5MB limit, image formats)

**UI Components:**
- Image upload button with preview
- Grid-based icon selector
- Color picker with visual swatches
- Partner card shows logo/icon with color badge

### 3. API Route Updates

**Files:**
- `/apps/admin-portal/server/src/routes/foodmarketPartners.js`
- `/apps/pos/server/src/routes/foodmarketPartners.js`

**Changes:**
- POST `/foodmarket-partners`: Now accepts `logoUrl`, `logoKey`, `icon`, `color`
- PUT `/foodmarket-partners/:id`: Now accepts branding fields for updates

### 4. POS Client Updates

#### OrderTypeBadge.jsx
**File:** `/apps/pos/client/src/components/OrderTypeBadge.jsx`

**New Exports:**
- `BASE_ORDER_TYPES`: Core types (dine-in, takeaway) always available
- `buildOrderTypes(partners)`: Function to generate dynamic order types from active partners
- `ORDER_TYPES`: Maintained for backwards compatibility

**Component Updates:**
- Now accepts `logoUrl`, `icon`, `color` props
- Displays partner logo if available, else falls back to emoji icon
- Applies custom colors to badge styling

#### NewOrder.jsx
**File:** `/apps/pos/client/src/pages/cashier/NewOrder.jsx`

**Changes:**
- Imports `buildOrderTypes` function
- Order type picker now uses `buildOrderTypes(partners)` for dynamic list
- Order creation includes `orderTypeBranding` field with partner logo/icon/color
- Both `handlePaymentConfirm` and `sendTableTabOrder` save branding data

#### OptionPickerModal.jsx
**File:** `/apps/pos/client/src/components/OptionPickerModal.jsx`

**Changes:**
- Now supports `logoUrl` in option objects
- Displays image when `logoUrl` present, else shows emoji icon
- Image rendered at 40x40px with object-contain

#### Order Display Components
**Files:**
- `/apps/pos/client/src/pages/manager/OrdersView.jsx`
- `/apps/pos/client/src/pages/cashier/OrderBoard.jsx`

**Changes:**
- OrderTypeBadge calls now pass `order.orderTypeBranding` fields
- Displays partner logos from historical order data

## Usage Workflow

### For Merchants (Admin Portal)

1. Navigate to Food Market Partners page
2. Click "Add Partner" or edit existing partner
3. Upload partner logo (PNG/JPG, up to 5MB, recommended 200x200px)
4. Select fallback icon emoji
5. Choose badge color
6. Configure commission settings
7. Enable partner

### For Cashiers (POS)

1. Active partners automatically appear as order types in picker
2. Partner logos displayed throughout order flow:
   - Order type selection modal
   - Order sidebar badges
   - Order list views
   - Order board
3. Partner pricing applied automatically when partner order type selected

## Technical Notes

### Logo Storage
- Images uploaded via `/upload` endpoint
- Stored in cloud object storage (Azure/S3)
- URL and key saved to FoodmarketPartner document

### Dynamic Order Type IDs
- Generated from partner name: `partner.name.toLowerCase().replace(/\s+/g, '-')`
- Example: "Uber Eats" → "uber-eats"

### Backwards Compatibility
- ORDER_TYPES constant maintained with hardcoded uber-eats/pickme
- Legacy order types work as fallback
- Existing orders without branding use hardcoded icons

### Order Type Branding Persistence
- Branding (logo/icon/color) saved with each order
- Ensures consistent display even if partner updated later
- Historical orders show original branding

## Future Enhancements

1. **Remove Order Type Enum Restriction**: Currently orderType is enum-restricted to ['dine-in', 'takeaway', 'uber-eats', 'pickme']. Consider removing enum for true dynamic support.

2. **Bulk Partner Import**: Allow CSV/JSON import of multiple partners with logos.

3. **Partner-Specific Settings**: Per-partner tax rates, service fees, menu availability.

4. **Integration Webhooks**: Connect partner logo/branding to external APIs (Uber Eats API, PickMe API).

5. **Logo Optimization**: Automatic image resizing/optimization on upload.

## Testing Checklist

- [x] Upload partner logo in admin portal
- [ ] Verify logo appears in partner card
- [ ] Create new order with partner type in POS
- [ ] Verify partner logo in order type picker
- [ ] Verify partner logo in order sidebar
- [ ] Verify partner logo in order list view
- [ ] Verify partner logo in order board
- [ ] Verify partner pricing applied correctly
- [ ] Check historical orders display correct branding
- [ ] Test fallback icon when no logo uploaded
- [ ] Test color customization
- [ ] Verify mobile responsive layout

## Files Modified

### Models (4 files)
- `apps/pos/server/src/models/FoodmarketPartner.js`
- `apps/admin-portal/server/src/models/FoodmarketPartner.js`
- `apps/pos/server/src/models/Order.js`
- `apps/admin-portal/server/src/models/Order.js`

### API Routes (2 files)
- `apps/pos/server/src/routes/foodmarketPartners.js`
- `apps/admin-portal/server/src/routes/foodmarketPartners.js`

### Admin Portal UI (1 file)
- `apps/admin-portal/client/src/pages/admin/FoodmarketPartnersPage.jsx`

### POS Client (5 files)
- `apps/pos/client/src/components/OrderTypeBadge.jsx`
- `apps/pos/client/src/components/OptionPickerModal.jsx`
- `apps/pos/client/src/pages/cashier/NewOrder.jsx`
- `apps/pos/client/src/pages/manager/OrdersView.jsx`
- `apps/pos/client/src/pages/cashier/OrderBoard.jsx`

**Total: 12 files modified**

## Deployment Notes

1. **Database Migration**: No explicit migration needed. New fields have default values.
2. **API Compatibility**: Backwards compatible. Old clients ignore new fields.
3. **Cache Invalidation**: Recommend clearing React Query cache after deployment.
4. **Testing**: Test in staging environment before production rollout.

## Support & Troubleshooting

### Common Issues

**Logo not appearing:**
- Check image upload succeeded (check Network tab)
- Verify logoUrl saved to database
- Check CORS settings for image host

**Partner not in order type list:**
- Ensure partner `isActive` is true
- Refresh page to reload partners
- Check browser console for API errors

**Pricing not applied:**
- Verify partner has price overrides in menu items
- Check getItemPrice() logic in NewOrder.jsx
- Ensure orderType matches partner name pattern
