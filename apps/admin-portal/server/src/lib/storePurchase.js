'use strict';

const Store = require('../models/Store');
const User = require('../models/User');
const { INCLUDED_STORES_PER_TENANT } = require('./addonBilling');

function normalizePaymentMethods(methods) {
  const list = Array.isArray(methods) ? methods : [];
  const cleaned = [...new Set(list.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean))];
  if (!cleaned.includes('cash')) cleaned.unshift('cash');
  return cleaned.length ? cleaned : ['cash'];
}

async function nextStoreCode(tenantId) {
  const count = await Store.countDocuments({ tenantId });
  let n = count + 1;
  let code = `ST${String(n).padStart(3, '0')}`;
  // eslint-disable-next-line no-await-in-loop
  while (await Store.exists({ tenantId, code })) {
    n += 1;
    code = `ST${String(n).padStart(3, '0')}`;
  }
  return code;
}

/**
 * Create a store with platform defaults after payment (or first included store).
 */
async function createDefaultStoreForTenant(tenantId, createdBy) {
  const code = await nextStoreCode(tenantId);
  const hasDefault = await Store.exists({ tenantId, isDefault: true, isActive: true });
  const store = await Store.create({
    tenantId,
    name: 'New store',
    code,
    address: '',
    phone: '',
    paymentMethods: normalizePaymentMethods(['cash']),
    isDefault: !hasDefault,
    isActive: true,
    deactivatedBySuperadmin: false,
    createdBy: createdBy || null,
  });

  const merchantAdmins = await User.find({ tenantId, role: 'merchant_admin', isActive: true }).select(
    '_id storeIds defaultStoreId',
  );
  for (const tenantUser of merchantAdmins) {
    const nextStoreIds = new Set((tenantUser.storeIds || []).map((sid) => String(sid)));
    nextStoreIds.add(String(store._id));
    tenantUser.storeIds = [...nextStoreIds];
    if (!tenantUser.defaultStoreId) tenantUser.defaultStoreId = store._id;
    tenantUser.updatedBy = createdBy || null;
    // eslint-disable-next-line no-await-in-loop
    await tenantUser.save();
  }

  return store;
}

async function countActiveStoresForTenant(tenantId) {
  return Store.countDocuments({ tenantId, isActive: true });
}

function requiresPaymentForNewStore(activeCount) {
  return activeCount >= INCLUDED_STORES_PER_TENANT;
}

module.exports = {
  createDefaultStoreForTenant,
  countActiveStoresForTenant,
  requiresPaymentForNewStore,
  INCLUDED_STORES_PER_TENANT,
};
