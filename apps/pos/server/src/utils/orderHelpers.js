const MenuItem = require('../models/MenuItem');
const Settings = require('../models/Settings');

/** Money in dollars/cents — avoid float drift (e.g. 319.999999). */
function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

async function enrichItems(items, tenantId, storeId) {
  const menuIds = items.map((i) => i.menuItem);
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds }, tenantId, storeId }).lean();
  const menuMap = Object.fromEntries(menuDocs.map((m) => [m._id.toString(), m]));
  return items.map((i) => {
    const doc = menuMap[i.menuItem?.toString()];
    const qty = Math.max(1, Number(i.qty) || 1);
    const base = {
      menuItem: doc?._id || i.menuItem,
      name: doc?.name || i.name,
      category: doc?.category || '',
      qty,
      price: roundMoney2(doc?.price ?? i.price),
      isCombo: false,
      comboItems: [],
      deliveredToTable: false,
      kitchenNew: false,
    };
    if (doc?.isCombo && doc.comboItems?.length) {
      return {
        ...base,
        isCombo: true,
        comboItems: doc.comboItems.map((ci) => ({ name: ci.name, qty: ci.qty * qty })),
      };
    }
    return base;
  });
}

async function mergeItemsForUpdate(prevItems, incoming, tenantId, storeId, orderStatus) {
  const prevById = new Map((prevItems || []).filter((i) => i._id).map((i) => [String(i._id), i]));
  const menuIds = [...new Set(incoming.map((i) => i.menuItem).filter(Boolean))];
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds }, tenantId, storeId }).lean();
  const menuMap = Object.fromEntries(menuDocs.map((m) => [m._id.toString(), m]));
  const trackKitchenQtyBump = ['preparing', 'ready'].includes(orderStatus || '');

  return incoming.map((raw) => {
    const mid = raw.menuItem?.toString();
    const doc = menuMap[mid];
    if (!doc) throw new Error(`Invalid menu item`);
    const qty = Math.max(1, Number(raw.qty) || 1);
    const prev = raw._id ? prevById.get(String(raw._id)) : null;
    const isNew = !prev;
    const prevQty = prev ? Math.max(1, Number(prev.qty) || 1) : 0;
    const qtyIncreased = !!prev && qty > prevQty;
    const kitchenNew = isNew
      ? true
      : trackKitchenQtyBump && qtyIncreased
        ? true
        : !!prev?.kitchenNew;

    let kitchenPendingQty;
    if (isNew) {
      kitchenPendingQty = qty;
    } else if (prev) {
      const prevQtyNum = Math.max(1, Number(prev.qty) || 1);
      if (trackKitchenQtyBump && qty > prevQtyNum) {
        kitchenPendingQty = qty - prevQtyNum;
      } else if (kitchenNew) {
        const prevPq = prev.kitchenPendingQty != null ? Number(prev.kitchenPendingQty) : null;
        kitchenPendingQty =
          prevPq != null && prevPq > 0 ? prevPq : prev.kitchenNew ? prevQtyNum : qty;
      } else {
        kitchenPendingQty = null;
      }
    }

    const line = {
      menuItem: doc._id,
      name: doc.name,
      category: doc.category || '',
      qty,
      price: roundMoney2(doc.price),
      isCombo: false,
      comboItems: [],
      deliveredToTable: prev
        ? (raw.deliveredToTable !== undefined ? !!raw.deliveredToTable : !!prev.deliveredToTable)
        : !!raw.deliveredToTable,
      kitchenNew,
      kitchenPendingQty: kitchenPendingQty != null ? kitchenPendingQty : null,
    };
    if (doc.isCombo && doc.comboItems?.length) {
      line.isCombo = true;
      line.comboItems = doc.comboItems.map((ci) => ({ name: ci.name, qty: ci.qty * qty }));
    }
    if (prev && prev._id) line._id = prev._id;
    return line;
  });
}

async function recalculateOrderMoney(order) {
  const settings = await Settings.findOne({ tenantId: order.tenantId, storeId: order.storeId });
  const ts = settings?.orderTypes?.[order.orderType];
  const taxComponents = ts?.taxComponents || [];
  const serviceFeeType = ts?.serviceFeeType ?? 'percentage';
  const serviceFeeRate = ts?.serviceFeeRate ?? 0;
  const serviceFeeFixed = ts?.serviceFeeFixed ?? 0;

  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  order.subtotal = Math.round(subtotal * 100) / 100;
  const discountTotal = order.discountTotal || 0;
  const discountedSubtotal = Math.max(0, order.subtotal - discountTotal);

  let taxAmount = 0;
  let taxRate = 0;
  if (taxComponents.length > 0) {
    let base = discountedSubtotal;
    for (const tc of taxComponents) {
      const componentAmount = Math.round(base * (tc.rate / 100) * 100) / 100;
      taxAmount += componentAmount;
      if (tc.isCompound) base += componentAmount;
    }
    taxRate = taxComponents.reduce((sum, tc) => sum + tc.rate, 0);
  }
  const serviceFeeAmount =
    serviceFeeType === 'fixed'
      ? Math.round(serviceFeeFixed * 100) / 100
      : Math.round(discountedSubtotal * (serviceFeeRate / 100) * 100) / 100;

  order.taxRate = taxRate;
  order.taxAmount = Math.round(taxAmount * 100) / 100;
  order.serviceFeeType = serviceFeeType;
  order.serviceFeeRate = serviceFeeRate;
  order.serviceFeeFixed = serviceFeeFixed;
  order.serviceFeeAmount = serviceFeeAmount;
  order.totalAmount = Math.round((discountedSubtotal + order.taxAmount + order.serviceFeeAmount) * 100) / 100;
}

/**
 * Add quantity from raw lines onto an open order (QR guest). Marks merged lines as kitchenNew.
 */
async function appendItemsToOrder(order, rawItems, tenantId, storeId) {
  const newLines = await enrichItems(rawItems, tenantId, storeId);
  const menuIds = [...new Set(newLines.map((l) => l.menuItem))];
  const menuDocs = await MenuItem.find({ _id: { $in: menuIds }, tenantId, storeId }).lean();
  const menuMap = Object.fromEntries(menuDocs.map((m) => [m._id.toString(), m]));

  for (const nl of newLines) {
    const mid = String(nl.menuItem);
    const existing = order.items.find((i) => String(i.menuItem) === mid);
    if (existing) {
      existing.qty += nl.qty;
      existing.kitchenNew = true;
      existing.kitchenPendingQty = nl.qty;
      const doc = menuMap[mid];
      if (doc?.isCombo && doc.comboItems?.length) {
        existing.isCombo = true;
        existing.comboItems = doc.comboItems.map((ci) => ({ name: ci.name, qty: ci.qty * existing.qty }));
      }
    } else {
      nl.kitchenNew = true;
      nl.kitchenPendingQty = nl.qty;
      order.items.push(nl);
    }
  }
  await recalculateOrderMoney(order);
}

module.exports = {
  roundMoney2,
  enrichItems,
  mergeItemsForUpdate,
  recalculateOrderMoney,
  appendItemsToOrder,
};
