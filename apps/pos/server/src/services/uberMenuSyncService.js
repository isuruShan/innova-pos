'use strict';

const axios = require('axios');
const MenuItem = require('../models/MenuItem');
const Tenant = require('../models/Tenant');
const { getStoreAccessToken } = require('./uberAuthService');

const UBER_API_BASE_URL = process.env.UBER_EATS_API_BASE_URL || 'https://api.uber.com/v1';

/**
 * Synchronize POS menu with Uber Eats
 * @param {string} tenantId
 * @param {string} storeId
 */
async function syncMenuToUber(tenantId, storeId) {
  // 1. Fetch Tenant & Store mappings
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new Error('Tenant not found.');

  const storeConfig = tenant.paidAddons?.uberEats?.stores?.find(
    (s) => s.storeId.toString() === storeId.toString()
  );
  if (!storeConfig || !storeConfig.uberStoreId) {
    throw new Error('Store is not connected to Uber Eats or missing Uber Store ID.');
  }

  const uberStoreId = storeConfig.uberStoreId;
  const currency = storeConfig.currency || tenant.paidAddons?.uberEats?.currency || 'LKR';

  // 2. Fetch all active/available MenuItems for this store
  const items = await MenuItem.find({
    tenantId,
    $or: [{ storeId: storeId }, { storeId: null }],
    available: true,
  }).lean();

  if (!items.length) {
    throw new Error('No available menu items found to sync.');
  }

  // 3. Group items by category to build the Uber Eats schema
  const categoriesMap = {};
  const uberItems = [];

  for (const item of items) {
    const catName = item.category || 'General';
    if (!categoriesMap[catName]) {
      categoriesMap[catName] = [];
    }

    const itemId = item._id.toString();
    categoriesMap[catName].push({
      id: itemId,
      type: 'ITEM',
    });

    const imageUrl = item.image || (item.images?.length > 0 ? item.images[0].url : '');

    uberItems.push({
      id: itemId,
      title: {
        translations: {
          en_us: item.name,
        },
      },
      description: {
        translations: {
          en_us: item.description || '',
        },
      },
      price_info: {
        price: Math.round(item.price * 100), // convert to minor units (e.g. cents)
        currency_code: currency,
      },
      ...(imageUrl ? { image_url: imageUrl } : {}),
    });
  }

  const uberCategories = Object.keys(categoriesMap).map((catName) => {
    const safeCatId = `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    return {
      id: safeCatId,
      title: {
        translations: {
          en_us: catName,
        },
      },
      entities: categoriesMap[catName],
    };
  });

  const serviceHours = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => ({
    day_of_week: day,
    time_periods: [{ from: '00:00', to: '24:00' }],
  }));

  const uberPayload = {
    menus: [
      {
        id: 'pos-menu-main',
        title: {
          translations: {
            en_us: 'Main Menu',
          },
        },
        service_availability: serviceHours,
        category_ids: uberCategories.map((c) => c.id),
      },
    ],
    categories: uberCategories,
    items: uberItems,
  };

  // 4. Send PUT request to Uber Eats API
  const token = await getStoreAccessToken(tenantId, storeId);
  const url = `${UBER_API_BASE_URL}/eats/stores/${uberStoreId}/menus`;

  try {
    const response = await axios.put(url, uberPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[Uber Menu Sync] Successfully pushed menu for store: ${storeId}`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`[Uber Menu Sync Error] store: ${storeId}:`, errorMsg);
    throw new Error(`Uber Menu Sync Error: ${errorMsg}`);
  }
}

module.exports = {
  syncMenuToUber,
};
