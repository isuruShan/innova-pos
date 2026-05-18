'use strict';

const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const { notifyMerchantAdmins, notifySuperAdmins } = require('./notificationHelpers');
const { notifySubscriptionEvent } = require('./subscriptionNotify');

/**
 * Activate or extend a tenant subscription after successful payment.
 * @returns {{ tenant, subscription, newEnd }}
 */
async function activateSubscriptionForTenant(tenantId, plan, options = {}) {
  const {
    activatedBy = null,
    paymentNote = 'Payment confirmed',
    deferStartUntil = null,
  } = options;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const now = new Date();
  const extensionDays = plan.durationDays || 30;
  let startDate = now;
  let currentEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : now;
  const latestSub = await Subscription.findOne({ tenantId: tenant._id }).sort({ endDate: -1 });
  if (latestSub?.endDate && new Date(latestSub.endDate) > currentEnd) {
    currentEnd = new Date(latestSub.endDate);
  }

  const pendingMatch =
    tenant.pendingPlanId
    && String(tenant.pendingPlanId) === String(plan._id)
    && tenant.pendingPlanEffectiveAt
    && new Date(tenant.pendingPlanEffectiveAt) > now;

  if (pendingMatch) {
    startDate = new Date(tenant.pendingPlanEffectiveAt);
    tenant.pendingPlanPaymentReceived = true;
  } else if (deferStartUntil && new Date(deferStartUntil) > now) {
    startDate = new Date(deferStartUntil);
    tenant.pendingPlanPaymentReceived = true;
  } else {
    startDate = new Date(Math.max(currentEnd.getTime(), now.getTime()));
    if (startDate.getTime() < now.getTime()) startDate = now;
  }

  const newEnd = new Date(startDate);
  newEnd.setDate(newEnd.getDate() + extensionDays);

  const subscription = await Subscription.create({
    tenantId: tenant._id,
    plan: plan.billingCycle || 'custom',
    planId: plan._id,
    planCode: plan.code,
    amount: plan.amount,
    currency: plan.currency || 'LKR',
    durationDays: extensionDays,
    startDate,
    endDate: newEnd,
    extendedByAdmin: Boolean(activatedBy),
    extensionNote: paymentNote,
    extendedBy: activatedBy,
    extendedAt: now,
    createdBy: activatedBy,
  });

  if (!pendingMatch || startDate <= now) {
    tenant.subscriptionStatus = 'active';
    tenant.status = 'active';
    tenant.assignedPlanId = plan._id;
    tenant.assignedAt = now;
    if (activatedBy) tenant.assignedBy = activatedBy;
    tenant.pendingPlanId = null;
    tenant.pendingPlanEffectiveAt = null;
    tenant.pendingPlanPaymentReceived = false;
  } else {
    tenant.pendingPlanPaymentReceived = true;
  }

  tenant.temporaryActivationUntil = null;
  tenant.temporaryActivationRequestedAt = null;
  tenant.temporaryActivationRequestedBy = null;
  tenant.temporaryActivationExpiryEndDate = null;
  tenant.temporaryActivationUsedForEndDate = null;
  tenant.subscriptionExpiryReminderSentForEndDate = null;
  tenant.subscriptionDeactivationNotifiedForEndDate = null;
  tenant.suspensionReason = '';
  tenant.updatedBy = activatedBy;
  await tenant.save();

  return { tenant, subscription, newEnd, pendingMatch };
}

async function notifySubscriptionActivated(tenant, newEnd, { pendingMatch }) {
  const body = pendingMatch
    ? `Payment received. Your plan will activate on ${new Date(tenant.pendingPlanEffectiveAt).toDateString()}.`
    : `Your subscription is active until ${newEnd.toDateString()}.`;

  await notifyMerchantAdmins(tenant._id, {
    type: 'subscription_approved',
    title: pendingMatch ? 'Plan change paid' : 'Subscription activated',
    body,
    meta: { resourceType: 'tenant', resourceId: String(tenant._id), subscriptionEndDate: newEnd.toISOString() },
  }).catch(() => {});

  await notifySuperAdmins(tenant._id, {
    type: 'subscription_payment_completed',
    title: 'Subscription payment completed',
    body: `${tenant.businessName}: ${body}`,
    meta: { resourceType: 'tenant', resourceId: String(tenant._id) },
  }).catch(() => {});

  await notifySubscriptionEvent(tenant._id, {
    type: 'subscription_payment_completed',
    title: 'Payment successful',
    body,
    meta: { resourceType: 'tenant', resourceId: String(tenant._id) },
    merchantEmail: {
      subject: 'Cafinity subscription payment received',
      html: `<p>Hi,</p><p>${body}</p>`,
    },
    superEmail: {
      subject: 'Merchant subscription payment',
      html: `<p>Payment completed for <strong>${tenant.businessName}</strong>.</p><p>${body}</p>`,
    },
  }).catch(() => {});
}

/** Apply scheduled plan switch when period ends and payment was received. */
async function applyDuePendingPlanSwitches() {
  const now = new Date();
  const tenants = await Tenant.find({
    pendingPlanId: { $ne: null },
    pendingPlanEffectiveAt: { $lte: now },
    pendingPlanPaymentReceived: true,
  }).populate('pendingPlanId');

  let applied = 0;
  for (const tenant of tenants) {
    const plan = tenant.pendingPlanId;
    if (!plan || !plan.isActive) continue;

    tenant.assignedPlanId = plan._id;
    tenant.assignedAt = now;
    tenant.subscriptionStatus = 'active';
    tenant.status = 'active';
    tenant.pendingPlanId = null;
    tenant.pendingPlanEffectiveAt = null;
    tenant.pendingPlanPaymentReceived = false;
    tenant.suspensionReason = '';
    await tenant.save();
    applied += 1;

    await notifyMerchantAdmins(tenant._id, {
      type: 'subscription_approved',
      title: 'Plan change applied',
      body: `Your subscription is now on ${plan.name}.`,
      meta: { resourceType: 'tenant', resourceId: String(tenant._id), planId: String(plan._id) },
    }).catch(() => {});
  }
  return applied;
}

module.exports = {
  activateSubscriptionForTenant,
  notifySubscriptionActivated,
  applyDuePendingPlanSwitches,
};
