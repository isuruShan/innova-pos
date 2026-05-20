'use strict';

const express = require('express');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');
const { getPlatformContact, savePlatformContact } = require('@innovapos/platform-contact');

const router = express.Router();

router.get('/public', async (_req, res) => {
  try {
    const contact = await getPlatformContact();
    res.json(contact);
  } catch (err) {
    sendRouteError(res, err, { req: _req });
  }
});

router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const contact = await getPlatformContact();
    res.json(contact);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const contact = await savePlatformContact(req.body || {}, req.user?.id);
    res.json(contact);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
