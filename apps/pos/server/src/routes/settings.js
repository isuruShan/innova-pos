const express = require('express');
const Settings = require('../models/Settings');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { emitAudit } = require('@innovapos/shared-middleware');

const router = express.Router();

async function getOrCreate(tenantId) {
  let s = await Settings.findOne({ tenantId });
  if (!s) s = await Settings.create({ tenantId });
  return s;
}

// GET settings — any authenticated user (cashier needs tax/fee rates)
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    res.json(await getOrCreate(req.tenantId));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update settings
router.put('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const s = await getOrCreate(req.tenantId);
    const before = s.toObject();

    const { orderTypes, currency, currencySymbol, timezone } = req.body;

    if (orderTypes) {
      for (const [key, val] of Object.entries(orderTypes)) {
        if (s.orderTypes[key] !== undefined) {
          if (val.enabled !== undefined) s.orderTypes[key].enabled = val.enabled;
          if (val.label !== undefined) s.orderTypes[key].label = val.label;
          if (val.taxComponents !== undefined) s.orderTypes[key].taxComponents = val.taxComponents;
          if (val.serviceFeeType !== undefined) s.orderTypes[key].serviceFeeType = val.serviceFeeType;
          if (val.serviceFeeRate !== undefined) s.orderTypes[key].serviceFeeRate = Math.max(0, Math.min(100, +val.serviceFeeRate));
          if (val.serviceFeeFixed !== undefined) s.orderTypes[key].serviceFeeFixed = Math.max(0, +val.serviceFeeFixed);
          if (val.serviceFeeLabel !== undefined) s.orderTypes[key].serviceFeeLabel = val.serviceFeeLabel;
        }
      }
      s.markModified('orderTypes');
    }

    if (currency) s.currency = currency;
    if (currencySymbol) s.currencySymbol = currencySymbol;
    if (timezone) s.timezone = timezone;
    s.updatedBy = req.user.id;

    await s.save();

    await emitAudit({
      req,
      action: 'SETTINGS_UPDATED',
      resource: 'Settings',
      resourceId: s._id,
      changes: { before: before.orderTypes, after: s.orderTypes },
    });

    res.json(s);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
