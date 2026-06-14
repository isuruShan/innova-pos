const express = require('express');
const ScheduledBanner = require('../models/ScheduledBanner');
const Tenant = require('../models/Tenant');
const { authenticateJWT, authorize, sendRouteError } = require('@innovapos/shared-middleware');

const router = express.Router();

// GET /api/scheduled-banners/active — get active banners for current user's tenant (authenticated)
router.get('/active', authenticateJWT, async (req, res) => {
  try {
    const { platform } = req.query;
    if (!platform) {
      return res.status(400).json({ message: 'platform query parameter is required' });
    }

    let isTrial = false;
    if (req.user.tenantId) {
      const tenant = await Tenant.findById(req.user.tenantId).lean();
      isTrial = !!(tenant && tenant.status === 'active' && tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date() <= new Date(tenant.trialEndsAt));
    }

    const now = new Date();
    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      platforms: platform,
      userTypes: req.user.role,
    };

    // If tenant is not in trial, filter out banners that are showForTrialOnly: true
    if (!isTrial && req.user.role !== 'superadmin') {
      query.showForTrialOnly = false;
    }

    const banners = await ScheduledBanner.find(query).lean();
    res.json(banners);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// GET /api/scheduled-banners — list all banners (superadmin only)
router.get('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const banners = await ScheduledBanner.find().sort({ createdAt: -1 }).lean();
    res.json(banners);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// POST /api/scheduled-banners — create a new banner (superadmin only)
router.post('/', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { title, content, userTypes, platforms, startDate, endDate, isActive, showForTrialOnly } = req.body;
    const banner = await ScheduledBanner.create({
      title,
      content,
      userTypes,
      platforms,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      showForTrialOnly: showForTrialOnly !== undefined ? Boolean(showForTrialOnly) : true,
    });
    res.status(201).json(banner);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// PUT /api/scheduled-banners/:id — update a banner (superadmin only)
router.put('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const { title, content, userTypes, platforms, startDate, endDate, isActive, showForTrialOnly } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;
    if (userTypes !== undefined) update.userTypes = userTypes;
    if (platforms !== undefined) update.platforms = platforms;
    if (startDate !== undefined) update.startDate = new Date(startDate);
    if (endDate !== undefined) update.endDate = new Date(endDate);
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (showForTrialOnly !== undefined) update.showForTrialOnly = Boolean(showForTrialOnly);

    const banner = await ScheduledBanner.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json(banner);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// DELETE /api/scheduled-banners/:id — delete a banner (superadmin only)
router.delete('/:id', authenticateJWT, authorize('superadmin'), async (req, res) => {
  try {
    const banner = await ScheduledBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });
    res.json({ message: 'Banner deleted successfully' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
