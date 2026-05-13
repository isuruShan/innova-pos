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
      selectionTextColor: data.selectionTextColor || '#ffffff',
      paymentMethods: data.paymentMethods,
      currency: data.currency,
      currencySymbol: data.currencySymbol,
      timezone: data.timezone,
      countryIso: data.countryIso || 'LK',
      receiptFooter: data.receiptFooter,
      receiptHeader: data.receiptHeader,
      printReceiptByDefault: data.printReceiptByDefault,
      receiptPrintAtStatus: data.receiptPrintAtStatus || 'placement',
      receiptPrintAtByOrderType: data.receiptPrintAtByOrderType || null,
    };

    res.json(safe);
  } catch (err) {
    // Return defaults if admin service is unreachable
    res.json({
      businessName: 'Cafinity',
      logoUrl: '',
      primaryColor: '#1a1a2e',
      accentColor: '#e94560',
      sidebarColor: '#16213e',
      textColor: '#ffffff',
      selectionTextColor: '#ffffff',
      paymentMethods: ['cash', 'card'],
      currency: 'LKR',
      currencySymbol: 'Rs.',
      countryIso: 'LK',
      receiptFooter: 'Thank you for your visit!',
      printReceiptByDefault: false,
      receiptPrintAtStatus: 'placement',
      receiptPrintAtByOrderType: null,
    });
  }
});

module.exports = router;
