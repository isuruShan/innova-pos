const express = require('express');
const router = express.Router();
const GoodsReceipt = require('../models/GoodsReceipt');
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { protect, tenantScope } = require('../middleware/auth');
const { recalculateInventoryCosts } = require('../utils/costCalculation');
const { resolveSelectedStore, buildStoreFilter, blockIfRetailStoreUnderCentralKitchen } = require('../middleware/storeScope');

/**
 * GET /goods-receipts
 * List all goods receipts with optional filters
 */
router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { type, status, supplierId, purchaseOrderId, from, to } = req.query;
    const { tenantId, storeId } = req;

    const filter = { tenantId, storeId };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (supplierId) filter.supplierId = supplierId;
    if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
    if (from || to) {
      filter.receiptDate = {};
      if (from) filter.receiptDate.$gte = new Date(from);
      if (to) filter.receiptDate.$lte = new Date(to);
    }

    const receipts = await GoodsReceipt.find(filter)
      .populate('supplierId', 'name email phone')
      .populate('purchaseOrderId', 'orderNumber')
      .populate('createdBy', 'name email')
      .populate('confirmedBy', 'name email')
      .sort({ receiptDate: -1, createdAt: -1 });

    res.json(receipts);
  } catch (error) {
    console.error('Error fetching goods receipts:', error);
    res.status(500).json({ error: 'Failed to fetch goods receipts' });
  }
});

/**
 * GET /goods-receipts/:id
 * Get single goods receipt by ID
 */
router.get('/:id', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    })
      .populate('supplierId', 'name email phone')
      .populate('purchaseOrderId', 'orderNumber items')
      .populate('createdBy', 'name email')
      .populate('confirmedBy', 'name email');

    if (!receipt) {
      return res.status(404).json({ error: 'Goods receipt not found' });
    }

    res.json(receipt);
  } catch (error) {
    console.error('Error fetching goods receipt:', error);
    res.status(500).json({ error: 'Failed to fetch goods receipt' });
  }
});

/**
 * POST /goods-receipts
 * Create new goods receipt (draft)
 */
router.post('/', protect, tenantScope, resolveSelectedStore, blockIfRetailStoreUnderCentralKitchen, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const { type, purchaseOrderId, supplierId, items, receiptDate, notes, returnReason } = req.body;

    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and items are required' });
    }

    if (!['receipt', 'return'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "receipt" or "return"' });
    }

    // Verify supplier exists
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId, storeId });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Verify purchase order if provided
    let purchaseOrder = null;
    if (purchaseOrderId) {
      purchaseOrder = await PurchaseOrder.findOne({
        _id: purchaseOrderId,
        tenantId,
        storeId,
      });
      if (!purchaseOrder) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }
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

      const validatedItem = {
        inventoryItemId: invItem._id,
        itemName: invItem.itemName,
        unit: invItem.unit,
        orderedQty: Number(item.orderedQty) || 0,
        receivedQty: Number(item.receivedQty) || 0,
        acceptedQty: type === 'receipt' ? Number(item.acceptedQty) || 0 : 0,
        rejectedQty: type === 'receipt' ? Number(item.rejectedQty) || 0 : 0,
        unitPrice: Number(item.unitPrice) || 0,
        rejectionReason: item.rejectionReason || '',
      };

      validatedItems.push(validatedItem);
    }

    if (receiptDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (new Date(receiptDate) > today) {
        return res.status(400).json({ error: 'Receipt/Return Date cannot be in the future' });
      }
    }

    // Calculate total amount (based on accepted qty for receipts, received qty for returns)
    const totalAmount = validatedItems.reduce((sum, item) => {
      const qty = type === 'receipt' ? item.acceptedQty : item.receivedQty;
      return sum + qty * item.unitPrice;
    }, 0);

    // Generate receipt number: GRN-YYYYMMDD-XXXX or GR-YYYYMMDD-XXXX
    const prefix = type === 'receipt' ? 'GRN' : 'GR';
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await GoodsReceipt.countDocuments({
      tenantId,
      storeId,
      type,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const receiptNumber = `${prefix}-${today}-${String(countToday + 1).padStart(4, '0')}`;

    const receipt = new GoodsReceipt({
      tenantId,
      storeId,
      receiptNumber,
      type,
      purchaseOrderId: purchaseOrderId || null,
      supplierId,
      items: validatedItems,
      status: 'draft',
      totalAmount,
      receiptDate: receiptDate ? new Date(receiptDate) : new Date(),
      notes: notes || '',
      returnReason: type === 'return' ? (returnReason || '') : '',
      createdBy: req.user.id,
    });

    await receipt.save();
    await receipt.populate('supplierId', 'name email phone');
    await receipt.populate('purchaseOrderId', 'orderNumber');
    await receipt.populate('createdBy', 'name email');

    res.status(201).json(receipt);
  } catch (error) {
    console.error('Error creating goods receipt:', error);
    res.status(500).json({ error: 'Failed to create goods receipt' });
  }
});

/**
 * POST /goods-receipts/:id/confirm
 * Confirm goods receipt and update inventory + stock movements + PO status
 */
router.post('/:id/confirm', protect, tenantScope, resolveSelectedStore, blockIfRetailStoreUnderCentralKitchen, async (req, res) => {
  try {
    const { tenantId, storeId } = req;

    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Goods receipt not found' });
    }

    if (receipt.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft receipts can be confirmed' });
    }

    // Start processing items
    for (const item of receipt.items) {
      const invItem = await Inventory.findOne({
        _id: item.inventoryItemId,
        tenantId,
        storeId,
      });

      if (!invItem) {
        return res.status(404).json({ error: `Inventory item ${item.inventoryItemId} not found` });
      }

      const previousQty = invItem.quantity;
      let quantityChange = 0;
      let movementType = '';

      if (receipt.type === 'receipt') {
        // Add accepted quantity to inventory
        quantityChange = item.acceptedQty;
        movementType = 'grn';
        invItem.quantity += quantityChange;
      } else if (receipt.type === 'return') {
        // Subtract received quantity from inventory
        quantityChange = -item.receivedQty;
        movementType = 'goods_return';
        invItem.quantity += quantityChange; // adding negative value = subtraction
        
        if (invItem.quantity < 0) {
          return res.status(400).json({ 
            error: `Insufficient stock for ${item.itemName}. Current: ${previousQty}, Return: ${item.receivedQty}` 
          });
        }
      }

      await invItem.save();

      // Create stock movement
      const movement = new StockMovement({
        tenantId,
        storeId,
        inventoryItemId: item.inventoryItemId,
        type: movementType,
        quantity: quantityChange,
        previousQty: previousQty,
        newQty: invItem.quantity,
        reason: receipt.type === 'receipt' ? 'received' : 'returned',
        notes: receipt.notes || (receipt.type === 'return' ? receipt.returnReason : ''),
        purchaseOrderId: receipt.purchaseOrderId || null,
        goodsReceiptId: receipt._id,
        createdBy: req.user.id,
      });

      await movement.save();
    }

    // Update purchase order if linked
    if (receipt.purchaseOrderId) {
      const po = await PurchaseOrder.findOne({
        _id: receipt.purchaseOrderId,
        tenantId,
        storeId,
      });

      if (po) {
        // Update received quantities in PO items
        for (const receiptItem of receipt.items) {
          const poItem = po.items.find(
            (pi) => String(pi.inventoryItemId) === String(receiptItem.inventoryItemId)
          );
          if (poItem) {
            if (receipt.type === 'receipt') {
              poItem.receivedQty += receiptItem.acceptedQty;
            }
          }
        }

        // Determine PO status
        const allFullyReceived = po.items.every((pi) => pi.receivedQty >= pi.orderedQty);
        const someReceived = po.items.some((pi) => pi.receivedQty > 0);

        if (allFullyReceived) {
          po.status = 'completed';
        } else if (someReceived) {
          po.status = 'partial';
        }

        await po.save();
      }
    }

    // Mark receipt as confirmed
    receipt.status = 'confirmed';
    receipt.confirmedAt = new Date();
    receipt.confirmedBy = req.user.id;

    await receipt.save();
    await receipt.populate('supplierId', 'name email phone');
    await receipt.populate('purchaseOrderId', 'orderNumber');
    await receipt.populate('createdBy', 'name email');
    await receipt.populate('confirmedBy', 'name email');

    // Run cost recalculation in background for all items in the receipt
    const itemIds = receipt.items.map((i) => i.inventoryItemId);
    recalculateInventoryCosts(tenantId, storeId, itemIds).catch((err) => {
      console.error('Background cost calculation error:', err);
    });

    res.json(receipt);
  } catch (error) {
    console.error('Error confirming goods receipt:', error);
    res.status(500).json({ error: 'Failed to confirm goods receipt' });
  }
});

/**
 * PUT /goods-receipts/:id
 * Update goods receipt (only if draft)
 */
router.put('/:id', protect, tenantScope, resolveSelectedStore, blockIfRetailStoreUnderCentralKitchen, async (req, res) => {
  try {
    const { tenantId, storeId } = req;
    const { items, receiptDate, notes, returnReason } = req.body;

    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Goods receipt not found' });
    }

    if (receipt.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft receipts can be edited' });
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
          itemName: invItem.itemName,
          unit: invItem.unit,
          orderedQty: Number(item.orderedQty) || 0,
          receivedQty: Number(item.receivedQty) || 0,
          acceptedQty: Number(item.acceptedQty) || 0,
          rejectedQty: Number(item.rejectedQty) || 0,
          unitPrice: Number(item.unitPrice) || 0,
          rejectionReason: item.rejectionReason || '',
        });
      }
      receipt.items = validatedItems;

      // Recalculate total amount
      receipt.totalAmount = validatedItems.reduce((sum, item) => {
        const qty = receipt.type === 'receipt' ? item.acceptedQty : item.receivedQty;
        return sum + qty * item.unitPrice;
      }, 0);
    }

    if (receiptDate !== undefined) {
      if (receiptDate) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (new Date(receiptDate) > today) {
          return res.status(400).json({ error: 'Receipt/Return Date cannot be in the future' });
        }
      }
      receipt.receiptDate = new Date(receiptDate);
    }
    if (notes !== undefined) receipt.notes = notes;
    if (returnReason !== undefined && receipt.type === 'return') receipt.returnReason = returnReason;

    await receipt.save();
    await receipt.populate('supplierId', 'name email phone');
    await receipt.populate('purchaseOrderId', 'orderNumber');
    await receipt.populate('createdBy', 'name email');

    res.json(receipt);
  } catch (error) {
    console.error('Error updating goods receipt:', error);
    res.status(500).json({ error: 'Failed to update goods receipt' });
  }
});

/**
 * DELETE /goods-receipts/:id
 * Delete goods receipt (only if draft)
 */
router.delete('/:id', protect, tenantScope, resolveSelectedStore, blockIfRetailStoreUnderCentralKitchen, async (req, res) => {
  try {
    const { tenantId, storeId } = req;

    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      tenantId,
      storeId,
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Goods receipt not found' });
    }

    if (receipt.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft receipts can be deleted' });
    }

    await receipt.deleteOne();
    res.json({ message: 'Goods receipt deleted successfully' });
  } catch (error) {
    console.error('Error deleting goods receipt:', error);
    res.status(500).json({ error: 'Failed to delete goods receipt' });
  }
});

module.exports = router;
