const Store = require('../models/Store');
const User = require('../models/User');

const normalizeId = (value) => (value ? String(value) : null);

const resolveSelectedStore = async (req, res, next) => {
  try {
    const rawStoreId = req.headers['x-store-id'];
    if (!rawStoreId || rawStoreId === 'all') {
      req.storeId = null;
      return next();
    }

    if (!req.tenantId) return res.status(400).json({ message: 'No tenant context for store scoping' });

    const storeId = normalizeId(rawStoreId);
    const store = await Store.findOne({ _id: storeId, tenantId: req.tenantId, isActive: true }).select('_id');
    if (!store) return res.status(400).json({ message: 'Invalid store selection' });

    const requester = await User.findOne({ _id: req.user.id, tenantId: req.tenantId }).select('storeIds');
    const userStoreIds = (requester?.storeIds || []).map(normalizeId).filter(Boolean);
    if (userStoreIds.length && !userStoreIds.includes(storeId)) {
      return res.status(403).json({ message: 'Access denied for selected store' });
    }

    req.storeId = storeId;
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

module.exports = {
  resolveSelectedStore,
  buildStoreFilter,
  resolveWriteStoreId,
};
