'use strict';

const axios = require('axios');
const mongoose = require('mongoose');
const { isWhatsappEffective } = require('@innovapos/paid-addons');

/**
 * Syncs a single menu item with Meta catalog if WhatsApp add-on is active.
 * Uses updateOne to avoid recursive trigger loops.
 */
async function syncCatalogItem(menuItem) {
  try {
    const Tenant = mongoose.model('Tenant');
    const Store = mongoose.model('Store');

    // 1. Resolve tenant and check paid entitlement
    const tenant = await Tenant.findById(menuItem.tenantId).select('paidAddons').lean();
    if (!tenant || !isWhatsappEffective(tenant.paidAddons)) {
      // Entitlement not active; skip synchronization silently
      return;
    }

    // 2. Resolve active store settings
    const store = await Store.findById(menuItem.storeId || menuItem.storeIds?.[0]).lean();
    if (!store || !store.whatsappSettings?.catalogId || !store.whatsappSettings?.accessToken) {
      // Configuration not set; skip
      return;
    }

    const { catalogId, accessToken } = store.whatsappSettings;
    const url = `https://graph.facebook.com/v21.0/${catalogId}/items_batch`;

    const isFeatured = menuItem.whatsappSync?.featured !== false;

    if (!isFeatured) {
      // Delete from catalog
      try {
        await axios.post(url, {
          requests: [
            {
              method: 'DELETE',
              retailer_id: menuItem._id.toString()
            }
          ]
        }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Update DB without triggering pre/post save hooks
        await mongoose.model('MenuItem').updateOne(
          { _id: menuItem._id },
          { 
            $set: { 
              'whatsappSync.whatsappProductId': '',
              'whatsappSync.lastSyncedAt': new Date() 
            } 
          }
        );
        console.log(`[Meta Sync] Item ${menuItem.name} successfully deleted from WhatsApp catalog.`);
      } catch (err) {
        console.error(`[Meta Sync Delete Error] Failed for item ${menuItem._id}:`, err.response?.data || err.message);
      }
    } else {
      // Add / Update in catalog
      const imageUrl = menuItem.image || menuItem.images?.[0]?.url || 'https://placehold.co/600x400';
      
      try {
        await axios.post(url, {
          requests: [
            {
              method: 'CREATE',
              retailer_id: menuItem._id.toString(),
              data: {
                name: menuItem.name,
                description: menuItem.description || menuItem.name,
                price: Math.round(menuItem.price * 100), // Standard format (cents/cents equivalent)
                currency: store.currency || 'LKR',
                availability: menuItem.available ? 'in stock' : 'out of stock',
                image_url: imageUrl
              }
            }
          ]
        }, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Update DB
        await mongoose.model('MenuItem').updateOne(
          { _id: menuItem._id },
          { 
            $set: { 
              'whatsappSync.whatsappProductId': menuItem._id.toString(),
              'whatsappSync.lastSyncedAt': new Date() 
            } 
          }
        );
        console.log(`[Meta Sync] Item ${menuItem.name} successfully updated in WhatsApp catalog.`);
      } catch (err) {
        console.error(`[Meta Sync Create/Update Error] Failed for item ${menuItem._id}:`, err.response?.data || err.message);
      }
    }
  } catch (err) {
    console.error(`[Meta Sync Outer Error] Failed for item ${menuItem?._id}:`, err.message);
  }
}

module.exports = {
  syncCatalogItem
};
