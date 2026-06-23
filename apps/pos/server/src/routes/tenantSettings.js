const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { authenticateJWT, authorize, tenantScope } = require('@innovapos/shared-middleware');

const router = express.Router();

const THEME_FIELDS = [
  'themePresetId',
  'themePresetName',
  'themeBaseColor',
  'bodyColor',
  'headerBarColor',
  'buttonColor',
  'selectionHighlightColor',
  'hoverColor',
  'buttonTextColor',
  'headerBarTextColor',
  'bodyTextColor',
  'primaryColor',
  'accentColor',
  'sidebarColor',
  'textColor',
  'selectionTextColor',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const getAdminUrl = () => process.env.ADMIN_PORTAL_URL || 'http://localhost:5001';

// GET /tenant-settings — proxy to admin-portal-server for tenant branding
router.get('/', authenticateJWT, tenantScope, async (req, res) => {
  try {
    const adminUrl = getAdminUrl();
    const { data } = await axios.get(`${adminUrl}/api/tenant-settings`, {
      headers: { Authorization: req.headers.authorization },
      timeout: 5000,
    });

    const safe = {
      tenantId: req.tenantId,
      businessName: data.businessName,
      logoUrl: data.logoUrl,
      customerTerminalBgUrl: data.customerTerminalBgUrl,
      customerTerminalBgKey: data.customerTerminalBgKey,
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
      returnsEnabled: Boolean(data.returnsEnabled),
      returnsRequireManagerApproval: data.returnsRequireManagerApproval !== false,
      customerOtpVerificationEnabled: Boolean(data.customerOtpVerificationEnabled),
      inventoryCostingMethod: data.inventoryCostingMethod || 'wac',
      smsGatewayAllowed: Boolean(data.smsGatewayAllowed),
    };

    for (const key of THEME_FIELDS) {
      if (data[key] != null && data[key] !== '') safe[key] = data[key];
    }

    res.json(safe);
  } catch (err) {
    res.json({
      businessName: 'Cafinity',
      logoUrl: '',
      themePresetId: 'default',
      themeBaseColor: '#0B1220',
      bodyColor: '#0B1220',
      headerBarColor: '#151F2E',
      buttonColor: '#E94560',
      selectionHighlightColor: '#2A3548',
      hoverColor: '#F06B82',
      buttonTextColor: '#F8FAFC',
      headerBarTextColor: '#F8FAFC',
      bodyTextColor: '#E2E8F0',
      primaryColor: '#0B1220',
      accentColor: '#e94560',
      sidebarColor: '#16213e',
      textColor: '#E2E8F0',
      selectionTextColor: '#ffffff',
      paymentMethods: ['cash', 'card'],
      currency: 'LKR',
      currencySymbol: 'Rs.',
      countryIso: 'LK',
      receiptFooter: 'Thank you for your visit!',
      printReceiptByDefault: false,
      receiptPrintAtStatus: 'placement',
      receiptPrintAtByOrderType: null,
      inventoryCostingMethod: 'wac',
    });
  }
});

// PUT /tenant-settings — proxy to admin-portal-server
router.put('/', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const adminUrl = getAdminUrl();
    const { data } = await axios.put(`${adminUrl}/api/tenant-settings`, req.body, {
      headers: { Authorization: req.headers.authorization }
    });
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.message;
    res.status(status).json({ message: msg });
  }
});

// POST /tenant-settings/terminal-bg — proxy image upload to admin-portal-server
router.post('/terminal-bg', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope,
  upload.single('terminalBg'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const adminUrl = getAdminUrl();
      const fd = new FormData();
      fd.append('terminalBg', req.file.buffer, {
        filename: req.file.originalname || 'terminalBg.webp',
        contentType: req.file.mimetype
      });

      const { data } = await axios.post(`${adminUrl}/api/tenant-settings/terminal-bg`, fd, {
        headers: {
          ...fd.getHeaders(),
          Authorization: req.headers.authorization
        }
      });
      res.json(data);
    } catch (err) {
      const status = err.response?.status || 500;
      const msg = err.response?.data?.message || err.message;
      res.status(status).json({ message: msg });
    }
  }
);

// DELETE /tenant-settings/terminal-bg — proxy to admin-portal-server
router.delete('/terminal-bg', authenticateJWT, authorize('merchant_admin', 'superadmin'), tenantScope, async (req, res) => {
  try {
    const adminUrl = getAdminUrl();
    const { data } = await axios.delete(`${adminUrl}/api/tenant-settings/terminal-bg`, {
      headers: { Authorization: req.headers.authorization }
    });
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.message;
    res.status(status).json({ message: msg });
  }
});

module.exports = router;
