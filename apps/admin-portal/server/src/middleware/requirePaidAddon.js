'use strict';

const Tenant = require('../models/Tenant');
const { entitlementKeyForCode, isPaidAddonEffective } = require('@innovapos/paid-addons');

const ADDON_MESSAGES = {
  loyalty:
    'The Loyalty program add-on is not active for your account. Subscribe under Add-ons in this portal.',
  qr_ordering:
    'QR Ordering is not active for your account. Subscribe under Add-ons in this portal.',
  accounting:
    'The Advanced Accounting Module is not active for your account. Subscribe under Add-ons in this portal.',
  whatsapp_integration:
    'WhatsApp Business Integration is not active for your account. Subscribe under Add-ons in this portal.',
  modifier_groups:
    'The Modifier Groups add-on is not active for your account. Subscribe under Add-ons in this portal.',
};

function requirePaidAddon(addonCode) {
  const entitlementKey = entitlementKeyForCode(addonCode);
  const message =
    ADDON_MESSAGES[addonCode] || 'This paid add-on is not active for your account.';

  return async function requirePaidAddonMiddleware(req, res, next) {
    try {
      if (!entitlementKey) {
        return res.status(400).json({ message: 'Unknown add-on' });
      }
      if (!req.tenantId) {
        return res.status(403).json({ message: 'Tenant context required' });
      }
      const tenant = await Tenant.findById(req.tenantId)
        .select('paidAddons assignedPlanId')
        .populate('assignedPlanId')
        .lean();
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      if (!isPaidAddonEffective(tenant, entitlementKey)) {
        return res.status(402).json({ message, code: `${addonCode}_addon_required` });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePaidAddon };
