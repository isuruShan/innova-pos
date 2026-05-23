'use strict';

const express = require('express');
const PlatformUberSettings = require('../models/PlatformUberSettings');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

async function getOrCreateSettings() {
  let doc = await PlatformUberSettings.findOne({ singletonKey: 'default' });
  if (!doc) {
    doc = await PlatformUberSettings.create({ singletonKey: 'default' });
  }
  return doc;
}

// GET platform-wide settings
router.get('/settings', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json({
      clientId: doc.clientId || '',
      redirectUri: doc.redirectUri || '',
      environment: doc.environment || 'sandbox',
      clientSecretSet: doc.clientSecretSet || false,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT platform-wide settings
router.put('/settings', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const { clientId, clientSecret, redirectUri, environment } = req.body || {};

    if (clientId !== undefined) doc.clientId = String(clientId).trim();
    if (redirectUri !== undefined) doc.redirectUri = String(redirectUri).trim();
    if (environment !== undefined) doc.environment = environment;

    if (clientSecret) {
      doc.clientSecret = String(clientSecret).trim();
      doc.clientSecretSet = true;
    }

    doc.updatedBy = req.user.id;
    await doc.save();

    res.json({
      clientId: doc.clientId,
      redirectUri: doc.redirectUri,
      environment: doc.environment,
      clientSecretSet: doc.clientSecretSet,
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
