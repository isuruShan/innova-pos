const express = require('express');
const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const IngredientLink = require('../models/IngredientLink');
const StockMovement = require('../models/StockMovement');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { parseSortQuery } = require('../lib/listPagination');

const router = express.Router();

router.get('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const sort = parseSortQuery(req, {
      name: 'itemName',
      quantity: 'quantity',
      createdAt: 'createdAt',
    }, { itemName: 1 });
    const items = await Inventory.find({ tenantId: req.tenantId, ...buildStoreFilter(req) })
      .sort(sort)
      .populate('suppliers', 'name phone email');
    res.json(items);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    if (!storeId) return res.status(400).json({ message: 'No store available for inventory item creation' });
    const item = await Inventory.create({ ...req.body, quantity: 0, tenantId: req.tenantId, storeId, createdBy: req.user.id });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.quantity; // Direct modification of quantity is not allowed
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { ...updateData, lastUpdated: Date.now(), updatedBy: req.user.id },
      { new: true, runValidators: true }
    ).populate('suppliers', 'name phone email');
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    return res.status(403).json({ message: 'Deleting inventory items is not allowed.' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

/**
 * GET /inventory/consumption-report?from=&to=
 * Calculate theoretical ingredient consumption based on completed orders
 */
router.get('/consumption-report', protect, authorize('manager', 'merchant_admin', 'superadmin'), tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: 'from and to dates are required' });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // Include full end day

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const storeFilter = buildStoreFilter(req);

    // Get completed orders in date range
    const orders = await Order.find({
      tenantId: req.tenantId,
      ...storeFilter,
      status: { $in: ['completed', 'served'] },
      createdAt: { $gte: fromDate, $lte: toDate },
    }).lean();

    // Collect all menu items from orders
    const menuItemIds = new Set();
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (item.menuItem) menuItemIds.add(item.menuItem.toString());
      });
    });

    if (menuItemIds.size === 0) {
      return res.json({
        period: { from, to },
        items: [],
        summary: {
          totalItems: 0,
          totalOrders: orders.length,
          itemsWithVariance: 0,
        }
      });
    }

    // Get ingredient links for these menu items
    const ingredientLinks = await IngredientLink.find({
      tenantId: req.tenantId,
      ...storeFilter,
      menuItemId: { $in: Array.from(menuItemIds) },
    }).populate('inventoryItemId', 'itemName unit quantity minThreshold').lean();

    // Build map: menuItemId + variantId -> [ingredientLinks]
    const linkMap = {};
    ingredientLinks.forEach(link => {
      const key = `${link.menuItemId}:${link.variantId || ''}`;
      if (!linkMap[key]) linkMap[key] = [];
      linkMap[key].push(link);
    });

    // Calculate theoretical consumption per inventory item
    const consumptionMap = {}; // inventoryItemId -> { item, totalUsage }

    orders.forEach(order => {
      order.items?.forEach(orderItem => {
        const menuItemId = orderItem.menuItem?.toString();
        const variantId = orderItem.variantId?.toString() || '';
        const key = `${menuItemId}:${variantId}`;
        const links = linkMap[key] || [];

        links.forEach(link => {
          const invId = link.inventoryItemId._id.toString();
          if (!consumptionMap[invId]) {
            consumptionMap[invId] = {
              item: link.inventoryItemId,
              totalUsage: 0,
            };
          }
          consumptionMap[invId].totalUsage += link.quantity * (orderItem.qty || 0);
        });
      });
    });

    // Get current inventory items
    const inventoryIds = Object.keys(consumptionMap);
    if (inventoryIds.length === 0) {
      return res.json({
        period: { from, to },
        items: [],
        summary: {
          totalItems: 0,
          totalOrders: orders.length,
          itemsWithVariance: 0,
        }
      });
    }

    const currentInventory = await Inventory.find({
      _id: { $in: inventoryIds },
      tenantId: req.tenantId,
      ...storeFilter,
    }).lean();

    // Filter out items that did not exist yet during the selected period
    const validInventory = currentInventory.filter(inv => {
      const createdAt = new Date(inv.createdAt);
      return createdAt <= toDate;
    });

    if (validInventory.length === 0) {
      return res.json({
        period: { from, to },
        items: [],
        summary: {
          totalItems: 0,
          totalOrders: orders.length,
          itemsWithVariance: 0,
        }
      });
    }

    const validInventoryIds = validInventory.map(inv => inv._id.toString());
    const inventoryById = {};
    validInventory.forEach(inv => {
      inventoryById[inv._id.toString()] = inv;
    });

    // Get stock movements from fromDate onwards (until now) to calculate starting stock and stock at toDate
    const movements = await StockMovement.find({
      tenantId: req.tenantId,
      ...storeFilter,
      inventoryItemId: { $in: validInventoryIds },
      createdAt: { $gte: fromDate },
    }).lean();

    // Calculate sum of movements after fromDate and after toDate
    const movementSumAfterStart = {};
    const movementSumAfterEnd = {};
    movements.forEach(mov => {
      const invId = mov.inventoryItemId.toString();
      const movDate = new Date(mov.createdAt);
      
      movementSumAfterStart[invId] = (movementSumAfterStart[invId] || 0) + mov.quantity;
      if (movDate > toDate) {
        movementSumAfterEnd[invId] = (movementSumAfterEnd[invId] || 0) + mov.quantity;
      }
    });

    // Build report items
    const reportItems = validInventoryIds.map(invId => {
      const consumption = consumptionMap[invId];
      const currentInv = inventoryById[invId];
      const currentStock = currentInv?.quantity || 0;
      
      const sumAfterStart = movementSumAfterStart[invId] || 0;
      const sumAfterEnd = movementSumAfterEnd[invId] || 0;

      // Starting stock is: current - (all movements since fromDate)
      // But if the item was created after fromDate, it didn't exist yet at the start
      let startingStock = currentStock - sumAfterStart;
      if (currentInv && new Date(currentInv.createdAt) > fromDate) {
        startingStock = 0;
      }

      // Stock at the end of the period (toDate) is: current - (all movements after toDate)
      const periodEndStock = currentStock - sumAfterEnd;

      const expectedStock = startingStock - consumption.totalUsage;
      const variance = periodEndStock - expectedStock;

      return {
        inventoryItemId: invId,
        itemName: consumption.item.itemName,
        unit: consumption.item.unit,
        theoreticalUsage: Math.round(consumption.totalUsage * 100) / 100,
        startingStock: Math.round(startingStock * 100) / 100,
        currentStock: Math.round(periodEndStock * 100) / 100, // Show period-end stock as "current stock" in report
        expectedStock: Math.round(expectedStock * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePercentage: startingStock > 0 
          ? Math.round((variance / startingStock) * 10000) / 100 
          : 0,
      };
    });

    // Sort by highest absolute variance
    reportItems.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    res.json({
      period: { from, to },
      items: reportItems,
      summary: {
        totalItems: reportItems.length,
        totalOrders: orders.length,
        itemsWithVariance: reportItems.filter(i => Math.abs(i.variance) > 0.1).length,
      },
    });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
