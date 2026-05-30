const express = require('express');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const { protect, authorize, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

const router = express.Router();

// GET reconciliation report for selected date range
router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    const storeFilter = buildStoreFilter(req);

    // Get all inventory items for this store
    const inventoryItems = await Inventory.find({ tenantId: req.tenantId, ...storeFilter }).lean();

    const report = [];

    for (const item of inventoryItems) {
      // 1. Get current actual stock
      const actualStock = item.quantity;

      // 2. Get all movements AFTER the start date to work backwards and find starting stock
      const movementsAfterStart = await StockMovement.find({
        tenantId: req.tenantId,
        ...storeFilter,
        inventoryItemId: item._id,
        createdAt: { $gte: start }
      }).lean();

      const totalMovementsAfterStart = movementsAfterStart.reduce((sum, m) => sum + m.quantity, 0);
      const startingStock = actualStock - totalMovementsAfterStart;

      // 3. Get movements DURING the period
      const movementsInPeriod = await StockMovement.find({
        tenantId: req.tenantId,
        ...storeFilter,
        inventoryItemId: item._id,
        createdAt: { $gte: start, $lte: end }
      }).lean();

      let grnReceived = 0;
      let returns = 0;
      let salesConsumption = 0;
      let processingLoss = 0;
      let directWastage = 0;
      let adjustments = 0;

      for (const m of movementsInPeriod) {
        if (m.type === 'grn') {
          grnReceived += Math.abs(m.quantity);
        } else if (m.type === 'goods_return') {
          returns += m.quantity; // Negative value
        } else if (m.type === 'sale') {
          salesConsumption += m.quantity; // Negative value
        } else if (m.type === 'waste' && m.reason === 'processing_loss') {
          processingLoss += m.quantity; // Negative value
        } else if (m.type === 'waste' && m.reason !== 'processing_loss') {
          directWastage += m.quantity; // Negative value
        } else if (m.type === 'adjustment') {
          adjustments += m.quantity;
        }
      }

      // 4. Calculate theoretical stock at the end of the period
      const theoreticalStock = startingStock + grnReceived + returns + salesConsumption + processingLoss + directWastage + adjustments;

      // Variance is computed as Actual Stock - Theoretical Stock
      const variance = actualStock - theoreticalStock;
      const costPrice = item.costPrice || item.unitPrice || 0;
      const varianceValue = variance * costPrice;

      report.push({
        _id: item._id,
        itemName: item.itemName,
        sku: item.sku || '',
        unit: item.unit,
        startingStock,
        grnReceived,
        returns,
        salesConsumption,
        processingLoss,
        directWastage,
        adjustments,
        theoreticalStock,
        actualStock,
        variance,
        costPrice,
        varianceValue
      });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
