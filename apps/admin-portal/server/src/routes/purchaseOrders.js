const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Inventory = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const Store = require('../models/Store');
const Tenant = require('../models/Tenant');
const { protect, tenantScope } = require('../middleware/auth');
const { resolveSelectedStore, buildStoreFilter, resolveWriteStoreId } = require('../middleware/storeScope');
const { generatePurchaseOrderPDF } = require('../utils/pdfGenerator');
const { sendPurchaseOrderEmail } = require('../utils/mailer');
const { createNotification } = require('../lib/notificationHelpers');


/**
 * GET /purchase-orders
 * List all purchase orders with optional filters
 */
router.get('/', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { status, supplierId, from, to } = req.query;
    const { tenantId } = req;

    const filter = { tenantId, ...buildStoreFilter(req) };
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
    const { tenantId } = req;
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      ...buildStoreFilter(req),
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

    const activeStoreId = storeId || (await resolveWriteStoreId(req));
    if (!activeStoreId) {
      return res.status(400).json({ error: 'No active store context found to create purchase order' });
    }

    // Verify supplier exists
    const supplier = await Supplier.findOne({ _id: supplierId, tenantId, storeId: activeStoreId });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Validate items and get inventory details
    const validatedItems = [];
    for (const item of items) {
      const invItem = await Inventory.findOne({
        _id: item.inventoryItemId,
        tenantId,
        storeId: activeStoreId,
      });
      if (!invItem) {
        return res.status(404).json({ error: `Inventory item ${item.inventoryItemId} not found` });
      }
      validatedItems.push({
        inventoryItemId: invItem._id,
        itemName: invItem.itemName,
        unit: invItem.unit,
        orderedQty: Number(item.orderedQty) || 0,
        receivedQty: 0,
        unitPrice: Number(item.unitPrice) || 0,
      });
    }

    if (expectedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(expectedDate) < today) {
        return res.status(400).json({ error: 'Expected Delivery Date cannot be in the past' });
      }
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
      storeId: activeStoreId,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const orderNumber = `PO-${today}-${String(countToday + 1).padStart(4, '0')}`;

    const order = new PurchaseOrder({
      tenantId,
      storeId: activeStoreId,
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
    const { tenantId } = req;
    const { supplierId, items, expectedDate, notes, status } = req.body;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      ...buildStoreFilter(req),
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const activeStoreId = order.storeId;

    // Only draft and sent orders can be edited
    if (!['draft', 'sent'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot edit completed, partial, or cancelled orders' });
    }

    // Update supplier if provided
    if (supplierId && supplierId !== String(order.supplierId)) {
      const supplier = await Supplier.findOne({ _id: supplierId, tenantId, storeId: activeStoreId });
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
          storeId: activeStoreId,
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
          unitPrice: Number(item.unitPrice) || 0,
        });
      }
      order.items = validatedItems;
      order.totalAmount = validatedItems.reduce(
        (sum, item) => sum + item.orderedQty * item.unitPrice,
        0
      );
    }

    if (expectedDate !== undefined) {
      if (expectedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(expectedDate) < today) {
          return res.status(400).json({ error: 'Expected Delivery Date cannot be in the past' });
        }
      }
      order.expectedDate = expectedDate ? new Date(expectedDate) : null;
    }
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
    const { tenantId } = req;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      ...buildStoreFilter(req),
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
    await order.populate('supplierId', 'name email phone contactPerson address');
    await order.populate('createdBy', 'name email');
    await order.populate('sentBy', 'name email');

    // Fetch store details for PDF/email context
    const store = await Store.findOne({ _id: order.storeId, tenantId });
    const tenantDoc = await Tenant.findById(tenantId).lean();
    const merchantName = tenantDoc?.businessName || 'Merchant';

    // Generate PO PDF
    let pdfBuffer;
    try {
      pdfBuffer = await generatePurchaseOrderPDF(order, order.supplierId, store || { name: 'Merchant' }, merchantName);
    } catch (pdfErr) {
      console.error('Error generating PO PDF:', pdfErr);
      return res.status(500).json({ error: 'Failed to generate Purchase Order PDF' });
    }

    // Send email to supplier if supplier email exists
    if (order.supplierId && order.supplierId.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #ea580c; margin-bottom: 20px; border-bottom: 2px solid #ea580c; padding-bottom: 10px;">Purchase Order Request</h2>
          <p>Dear ${order.supplierId.contactPerson || order.supplierId.name},</p>
          <p>Please find attached the Purchase Order <strong>${order.orderNumber}</strong> generated by <strong>${merchantName}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>PO Number:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${order.orderNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Expected Delivery:</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${order.expectedDate ? new Date(order.expectedDate).toLocaleDateString() : '—'}</td>
            </tr>
          </table>
          
          ${order.notes ? `<div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-style: italic;"><strong>Notes:</strong> ${order.notes}</div>` : ''}
          
          <p>If you have any questions or require clarification, please contact us directly:</p>
          <p>
            <strong>${merchantName}</strong><br>
            ${store?.phone ? `Phone: ${store.phone}<br>` : ''}
            ${store?.address?.street1 || ''} ${store?.address?.city || ''}
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
          <p style="color: #64748b; font-size: 12px; text-align: center;">This is an automated purchase order request generated on behalf of ${merchantName}.</p>
        </div>
      `;

      try {
        await sendPurchaseOrderEmail({
          to: order.supplierId.email,
          replyTo: req.user.email,
          subject: `Purchase Order Request - ${order.orderNumber}`,
          html: emailHtml,
          storeName: store?.name || 'Merchant',
          attachments: [
            {
              filename: `${order.orderNumber}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }
          ]
        });
        // Push notification to the user who sent the PO — rule: every email gets a push
        createNotification(req.tenantId, req.user.id, {
          type: 'purchase_order_sent',
          title: '📧 Purchase order sent',
          body: `PO ${order.orderNumber} was emailed to ${order.supplierId.name || order.supplierId.email}.`,
          meta: { resourceType: 'purchaseOrder', resourceId: String(order._id), orderNumber: order.orderNumber },
        }).catch(() => {});
      } catch (mailErr) {
        console.error('Failed to send PO email to supplier:', mailErr);
      }
    }


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
    const { tenantId } = req;

    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId,
      ...buildStoreFilter(req),
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
router.get('/suggestions/low-stock', protect, tenantScope, resolveSelectedStore, async (req, res) => {
  try {
    const { tenantId } = req;

    const lowStockItems = await Inventory.find({
      tenantId,
      ...buildStoreFilter(req),
      $expr: { $lte: ['$quantity', '$minThreshold'] },
    }).sort({ quantity: 1 });

    const suggestions = lowStockItems.map((item) => ({
      inventoryItemId: item._id,
      itemName: item.itemName,
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
