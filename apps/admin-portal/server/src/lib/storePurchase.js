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

  await syncMerchantAdminStoreIds(tenantId, createdBy);
  return store;
}

/** Merchant admins always receive every active store on the tenant (POS + admin). */
async function syncMerchantAdminStoreIds(tenantId, updatedBy = null) {
  const stores = await Store.find({ tenantId, isActive: true }).select('_id').lean();
  const allIds = stores.map((s) => String(s._id));
  const merchantAdmins = await User.find({ tenantId, role: 'merchant_admin', isActive: true }).select(
    '_id defaultStoreId',
  );
  for (const tenantUser of merchantAdmins) {
    tenantUser.storeIds = allIds;
    if (!tenantUser.defaultStoreId || !allIds.includes(String(tenantUser.defaultStoreId))) {
      tenantUser.defaultStoreId = allIds[0] || null;
    }
    if (updatedBy) tenantUser.updatedBy = updatedBy;
    // eslint-disable-next-line no-await-in-loop
    await tenantUser.save();
  }
}

async function countActiveStoresForTenant(tenantId) {
  return Store.countDocuments({ tenantId, isActive: true });
}

function requiresPaymentForNewStore(activeCount) {
  return activeCount >= INCLUDED_STORES_PER_TENANT;
}

module.exports = {
  nextStoreCode,
  createDefaultStoreForTenant,
  syncMerchantAdminStoreIds,
  countActiveStoresForTenant,
  requiresPaymentForNewStore,
  INCLUDED_STORES_PER_TENANT,
};
