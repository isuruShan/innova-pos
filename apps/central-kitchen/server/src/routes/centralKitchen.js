const express = require('express');
const CentralKitchen = require('../../../../../apps/admin-portal/server/src/models/CentralKitchen');
const { protect, tenantScope } = require('../middleware/auth');

const router = express.Router();

// Get or auto-initialize Central Kitchen details for the tenant
router.get('/', protect, tenantScope, async (req, res) => {
  try {
    let ck = await CentralKitchen.findOne({ tenantId: req.tenantId });
    if (!ck) {
      ck = await CentralKitchen.create({
        tenantId: req.tenantId,
        name: 'Central Kitchen Commissary',
        address: 'Main Warehouse Hub',
        phone: '',
        isActive: true,
      });
    }
    res.json(ck);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve Central Kitchen configuration', error: err.message });
  }
});

// Update Central Kitchen details
router.put('/', protect, tenantScope, async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    let ck = await CentralKitchen.findOneAndUpdate(
      { tenantId: req.tenantId },
      { name, address, phone },
      { new: true, upsert: true }
    );
    res.json(ck);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update Central Kitchen configuration', error: err.message });
  }
});

module.exports = router;
