const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const { protect, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter } = require('../middleware/storeScope');

/**
 * GET /purchase-orders
 * List all purchase orders with optional filters
 */
router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { status, supplierId, from, to } = req.query;
    const { tenantId, storeId } = req;

    const filter = { tenantId, storeId };
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const orders = await PurchaseOrder.find(filter)
      .populate('supplierId', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

/**
 * GET /purchase-orders/:id
 * Get single purchase order by ID
 */
router.get('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    })
      .populate('supplierId', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('sentBy', 'name email');

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

/**
 * POST /purchase-orders
 * Create new purchase order
 */
router.post('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const { supplierId, items, expectedDate, notes } = req.body;

    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and items are required' });
    }

    // Verify supplier exists
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId, storeId });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Validate items and get inventory details
    const validatedItems = [];
    for (const item of items) {
      const invItem = await Inventory.findOne({
        _id: item.inventoryItemId,
        tenantId,
        storeId,
      });
      if (!invItem) {
        return res.status(404).json({ error: `Inventory item ${item.inventoryItemId} not found` });
      }
      validatedItems.push({
        inventoryItemId: invItem._id,
        itemName: invItem.name,
        unit: invItem.unit,
        orderedQty: Number(item.orderedQty) || 0,
        receivedQty: 0,
        unitPrice: Number(item.unitPrice) || 0,
      });
    }

    // Calculate total amount
    const totalAmount = validatedItems.reduce(
      (sum, item) => sum + item.orderedQty * item.unitPrice,
      0
    );

    // Generate order number: PO-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await PurchaseOrder.countDocuments({
      tenantId,
      storeId,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const orderNumber = `PO-${today}-${String(countToday + 1).padStart(4, '0')}`;

    const order = new PurchaseOrder({
      tenantId,
      storeId,
      orderNumber,
      supplierId,
      items: validatedItems,
      status: 'draft',
      totalAmount,
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes: notes || '',
      createdBy: req.user.id,
    });

    await order.save();
    await order.populate('supplierId', 'name email phone');
    await order.populate('createdBy', 'name email');

    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

/**
 * PUT /purchase-orders/:id
 * Update purchase order (only if draft or sent status)
 */
router.put('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const { supplierId, items, expectedDate, notes, status } = req.body;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Only draft and sent orders can be edited
    if (!['draft', 'sent'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot edit completed, partial, or cancelled orders' });
    }

    // Update supplier if provided
    if (supplierId && supplierId !== String(order.supplierId)) {
      const supplier = await Supplier.findOne({ _id: supplierId, tenantId, storeId });
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      order.supplierId = supplierId;
    }

    // Update items if provided
    if (items && items.length > 0) {
      const validatedItems = [];
      for (const item of items) {
        const invItem = await Inventory.findOne({
          _id: item.inventoryItemId,
          tenantId,
          storeId,
        });
        if (!invItem) {
          return res.status(404).json({ error: `Inventory item ${item.inventoryItemId} not found` });
        }
        validatedItems.push({
          inventoryItemId: invItem._id,
          itemName: invItem.name,
          unit: invItem.unit,
          orderedQty: Number(item.orderedQty) || 0,
          receivedQty: Number(item.receivedQty) || 0,
          unitPrice: Number(item.unitPrice) || 0,
        });
      }
      order.items = validatedItems;
      order.totalAmount = validatedItems.reduce(
        (sum, item) => sum + item.orderedQty * item.unitPrice,
        0
      );
    }

    if (expectedDate !== undefined) order.expectedDate = expectedDate ? new Date(expectedDate) : null;
    if (notes !== undefined) order.notes = notes;
    if (status && ['draft', 'cancelled'].includes(status)) order.status = status;

    await order.save();
    await order.populate('supplierId', 'name email phone');
    await order.populate('createdBy', 'name email');
    await order.populate('sentBy', 'name email');

    res.json(order);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

/**
 * POST /purchase-orders/:id/send
 * Mark purchase order as sent
 */
router.post('/:id/send', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be sent' });
    }

    order.status = 'sent';
    order.sentAt = new Date();
    order.sentBy = req.user.id;

    await order.save();
    await order.populate('supplierId', 'name email phone');
    await order.populate('createdBy', 'name email');
    await order.populate('sentBy', 'name email');

    res.json(order);
  } catch (error) {
    console.error('Error sending purchase order:', error);
    res.status(500).json({ error: 'Failed to send purchase order' });
  }
});

/**
 * DELETE /purchase-orders/:id
 * Delete purchase order (only if draft)
 */
router.delete('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }

    await order.deleteOne();
    res.json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

/**
 * GET /purchase-orders/suggestions/low-stock
 * Get suggested items for purchase (below minimum threshold)
 */
router.get('/suggestions/low-stock', protect, tenantScope, async (req, res) => {
  try {
    const { tenantId, storeId } = req;

    const lowStockItems = await Inventory.find({
      tenantId,
      storeId,
      $expr: { $lte: ['$quantity', '$minThreshold'] },
    }).sort({ quantity: 1 });

    const suggestions = lowStockItems.map((item) => ({
      inventoryItemId: item._id,
      itemName: item.name,
      unit: item.unit,
      currentQty: item.quantity,
      minThreshold: item.minThreshold,
      suggestedQty: Math.max(item.minThreshold * 2 - item.quantity, 10),
      unitPrice: 0,
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Error fetching low stock suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
