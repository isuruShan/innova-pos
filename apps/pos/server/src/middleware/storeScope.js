const Store = require('../models/Store');
const CentralKitchen = require('../models/CentralKitchen');
const User = require('../models/User');

const normalizeId = (value) => (value ? String(value) : null);

const resolveSelectedStore = async (req, res, next) => {
  try {
    const rawStoreId = req.headers['x-store-id'];
    if (!rawStoreId || rawStoreId === 'all') {
      req.storeId = null;
      req.storeType = 'Store';
      return next();
    }

    if (!req.tenantId) return res.status(400).json({ message: 'No tenant context for store scoping' });

    const storeId = normalizeId(rawStoreId);
    let store = await Store.findOne({ _id: storeId, tenantId: req.tenantId, isActive: true }).select('_id');
    
    if (store) {
      req.storeId = storeId;
      req.storeType = 'Store';
    } else {
      const ck = await CentralKitchen.findOne({ _id: storeId, tenantId: req.tenantId, isActive: true }).select('_id');
      if (!ck) return res.status(400).json({ message: 'Invalid store selection' });
      req.storeId = storeId;
      req.storeType = 'CentralKitchen';
    }

    const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select('storeIds centralKitchenId');
    
    if (req.storeType === 'CentralKitchen') {
      if (req.user.role === 'merchant_admin' || req.user.role === 'superadmin') {
        // Admin access granted
      } else if (normalizeId(requester?.centralKitchenId) !== storeId) {
        return res.status(403).json({ message: 'Access denied for selected Central Kitchen' });
      }
    } else {
      const userStoreIds = (requester?.storeIds || []).map(normalizeId).filter(Boolean);
      if (userStoreIds.length && !userStoreIds.includes(storeId)) {
        return res.status(403).json({ message: 'Access denied for selected store' });
      }
    }

    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid store selection' });
  }
};

const buildStoreFilter = (req, { includeLegacyGlobal = false } = {}) => {
  if (!req.storeId) return {};
  if (includeLegacyGlobal) {
    return { $or: [{ storeId: req.storeId }, { storeId: null }] };
  }
  return { storeId: req.storeId };
};

const resolveWriteStoreId = async (req) => {
  if (req.storeId) return req.storeId;

  const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select('storeIds defaultStoreId');
  if (requester?.defaultStoreId) return normalizeId(requester.defaultStoreId);

  const userStoreIds = (requester?.storeIds || []).map(normalizeId).filter(Boolean);
  if (userStoreIds.length) return userStoreIds[0];

  const fallback = await Store.findOne({ tenantId: req.tenantId, isActive: true })
    .sort({ isDefault: -1, name: 1 })
    .select('_id')
    .lean();
  return fallback ? normalizeId(fallback._id) : null;
};

const blockIfRetailStoreUnderCentralKitchen = async (req, res, next) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return next();

    const currentStore = await Store.findById(storeId);
    if (currentStore && currentStore.replenishmentModel === 'central_kitchen') {
      return res.status(403).json({
        message: 'Direct replenishment/purchasing operations are disabled at the store level. Replenishment must go through Stock Transfers from the Central Kitchen.',
        error: 'Direct replenishment/purchasing operations are disabled at the store level. Replenishment must go through Stock Transfers from the Central Kitchen.'
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  resolveSelectedStore,
  buildStoreFilter,
  resolveWriteStoreId,
  blockIfRetailStoreUnderCentralKitchen,
};

