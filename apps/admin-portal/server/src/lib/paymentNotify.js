'use strict';

const User = require('../models/User');
const PaidAddonDefinition = require('../models/PaidAddonDefinition');
const { sendEmail } = require('../utils/mailer');
const { notifySuperAdmins, notifyMerchantAdmins } = require('./notificationHelpers');
const { computeSubscriptionRenewalExpected } = require('./addonBilling');
const {
  emailHeading,
  emailParagraph,
  emailButton,
  emailLabelValue,
  emailPanel,
  esc,
} = require('@innovapos/platform-contact');

const RECEIPT_KIND_LABELS = {
  subscription: 'Subscription renewal',
  addon: 'Paid add-on',
  store: 'Additional store',
};

function formatMoney(amount, currency) {
  const cur = currency || 'LKR';
  return `${cur} ${Number(amount || 0).toLocaleString()}`;
}

function receiptKindLabel(receipt) {
  if (receipt.receiptKind === 'addon' || receipt.addonCode) return RECEIPT_KIND_LABELS.addon;
  if (receipt.receiptKind === 'store') return RECEIPT_KIND_LABELS.store;
  return RECEIPT_KIND_LABELS.subscription;
}

/**
 * @param {import('mongoose').LeanDocument<any>} receipt
 * @param {import('mongoose').LeanDocument<any>|null} tenant
 * @param {{ billingBreakdown?: object, addonName?: string, event: 'submitted'|'verified'|'rejected', rejectionReason?: string }} ctx
 */
function buildPaymentReceiptEmailHtml(receipt, tenant, ctx) {
  const merchant = tenant?.businessName || 'Merchant';
  const kind = receiptKindLabel(receipt);
  const lines = [
    emailLabelValue('Merchant', `<strong>${esc(merchant)}</strong>`),
    emailLabelValue('Payment type', esc(kind)),
    emailLabelValue('Amount', `<strong>${esc(formatMoney(receipt.amount, receipt.currency))}</strong>`),
    emailLabelValue('Expected amount', esc(formatMoney(receipt.expectedAmount, receipt.currency))),
    emailLabelValue('Payment method', esc(receipt.paymentMethod || 'bank_transfer')),
    emailLabelValue('Bank reference', esc(receipt.bankReference || '—')),
  ];

  if (receipt.addonCode) {
    lines.push(emailLabelValue('Add-on', esc(ctx.addonName || receipt.addonCode)));
  }
  if (receipt.requestedPlanId && typeof receipt.requestedPlanId === 'object') {
    const p = receipt.requestedPlanId;
    lines.push(
      emailLabelValue(
        'Plan',
        `${esc(p.name)} — ${esc(formatMoney(p.amount, p.currency))} · ${esc(String(p.durationDays))} days (${esc(p.billingCycle || '')})`,
      ),
    );
  } else if (receipt.requestedPlanCode) {
    lines.push(emailLabelValue('Plan code', esc(receipt.requestedPlanCode)));
  }

  if (receipt.notes) {
    lines.push(emailLabelValue('Notes', esc(receipt.notes)));
  }
  if (receipt.paymentDate) {
    lines.push(emailLabelValue('Submitted', esc(new Date(receipt.paymentDate).toLocaleString())));
  }

  if (ctx.billingBreakdown?.plan) {
    const bb = ctx.billingBreakdown;
    const breakdownRows = [
      `<tr><td style="padding:4px 0;color:#64748b">${esc(bb.plan.name)}</td><td style="padding:4px 0;text-align:right">${esc(formatMoney(bb.plan.amount, bb.currency))}</td></tr>`,
      ...(bb.addons || []).map(
        (a) =>
          `<tr><td style="padding:4px 0;color:#64748b">${esc(a.label)}</td><td style="padding:4px 0;text-align:right">${esc(formatMoney(a.amount, bb.currency))}</td></tr>`,
      ),
      `<tr><td style="padding:8px 0 0;font-weight:700;color:#0f172a">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700">${esc(formatMoney(bb.total, bb.currency))}</td></tr>`,
    ].join('');
    lines.push(
      emailPanel(`
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#334155">Billing breakdown</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">${breakdownRows}</table>
      `),
    );
  }

  const titles = {
    submitted: ['New payment submitted', 'Awaiting verification'],
    verified: ['Payment verified', 'Processed successfully'],
    rejected: ['Payment rejected', 'Action recorded'],
  };
  const [title, subtitle] = titles[ctx.event] || titles.submitted;

  let extra = '';
  if (ctx.event === 'rejected' && ctx.rejectionReason) {
    extra = emailParagraph(`<strong>Reason:</strong> ${esc(ctx.rejectionReason)}`);
  }
  if (ctx.event === 'verified' && receipt.extensionDays) {
    extra += emailParagraph(`Subscription extended by <strong>${receipt.extensionDays} days</strong>.`);
  }

  const adminBase = String(process.env.ADMIN_URL || 'http://localhost:5174').replace(/\/$/, '');
  const reviewUrl = `${adminBase}/payments?highlight=${encodeURIComponent(String(receipt._id))}`;

  return `
    ${emailHeading(title, subtitle)}
    ${emailParagraph(`Payment details for <strong>${esc(merchant)}</strong>.`)}
    ${lines.join('')}
    ${extra}
    ${emailButton(reviewUrl, 'View payment in admin')}
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Receipt ID: ${esc(String(receipt._id))}</p>
  `;
}

async function resolveAddonName(code) {
  if (!code) return '';
  const doc = await PaidAddonDefinition.findOne({ code: String(code).toLowerCase() }).select('name').lean();
  return doc?.name || code;
}

async function enrichReceiptContext(receipt, tenant) {
  let billingBreakdown = null;
  let addonName = '';
  if (receipt.receiptKind === 'subscription' || (!receipt.receiptKind && !receipt.addonCode)) {
    billingBreakdown = await computeSubscriptionRenewalExpected(tenant);
  }
  if (receipt.addonCode) {
    addonName = await resolveAddonName(receipt.addonCode);
  }
  return { billingBreakdown, addonName };
}

async function emailSuperadminsPaymentEvent(receipt, tenant, event, extra = {}) {
  const ctx = await enrichReceiptContext(receipt, tenant);
  const html = buildPaymentReceiptEmailHtml(receipt, tenant, {
    ...ctx,
    event,
    rejectionReason: extra.rejectionReason,
  });
  const subjects = {
    submitted: `Payment submitted — ${tenant?.businessName || 'Merchant'} (${formatMoney(receipt.amount, receipt.currency)})`,
    verified: `Payment verified — ${tenant?.businessName || 'Merchant'}`,
    rejected: `Payment rejected — ${tenant?.businessName || 'Merchant'}`,
  };

  const supers = await User.find({ role: 'superadmin', isActive: true }).select('email').lean();
  const recipients = new Set();
  for (const sa of supers) {
    if (sa.email) recipients.add(sa.email);
  }
  const fallback = process.env.ADMIN_NOTIFY_EMAIL || process.env.EMAIL_FROM;
  if (fallback) recipients.add(fallback);

  await Promise.all(
    [...recipients].map((to) =>
      sendEmail({ to, subject: subjects[event] || subjects.submitted, html }).catch(() => {}),
    ),
  );
}

async function notifyPaymentSubmitted(receipt, tenant) {
  const tenantId = tenant?._id || tenant;
  const kind = receiptKindLabel(receipt);
  await notifySuperAdmins(tenantId, {
    type: 'payment_receipt_submitted',
    title: 'Payment receipt submitted',
    body: `${tenant?.businessName || 'Merchant'} — ${kind} ${formatMoney(receipt.amount, receipt.currency)}`,
    meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
  }).catch(() => {});

  await emailSuperadminsPaymentEvent(receipt, tenant, 'submitted');

  if (receipt.receiptKind === 'subscription' || !receipt.addonCode) {
    await notifyMerchantAdmins(tenantId, {
      type: 'subscription_payment_completed',
      title: 'Payment submitted',
      body: 'Your payment receipt was submitted and is awaiting verification.',
      meta: { resourceType: 'tenant', resourceId: String(tenantId), receiptId: String(receipt._id) },
    }).catch(() => {});
  }
}

async function notifyPaymentVerified(receipt, tenant, extra = {}) {
  const tenantId = tenant?._id || tenant;
  await emailSuperadminsPaymentEvent(receipt, tenant, 'verified', extra);

  const merchantAdmins = await User.find({ tenantId, role: 'merchant_admin', isActive: true }).select('email').lean();
  const ctx = await enrichReceiptContext(receipt, tenant);
  const html = buildPaymentReceiptEmailHtml(receipt, tenant, { ...ctx, event: 'verified' });
  await Promise.all(
    merchantAdmins.map((a) =>
      sendEmail({
        to: a.email,
        subject: 'Payment verified — Cafinity',
        html,
      }).catch(() => {}),
    ),
  );
}

module.exports = {
  buildPaymentReceiptEmailHtml,
  notifyPaymentSubmitted,
  notifyPaymentVerified,
  emailSuperadminsPaymentEvent,
  receiptKindLabel,
};
