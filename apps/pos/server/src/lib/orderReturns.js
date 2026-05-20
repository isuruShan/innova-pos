'use strict';

const mongoose = require('mongoose');
const TenantSettings = require('../models/TenantSettings');
const User = require('../models/User');

function returnedQtyForLine(order, lineId) {
  let sum = 0;
  for (const ret of order.returns || []) {
    for (const li of ret.items || []) {
      if (String(li.lineId) === String(lineId)) sum += Number(li.qty) || 0;
    }
  }
  return sum;
}

function remainingQtyForLine(order, item) {
  const lineId = item._id;
  const sold = Number(item.qty) || 0;
  return Math.max(0, sold - returnedQtyForLine(order, lineId));
}

async function loadReturnPolicy(tenantId) {
  const s = await TenantSettings.findOne({ tenantId }).select('returnsEnabled returnsRequireManagerApproval').lean();
  return {
    returnsEnabled: Boolean(s?.returnsEnabled),
    returnsRequireManagerApproval: s?.returnsRequireManagerApproval !== false,
  };
}

async function verifyManagerApproval({ tenantId, managerId, secret, storeId }) {
  if (!managerId || !secret) {
    const err = new Error('Manager approval is required');
    err.statusCode = 403;
    throw err;
  }
  const manager = await User.findOne({
    _id: managerId,
    tenantId,
    role: 'manager',
    isActive: true,
  });
  if (!manager) {
    const err = new Error('Invalid approving manager');
    err.statusCode = 403;
    throw err;
  }
  if (storeId && manager.storeIds?.length) {
    const ok = manager.storeIds.some((id) => String(id) === String(storeId));
    if (!ok) {
      const err = new Error('Manager is not assigned to this store');
      err.statusCode = 403;
      throw err;
    }
  }

  const hasPin = Boolean(String(manager.managerApprovalPin || '').trim());
  let ok = false;
  if (hasPin) {
    ok = await manager.compareApprovalPin(secret);
  } else {
    ok = await manager.comparePassword(secret);
  }
  if (!ok) {
    const err = new Error(hasPin ? 'Invalid approval passcode' : 'Invalid manager password');
    err.statusCode = 403;
    throw err;
  }
  return manager;
}

/**
 * Apply a full or partial return to a completed order.
 * @param {object} order mongoose document
 * @param {{ items: { lineId: string, qty: number }[], reason?: string, managerId?: string, approvalSecret?: string }} input
 */
async function applyOrderReturn(order, input, { tenantId, userId, storeId }) {
  if (order.status !== 'completed') {
    const err = new Error('Only completed orders can be returned');
    err.statusCode = 400;
    throw err;
  }

  const policy = await loadReturnPolicy(tenantId);
  if (!policy.returnsEnabled) {
    const err = new Error('Returns are not enabled for this business');
    err.statusCode = 403;
    throw err;
  }

  let approvedBy = null;
  if (policy.returnsRequireManagerApproval) {
    const manager = await verifyManagerApproval({
      tenantId,
      managerId: input.managerId,
      secret: input.approvalSecret,
      storeId,
    });
    approvedBy = manager._id;
  }

  const requested = Array.isArray(input.items) ? input.items : [];
  if (!requested.length) {
    const err = new Error('Select at least one item to return');
    err.statusCode = 400;
    throw err;
  }

  const returnLines = [];
  let refundAmount = 0;

  for (const reqLine of requested) {
    const qty = Math.max(0, Number(reqLine.qty) || 0);
    if (qty < 1) continue;
    const lineId = reqLine.lineId;
    const item = (order.items || []).find((i) => String(i._id) === String(lineId));
    if (!item) {
      const err = new Error('Invalid order line');
      err.statusCode = 400;
      throw err;
    }
    const remaining = remainingQtyForLine(order, item);
    if (qty > remaining) {
      const err = new Error(`Cannot return more than ${remaining} of ${item.name}`);
      err.statusCode = 400;
      throw err;
    }
    const unitPrice = Number(item.price) || 0;
    const lineRefund = Math.round(unitPrice * qty * 100) / 100;
    refundAmount += lineRefund;
    returnLines.push({
      lineId: item._id,
      menuItem: item.menuItem,
      name: item.name,
      qty,
      unitPrice,
      lineRefund,
    });
  }

  if (!returnLines.length) {
    const err = new Error('No return quantities specified');
    err.statusCode = 400;
    throw err;
  }

  refundAmount = Math.round(refundAmount * 100) / 100;
  const soldTotal = (order.items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
  const alreadyReturned = Number(order.totalReturnedAmount) || 0;
  const isFullReturn = returnLines.every((rl) => {
    const item = order.items.find((i) => String(i._id) === String(rl.lineId));
    return remainingQtyForLine(order, item) === rl.qty;
  }) && Math.abs(soldTotal - alreadyReturned - refundAmount) < 0.02;

  order.returns = order.returns || [];
  order.returns.push({
    returnedAt: new Date(),
    returnedBy: userId,
    approvedBy,
    reason: String(input.reason || '').trim().slice(0, 500),
    refundAmount,
    isFullReturn,
    items: returnLines,
  });
  order.totalReturnedAmount = Math.round((alreadyReturned + refundAmount) * 100) / 100;
  order.updatedBy = userId;
  await order.save();

  return { order, refundAmount, isFullReturn };
}

module.exports = {
  applyOrderReturn,
  loadReturnPolicy,
  remainingQtyForLine,
  returnedQtyForLine,
};
