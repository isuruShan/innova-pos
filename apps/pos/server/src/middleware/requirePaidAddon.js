'use strict';

const Tenant = require('../models/Tenant');
const { entitlementKeyForCode, isPaidAddonEffective } = require('@innovapos/paid-addons');

const ADDON_MESSAGES = {
  loyalty:
    'The Loyalty program add-on is not active for this business. Subscribe in the admin portal under Add-ons.',
  qr_ordering:
    'QR Ordering is not active for this business. Subscribe in the admin portal under Add-ons.',
  table_management:
    'The Table Management add-on is not active for this business. Subscribe in the admin portal under Add-ons.',
};

/**
 * @param {string} addonCode — e.g. loyalty, qr_ordering
 */
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
      const tenant = await Tenant.findById(req.tenantId).select('paidAddons').lean();
      if (!tenant) return res.status(404).json({ message: 'Tenant not found' });
      if (!isPaidAddonEffective(tenant.paidAddons, entitlementKey)) {
        return res.status(402).json({ message, code: `${addonCode}_addon_required` });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePaidAddon };
