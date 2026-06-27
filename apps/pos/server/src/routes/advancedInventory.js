const express = require('express');
const StorageArea = require('../models/StorageArea');
const CountSheet = require('../models/CountSheet');
const InventoryCountSession = require('../models/InventoryCountSession');
const StockTransfer = require('../models/StockTransfer');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const { protect, authorize, tenantScope, sendRouteError } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { requirePaidAddon } = require('../middleware/requirePaidAddon');

const router = express.Router();

// Apply authorization and paid addon middleware to all routes
router.use(protect, authorize('manager', 'merchant_admin', 'superadmin', 'purchasing_officer', 'inventory_clerk', 'commissary_operator'), tenantScope, resolveSelectedStore, requirePaidAddon('advanced_inventory'));

// ==========================================
// 1. STORAGE AREAS CRUD
// ==========================================

router.get('/storage-areas', async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req) };
    const areas = await StorageArea.find(filter).sort({ name: 1 });
    res.json(areas);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/storage-areas', async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Storage area name is required' });
    }

    const area = await StorageArea.create({
      tenantId: req.tenantId,
      storeId,
      name: name.trim(),
    });
    res.status(201).json(area);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A storage area with this name already exists in this store' });
    }
    sendRouteError(res, err, { req });
  }
});

router.delete('/storage-areas/:id', async (req, res) => {
  try {
    const area = await StorageArea.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
    });
    if (!area) return res.status(404).json({ message: 'Storage area not found' });
    res.json({ message: 'Storage area deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// ==========================================
// 2. COUNT SHEETS CRUD
// ==========================================

router.get('/count-sheets', async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req), isActive: true };
    const sheets = await CountSheet.find(filter)
      .populate('items.inventoryItemId', 'itemName unit quantity minThreshold')
      .sort({ name: 1 });
    res.json(sheets);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/count-sheets', async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    const { name, storageAreas, items } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Count sheet name is required' });
    }

    const sheet = await CountSheet.create({
      tenantId: req.tenantId,
      storeId,
      name: name.trim(),
      storageAreas: storageAreas || [],
      items: items || [],
    });
    res.status(201).json(sheet);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.put('/count-sheets/:id', async (req, res) => {
  try {
    const { name, storageAreas, items } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (storageAreas) update.storageAreas = storageAreas;
    if (items) update.items = items;

    const sheet = await CountSheet.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      update,
      { new: true }
    ).populate('items.inventoryItemId', 'itemName unit quantity');

    if (!sheet) return res.status(404).json({ message: 'Count sheet not found' });
    res.json(sheet);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.delete('/count-sheets/:id', async (req, res) => {
  try {
    const sheet = await CountSheet.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId, ...buildStoreFilter(req) },
      { isActive: false },
      { new: true }
    );
    if (!sheet) return res.status(404).json({ message: 'Count sheet not found' });
    res.json({ message: 'Count sheet deleted' });
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// ==========================================
// 3. STOCKTAKE COUNT SESSIONS
// ==========================================

router.get('/count-sessions/active', async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req), status: 'active' };
    const session = await InventoryCountSession.findOne(filter)
      .populate('countSheetId', 'name')
      .populate('items.inventoryItemId', 'itemName unit quantity lastCost wacCost storageAreas')
      .populate('userId', 'name email');
    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/count-sessions/start', async (req, res) => {
  try {
    const storeId = await resolveWriteStoreId(req);
    const { countSheetId } = req.body;

    if (!countSheetId) {
      return res.status(400).json({ message: 'countSheetId is required' });
    }

    // Ensure no active session exists
    const active = await InventoryCountSession.findOne({
      tenantId: req.tenantId,
      storeId,
      status: 'active',
    });
    if (active) {
      return res.status(400).json({ message: 'There is already an active stocktake session in progress' });
    }

    const sheet = await CountSheet.findOne({
      _id: countSheetId,
      tenantId: req.tenantId,
      storeId,
    });
    if (!sheet) return res.status(404).json({ message: 'Count sheet not found' });

    // Batch-fetch all inventory items for the count sheet
    const sheetItemIds = sheet.items.map(i => i.inventoryItemId);
    const sheetInvDocs = await Inventory.find({ _id: { $in: sheetItemIds }, tenantId: req.tenantId }).lean();
    const sheetInvMap = new Map(sheetInvDocs.map(d => [String(d._id), d]));

    const sessionItems = sheet.items
      .map(sheetItem => {
        const inv = sheetInvMap.get(String(sheetItem.inventoryItemId));
        if (!inv) return null;
        return {
          inventoryItemId: inv._id,
          theoreticalQty: inv.quantity || 0,
          countedQty: null,
          costPrice: inv.wacCost || inv.lastCost || 0,
        };
      })
      .filter(Boolean);

    const session = await InventoryCountSession.create({
      tenantId: req.tenantId,
      storeId,
      countSheetId,
      userId: req.user.id,
      status: 'active',
      items: sessionItems,
    });

    const populated = await InventoryCountSession.findById(session._id)
      .populate('countSheetId', 'name')
      .populate('items.inventoryItemId', 'itemName unit quantity')
      .populate('userId', 'name email');

    res.status(201).json(populated);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/count-sessions/active/adjust', async (req, res) => {
  try {
    const { inventoryItemId, countedQty } = req.body;
    if (typeof countedQty !== 'number' || countedQty < 0) {
      return res.status(400).json({ message: 'Counted quantity must be a non-negative number' });
    }

    const session = await InventoryCountSession.findOne({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
      status: 'active',
    });
    if (!session) return res.status(404).json({ message: 'No active stocktake session found' });

    const itemIdx = session.items.findIndex(i => String(i.inventoryItemId) === String(inventoryItemId));
    if (itemIdx === -1) {
      // Add item if it wasn't on the count sheet initially
      const inv = await Inventory.findOne({ _id: inventoryItemId, tenantId: req.tenantId });
      if (!inv) return res.status(404).json({ message: 'Inventory item not found' });
      session.items.push({
        inventoryItemId,
        theoreticalQty: inv.quantity || 0,
        countedQty,
        costPrice: inv.wacCost || inv.lastCost || 0,
      });
    } else {
      session.items[itemIdx].countedQty = countedQty;
    }

    await session.save();
    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/count-sessions/active/submit', async (req, res) => {
  try {
    const { notes } = req.body;
    const session = await InventoryCountSession.findOne({
      tenantId: req.tenantId,
      ...buildStoreFilter(req),
      status: 'active',
    });
    if (!session) return res.status(404).json({ message: 'No active stocktake session found' });

    // Batch-fetch all counted inventory items
    const countedItems = session.items.filter(i => i.countedQty !== null);
    const countedItemIds = countedItems.map(i => i.inventoryItemId);
    const countedInvDocs = await Inventory.find({ _id: { $in: countedItemIds }, tenantId: req.tenantId });
    const countedInvMap = new Map(countedInvDocs.map(d => [String(d._id), d]));

    // Commit physical counts to Inventory & Stock Movements
    for (const item of countedItems) {
      const inv = countedInvMap.get(String(item.inventoryItemId));
      if (!inv) continue;

      const previousQty = inv.quantity || 0;
      const newQty = item.countedQty;
      const variance = newQty - previousQty;

      if (variance === 0) continue;

      inv.quantity = newQty;
      inv.lastUpdated = Date.now();
      inv.updatedBy = req.user.id;
      await inv.save();

      // Log StockMovement
      await StockMovement.create({
        tenantId: req.tenantId,
        storeId: session.storeId,
        inventoryItemId: inv._id,
        type: 'adjustment',
        quantity: variance,
        previousQty,
        newQty,
        reason: 'count_correction',
        notes: `Committed discrepancy from Stocktake Session #${session._id}`,
        createdBy: req.user.id,
      });
    }

    session.status = 'closed';
    session.notes = notes || '';
    session.endedAt = new Date();
    await session.save();

    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/count-sessions/active/cancel', async (req, res) => {
  try {
    const session = await InventoryCountSession.findOneAndUpdate(
      { tenantId: req.tenantId, ...buildStoreFilter(req), status: 'active' },
      { status: 'cancelled', endedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'No active stocktake session found' });
    res.json(session);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.get('/count-sessions/history', async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId, ...buildStoreFilter(req), status: 'closed' };
    const history = await InventoryCountSession.find(filter)
      .populate('countSheetId', 'name')
      .populate('items.inventoryItemId', 'itemName unit quantity')
      .populate('userId', 'name email')
      .sort({ endedAt: -1 })
      .limit(50);
    res.json(history);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

// ==========================================
// 4. STOCK TRANSFERS CRUD
// ==========================================

router.get('/transfers', async (req, res) => {
  try {
    const storeId = req.query.storeId || req.selectedStoreId;
    if (!storeId) return res.status(400).json({ message: 'storeId is required' });
    const filter = {
      tenantId: req.tenantId,
      $or: [{ sourceStoreId: storeId }, { targetStoreId: storeId }],
    };
    const transfers = await StockTransfer.find(filter)
      .populate('sourceStoreId', 'name')
      .populate('targetStoreId', 'name')
      .populate('items.inventoryItemId', 'itemName unit')
      .populate('createdBy', 'name email')
      .populate('receivedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/transfers', async (req, res) => {
  try {
    const { sourceStoreId, targetStoreId, items, notes, status: requestedStatus } = req.body;

    if (!sourceStoreId || !targetStoreId) {
      return res.status(400).json({ message: 'sourceStoreId and targetStoreId are required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Items list cannot be empty' });
    }

    // Allow 'pending' (request) or 'shipped' (immediate dispatch). Default: shipped.
    const transferStatus = requestedStatus === 'pending' ? 'pending' : 'shipped';

    const transferNum = `TRF-${Date.now()}`;
    const transfer = await StockTransfer.create({
      tenantId: req.tenantId,
      sourceStoreId,
      targetStoreId,
      transferNumber: transferNum,
      status: transferStatus,
      items,
      notes: notes || '',
      createdBy: req.user.id,
      shippedAt: transferStatus === 'shipped' ? new Date() : undefined,
    });

    // Only deduct stock immediately if shipped (not for pending requests)
    if (transferStatus === 'shipped') {
      const transferItemIds = items.map(i => i.inventoryItemId);
      const sourceInvDocs = await Inventory.find({ _id: { $in: transferItemIds }, tenantId: req.tenantId, storeId: sourceStoreId });
      const sourceInvMap = new Map(sourceInvDocs.map(d => [String(d._id), d]));

      for (const item of items) {
        const inv = sourceInvMap.get(String(item.inventoryItemId));
        if (inv) {
          const previousQty = inv.quantity || 0;
          inv.quantity = Math.max(0, previousQty - item.qtySent);
          await inv.save();

          await StockMovement.create({
            tenantId: req.tenantId,
            storeId: sourceStoreId,
            inventoryItemId: inv._id,
            type: 'goods_return',
            quantity: -item.qtySent,
            previousQty,
            newQty: inv.quantity,
            reason: 'returned',
            notes: `Stock Transfer Out (${transferNum}) to Store ${targetStoreId}`,
            createdBy: req.user.id,
          });
        }
      }
    }

    res.status(201).json(transfer);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/transfers/:id/receive', async (req, res) => {
  try {
    const { items } = req.body;
    const transfer = await StockTransfer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      status: 'shipped',
    });
    if (!transfer) return res.status(404).json({ message: 'Shipped stock transfer not found' });

    transfer.status = 'received';
    transfer.receivedAt = new Date();
    transfer.receivedBy = req.user.id;

    // Map incoming array for fast lookup
    const receiveMap = {};
    (items || []).forEach(i => {
      receiveMap[String(i.inventoryItemId)] = i.qtyReceived;
    });

    // Batch-fetch all source inventory items
    const receiveItemIds = transfer.items.map(i => i.inventoryItemId);
    const recvSourceDocs = await Inventory.find({ _id: { $in: receiveItemIds }, tenantId: req.tenantId, storeId: transfer.sourceStoreId }).lean();
    const recvSourceMap = new Map(recvSourceDocs.map(d => [String(d._id), d]));

    // Batch-fetch existing target store items by name
    const sourceItemNames = recvSourceDocs.map(d => d.itemName);
    const existingTargetDocs = await Inventory.find({ itemName: { $in: sourceItemNames }, tenantId: req.tenantId, storeId: transfer.targetStoreId });
    const targetInvMap = new Map(existingTargetDocs.map(d => [d.itemName, d]));

    for (const transferItem of transfer.items) {
      const itemIdStr = String(transferItem.inventoryItemId);
      const qtyReceived = typeof receiveMap[itemIdStr] === 'number' ? receiveMap[itemIdStr] : transferItem.qtySent;

      transferItem.qtyReceived = qtyReceived;

      const sourceInv = recvSourceMap.get(itemIdStr);

      if (sourceInv) {
        // Find or create item at target store (use pre-fetched map, create only if missing)
        let targetInv = targetInvMap.get(sourceInv.itemName);

        if (!targetInv) {
          targetInv = await Inventory.create({
            tenantId: req.tenantId,
            storeId: transfer.targetStoreId,
            itemName: sourceInv.itemName,
            unit: sourceInv.unit,
            purchaseUnit: sourceInv.purchaseUnit || sourceInv.unit,
            storageUnit: sourceInv.storageUnit || sourceInv.unit,
            recipeUnit: sourceInv.recipeUnit || sourceInv.unit,
            purchaseToStorageMultiplier: sourceInv.purchaseToStorageMultiplier,
            storageToRecipeMultiplier: sourceInv.storageToRecipeMultiplier,
            itemType: sourceInv.itemType,
            recipe: sourceInv.recipe,
            minThreshold: sourceInv.minThreshold || 0,
            quantity: 0,
          });
          targetInvMap.set(sourceInv.itemName, targetInv);
        }

        const previousQty = targetInv.quantity || 0;
        targetInv.quantity = previousQty + qtyReceived;
        await targetInv.save();

        await StockMovement.create({
          tenantId: req.tenantId,
          storeId: transfer.targetStoreId,
          inventoryItemId: targetInv._id,
          type: 'grn',
          quantity: qtyReceived,
          previousQty,
          newQty: targetInv.quantity,
          reason: 'received',
          notes: `Stock Transfer In (${transfer.transferNumber}) from Store ${transfer.sourceStoreId}`,
          createdBy: req.user.id,
        });
      }
    }

    await transfer.save();
    res.json(transfer);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/transfers/:id/reject', async (req, res) => {
  try {
    const transfer = await StockTransfer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      status: { $in: ['shipped', 'pending'] },
    });
    if (!transfer) return res.status(404).json({ message: 'Stock transfer not found or cannot be rejected' });

    const previousStatus = transfer.status;
    transfer.status = 'rejected';
    await transfer.save();

    // Only revert stock if it was already shipped (pending never deducted stock)
    if (previousStatus === 'shipped') {
      const rejectItemIds = transfer.items.map(i => i.inventoryItemId);
      const rejectInvDocs = await Inventory.find({ _id: { $in: rejectItemIds }, tenantId: req.tenantId, storeId: transfer.sourceStoreId });
      const rejectInvMap = new Map(rejectInvDocs.map(d => [String(d._id), d]));

      for (const item of transfer.items) {
        const inv = rejectInvMap.get(String(item.inventoryItemId));
        if (inv) {
          const previousQty = inv.quantity || 0;
          inv.quantity = previousQty + item.qtySent;
          await inv.save();

          await StockMovement.create({
            tenantId: req.tenantId,
            storeId: transfer.sourceStoreId,
            inventoryItemId: inv._id,
            type: 'adjustment',
            quantity: item.qtySent,
            previousQty,
            newQty: inv.quantity,
            reason: 'returned',
            notes: `Stock Transfer Rejection Reversal (${transfer.transferNumber})`,
            createdBy: req.user.id,
          });
        }
      }
    }

    res.json(transfer);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

router.post('/transfers/:id/ship', async (req, res) => {
  try {
    const transfer = await StockTransfer.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      status: 'pending',
    });
    if (!transfer) return res.status(404).json({ message: 'Pending stock transfer not found' });

    transfer.status = 'shipped';
    transfer.shippedAt = new Date();

    // Deduct stock from Source Store
    const transferItemIds = transfer.items.map(i => i.inventoryItemId);
    const sourceInvDocs = await Inventory.find({ _id: { $in: transferItemIds }, tenantId: req.tenantId, storeId: transfer.sourceStoreId });
    const sourceInvMap = new Map(sourceInvDocs.map(d => [String(d._id), d]));

    for (const item of transfer.items) {
      const inv = sourceInvMap.get(String(item.inventoryItemId));
      if (inv) {
        const previousQty = inv.quantity || 0;
        inv.quantity = Math.max(0, previousQty - item.qtySent);
        await inv.save();

        await StockMovement.create({
          tenantId: req.tenantId,
          storeId: transfer.sourceStoreId,
          inventoryItemId: inv._id,
          type: 'goods_return',
          quantity: -item.qtySent,
          previousQty,
          newQty: inv.quantity,
          reason: 'returned',
          notes: `Stock Transfer Out (${transfer.transferNumber}) to Store ${transfer.targetStoreId}`,
          createdBy: req.user.id,
        });
      }
    }

    await transfer.save();
    res.json(transfer);
  } catch (err) {
    sendRouteError(res, err, { req });
  }
});

module.exports = router;
