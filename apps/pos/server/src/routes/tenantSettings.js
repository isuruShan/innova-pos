const express = require('express');
const axios = require('axios');
const { authenticateJWT, tenantScope } = require('@innovapos/shared-middleware');

const router = express.Router();

/**
 * GET /tenant-settings — proxy to admin-portal-server for tenant branding
 * Returns only public-safe fields (no internal admin data).
 */
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const adminUrl = process.env.ADMIN_PORTAL_URL || 'http://localhost:5001';
    const { data } = await axios.get(`${adminUrl}/api/tenant-settings`, {
      headers: { Authorization: req.headers.authorization },
      timeout: 5000,
    });

    // Expose only POS-relevant branding fields
    const safe = {
      businessName: data.businessName,
      tagline: data.tagline,
      logoUrl: data.logoUrl,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      sidebarColor: data.sidebarColor,
      textColor: data.textColor,
      paymentMethods: data.paymentMethods,
      currency: data.currency,
      currencySymbol: data.currencySymbol,
      timezone: data.timezone,
      receiptFooter: data.receiptFooter,
      receiptHeader: data.receiptHeader,
      printReceiptByDefault: data.printReceiptByDefault,
    };

    res.json(safe);
  } catch (err) {
    // Return defaults if admin service is unreachable
    res.json({
      businessName: 'InnovaPOS',
      logoUrl: '',
      primaryColor: '#1a1a2e',
      accentColor: '#e94560',
      sidebarColor: '#16213e',
      textColor: '#ffffff',
      paymentMethods: ['cash', 'card'],
      currency: 'LKR',
      currencySymbol: 'Rs.',
      receiptFooter: 'Thank you for your visit!',
      printReceiptByDefault: false,
    });
  }
});

module.exports = router;
