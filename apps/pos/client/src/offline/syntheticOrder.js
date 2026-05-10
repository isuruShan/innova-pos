import { tempOrderId } from './constants';

function lineSubtotal(items) {
  return (items || []).reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
}

/**
 * Minimal order document for POS UI until the server assigns ids.
 */
export function buildSyntheticOrderFromPostBody(data, clientRequestId, user) {
  const tid = tempOrderId(clientRequestId);
  const now = new Date().toISOString();
  const items = data.items || [];
  const subtotal = lineSubtotal(items);
  const totalAmount = Number(data.paymentAmount != null ? data.paymentAmount : subtotal);
  const negNum = -Math.abs(
    Number.parseInt(String(clientRequestId).replace(/\D/g, '').slice(-8), 10) || (Date.now() % 100000000)
  );

  const createdBy = user?.id
    ? { _id: user.id, name: user.name || '' }
    : user?._id
      ? { _id: user._id, name: user.name || '' }
      : null;

  return {
    _id: tid,
    tenantId: user?.tenantId ?? null,
    storeId: typeof window !== 'undefined' ? localStorage.getItem('pos_selected_store') : null,
    orderNumber: negNum,
    orderType: data.orderType || 'dine-in',
    tableNumber: data.tableNumber || '',
    reference: data.reference || '',
    items: items.map((i) => ({
      menuItem: i.menuItem,
      name: i.name,
      category: i.category || '',
      qty: i.qty,
      price: i.price,
      isCombo: Boolean(i.isCombo),
      comboItems: i.comboItems || [],
    })),
    status: 'pending',
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: 0,
    appliedPromotions: [],
    taxRate: 0,
    taxAmount: 0,
    serviceFeeRate: 0,
    serviceFeeFixed: 0,
    serviceFeeType: 'percentage',
    serviceFeeAmount: 0,
    paymentType: data.paymentType || 'cash',
    paymentAmount: totalAmount,
    totalAmount: Math.round(totalAmount * 100) / 100,
    createdBy,
    createdAt: now,
    updatedAt: now,
    clientRequestId,
    _offlinePending: true,
  };
}
