const express = require('express');
const CashierDraft = require('../models/CashierDraft');
const { protect, tenantScope } = require('../middleware/auth');

const router = express.Router();

// GET cashier drafts for a store
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: 'storeId is required' });
    }
    const draft = await CashierDraft.findOne({
      tenantId: req.tenantId,
      storeId,
      userId: req.user._id,
    });
    res.json(draft || { drafts: [], activeDraftId: '', updatedAtMs: 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST save/upsert cashier drafts for a store
router.post('/', protect, tenantScope, async (req, res) => {
  try {
    const { storeId, activeDraftId, drafts, updatedAtMs } = req.body;
    if (!storeId || !activeDraftId || !Array.isArray(drafts)) {
      return res.status(400).json({ message: 'Invalid draft payload' });
    }
    const timestamp = Number(updatedAtMs) || Date.now();
    const draft = await CashierDraft.findOneAndUpdate(
      {
        tenantId: req.tenantId,
        storeId,
        userId: req.user._id,
      },
      {
        $set: {
          activeDraftId,
          drafts,
          updatedAtMs: timestamp,
        },
      },
      { upsert: true, new: true }
    );
    res.json(draft);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
