const express = require('express');
const VariantCriteria = require('../models/VariantCriteria');
const { protect, tenantScope } = require('../middleware/auth');

const router = express.Router();

// GET all criteria for tenant
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    const list = await VariantCriteria.find({ tenantId: req.tenantId }).sort({ name: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST to create or merge criteria values
router.post('/', protect, tenantScope, async (req, res) => {
  try {
    const { name, values } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const cleanName = name.trim();
    const cleanValues = (values || [])
      .map((v) => String(v || '').trim())
      .filter(Boolean);

    // Case-insensitive check for existing criteria
    let doc = await VariantCriteria.findOne({
      tenantId: req.tenantId,
      name: { $regex: new RegExp(`^${cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') },
    });

    if (doc) {
      // Merge unique values
      const merged = [...new Set([...(doc.values || []), ...cleanValues])];
      doc.values = merged;
      doc.updatedBy = req.user.id;
      await doc.save();
    } else {
      doc = await VariantCriteria.create({
        tenantId: req.tenantId,
        name: cleanName,
        values: cleanValues,
        createdBy: req.user.id,
      });
    }
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
