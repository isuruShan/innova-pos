'use strict';

const Store = require('../models/Store');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Promotion = require('../models/Promotion');
const CafeTable = require('../models/CafeTable');
const CashierSession = require('../models/CashierSession');
const LoyaltyReward = require('../models/LoyaltyReward');
const Notification = require('../models/Notification');
const JournalEntry = require('../models/JournalEntry');
const PayrollRun = require('../models/PayrollRun');
const { syncMerchantAdminStoreIds } = require('./storePurchase');

/**
 * Permanently delete a store and its scoped data. Billing counts active stores only,
 * so removing a store drops extra-store charges on the next renewal cycle.
 */
async function permanentlyDeleteStore({ tenantId, storeId, deletedBy = null }) {
  const store = await Store.findOne({ _id: storeId, tenantId });
  if (!store) {
    const err = new Error('Store not found');
    err.status = 404;
    throw err;
  }
  if (store.isDefault) {
    const err = new Error('The default store cannot be deleted. Set another store as default first.');
    err.status = 400;
    throw err;
  }

  const storeObjId = store._id;

  await Promise.all([
    Order.deleteMany({ tenantId, storeId: storeObjId }),
    MenuItem.deleteMany({ tenantId, storeId: storeObjId }),
    Category.deleteMany({ tenantId, storeId: storeObjId }),
    Customer.deleteMany({ tenantId, storeId: storeObjId }),
    Promotion.deleteMany({ tenantId, storeId: storeObjId }),
    CafeTable.deleteMany({ tenantId, storeId: storeObjId }),
    CashierSession.deleteMany({ tenantId, storeId: storeObjId }),
    LoyaltyReward.deleteMany({ tenantId, storeId: storeObjId }),
    Notification.deleteMany({ tenantId, 'meta.storeId': String(storeObjId) }),
    JournalEntry.deleteMany({ tenantId, storeId: storeObjId }),
    PayrollRun.deleteMany({ tenantId, storeId: storeObjId }),
  ]);

  const users = await User.find({ tenantId, storeIds: storeObjId }).select('_id storeIds defaultStoreId');
  for (const user of users) {
    user.storeIds = (user.storeIds || []).filter((id) => String(id) !== String(storeObjId));
    if (user.defaultStoreId && String(user.defaultStoreId) === String(storeObjId)) {
      user.defaultStoreId = user.storeIds[0] || null;
    }
    if (deletedBy) user.updatedBy = deletedBy;
    // eslint-disable-next-line no-await-in-loop
    await user.save();
  }

  await Tenant.updateOne(
    { _id: tenantId },
    { $pull: { 'paidAddons.uberEats.stores': { storeId: storeObjId } } },
  );

  await Store.deleteOne({ _id: storeObjId, tenantId });
  await syncMerchantAdminStoreIds(tenantId, deletedBy);

  return { deletedStoreId: String(storeObjId), name: store.name, code: store.code };
}

module.exports = { permanentlyDeleteStore };
