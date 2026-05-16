const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function start() {
  try {
    const { loadAwsSecretsManagerEnv } = require('@innovapos/runtime-env');
    await loadAwsSecretsManagerEnv();
  } catch (e) {
    console.error('[runtime-env] Failed to load AWS Secrets Manager:', e.message);
    process.exit(1);
  }

  const express = require('express');
const helmet = require('helmet');
const { createLogger } = require('@innovapos/logger');
const { getClientErrorPayload, createCorsMiddleware } = require('@innovapos/shared-middleware');
const connectDB = require('./config/db');
const { getMailConfigurationIssue } = require('@innovapos/mail-transport');
const Tenant = require('./models/Tenant');
const Subscription = require('./models/Subscription');
const User = require('./models/User');
const { sendEmail } = require('./utils/mailer');
const { notifySuperAdmins } = require('./lib/notificationHelpers');

const app = express();
const logger = createLogger('admin-portal-server');
app.locals.logger = logger;

connectDB(logger);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false }));

const fs = require('fs');
const adminClientDist = path.join(__dirname, '../../client/dist');
const serveAdminStatic = process.env.NODE_ENV === 'production' && fs.existsSync(adminClientDist);
if (serveAdminStatic) {
  app.use(express.static(adminClientDist, { maxAge: '1y' }));
} else if (process.env.NODE_ENV === 'production') {
  logger.warn(
    'Admin client dist missing at apps/admin-portal/client/dist — run: cd apps/admin-portal/client && pnpm run build',
  );
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

const adminCors = createCorsMiddleware({
  allowedOrigins,
  production: process.env.NODE_ENV === 'production',
});
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  return adminCors(req, res, next);
});

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/applications',    require('./routes/applications'));
app.use('/api/tenants',         require('./routes/tenants'));
app.use('/api/subscriptions',   require('./routes/subscriptions'));
app.use('/api/plans',           require('./routes/plans'));
app.use('/api/tenant-settings', require('./routes/tenantSettings'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/stores',          require('./routes/stores'));
app.use('/api/cashier-sessions', require('./routes/cashier-sessions'));
/** Same collections as POS — local routes avoid duplicate Mongoose model registration with the POS app */
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/categories', require('./routes/categories'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'admin-portal-server', ts: new Date().toISOString() })
);

if (serveAdminStatic) {
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(adminClientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, path: req.path, stack: err.stack });
  const raw = err.status || err.statusCode || 500;
  const st = Number.isFinite(raw) && raw >= 400 && raw < 600 ? raw : 500;
  res.status(st).json(getClientErrorPayload(err, st));
});

const PORT = parseInt(process.env.PORT, 10) || 5001;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Admin portal server running on :${PORT}`);
  const mailIssue = getMailConfigurationIssue();
  if (mailIssue) {
    logger.warn(`Outbound email not configured: ${mailIssue}`);
  }

  // Periodically check subscription expiry to send reminders and suspend merchants.
  let running = false;
  const checkSubscriptions = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const oneDayMs = 86400000;
      const reminderMinMs = 2.75 * oneDayMs;
      const reminderMaxMs = 3.25 * oneDayMs;

      // ── 1) Trial tenants ───────────────────────────────────────────────────
      const trialTenants = await Tenant.find({
        subscriptionStatus: 'trial',
        trialEndsAt: { $ne: null },
      }).lean();

      const superAdminsForEmail = await User.find({ role: 'superadmin', isActive: true }).select('email').lean();
      const superAdminEmails = superAdminsForEmail.map((u) => u.email).filter(Boolean);

      for (const t of trialTenants) {
        const end = t.trialEndsAt ? new Date(t.trialEndsAt) : null;
        if (!end) continue;
        const diffMs = end.getTime() - now.getTime();

        // Reminder (about 3 days away)
        if (diffMs > 0 && diffMs >= reminderMinMs && diffMs <= reminderMaxMs) {
          const alreadySent = t.subscriptionExpiryReminderSentForEndDate
            && new Date(t.subscriptionExpiryReminderSentForEndDate).getTime() === end.getTime();
          if (!alreadySent) {
            const merchantAdmins = await User.find({
              tenantId: t._id,
              role: 'merchant_admin',
              isActive: true,
            }).select('email').lean();

            await Promise.all(
              merchantAdmins.map((a) =>
                sendEmail({
                  to: a.email,
                  subject: 'Cafinity subscription ending soon — action needed',
                  html: `<p>Hi,</p>
                    <p>Your trial ends on <strong>${end.toDateString()}</strong> (in ~3 days). Please upload a payment receipt to continue without interruption.</p>
                    <p>— Cafinity</p>`,
                }).catch(() => {}),
              ),
            );

            await Promise.all(
              superAdminEmails.map((to) =>
                sendEmail({
                  to,
                  subject: 'Cafinity trial ending soon — merchant review',
                  html: `<p>Hi Super Admin,</p>
                    <p>Merchant <strong>${t.businessName}</strong> trial ends on <strong>${end.toDateString()}</strong>.</p>
                    <p>Please ensure the merchant uploads a payment receipt.</p>`,
                }).catch(() => {}),
              ),
            );

            await Tenant.findByIdAndUpdate(t._id, { subscriptionExpiryReminderSentForEndDate: end }).catch(() => {});
          }
        }

        // Deactivation at/after expiry (if not paid)
        if (diffMs <= 0) {
          const alreadyNotified = t.subscriptionDeactivationNotifiedForEndDate
            && new Date(t.subscriptionDeactivationNotifiedForEndDate).getTime() === end.getTime();
          if (!alreadyNotified) {
            await Tenant.findByIdAndUpdate(t._id, {
              subscriptionStatus: 'expired',
              status: 'suspended',
              subscriptionDeactivationNotifiedForEndDate: end,
            }).catch(() => {});

            const merchantAdmins = await User.find({
              tenantId: t._id,
              role: 'merchant_admin',
              isActive: true,
            }).select('email').lean();

            await Promise.all(
              merchantAdmins.map((a) =>
                sendEmail({
                  to: a.email,
                  subject: 'Cafinity subscription expired — upload receipt to reactivate',
                  html: `<p>Hi,</p>
                    <p>Your Cafinity subscription/trial expired on <strong>${end.toDateString()}</strong>.</p>
                    <p>Please upload your payment receipt to reactivate.</p>`,
                }).catch(() => {}),
              ),
            );

            await notifySuperAdmins(t._id, {
              type: 'subscription_deactivated',
              title: 'Subscription expired — merchant suspended',
              body: `Merchant "${t.businessName}" subscription expired on ${end.toDateString()}.`,
              meta: { resourceType: 'tenant', resourceId: String(t._id), expiryEndDate: end.toISOString() },
            }).catch(() => {});
          }
        }
      }

      // ── 2) Active subscriptions (latest endDate per tenant) ───────────────
      const activeEnding = await Subscription.find({
        endDate: { $lte: new Date(now.getTime() + 4 * oneDayMs), $gte: new Date(now.getTime() - 1 * oneDayMs) },
      })
        .sort({ endDate: -1 })
        .select('tenantId endDate')
        .lean();

      const latestByTenant = new Map();
      for (const s of activeEnding) {
        const tid = String(s.tenantId);
        if (!latestByTenant.has(tid)) latestByTenant.set(tid, { tenantId: s.tenantId, endDate: s.endDate });
      }

      const tenantIds = [...latestByTenant.keys()];
      const tenants = await Tenant.find({ _id: { $in: tenantIds }, subscriptionStatus: { $in: ['active', 'trial', 'expired'] } })
        .select('businessName subscriptionStatus trialEndsAt status temporaryActivationUntil subscriptionExpiryReminderSentForEndDate subscriptionDeactivationNotifiedForEndDate')
        .lean();

      const tenantById = new Map(tenants.map((t) => [String(t._id), t]));

      for (const { tenantId, endDate } of latestByTenant.values()) {
        const t = tenantById.get(String(tenantId));
        if (!t) continue;
        const end = new Date(endDate);
        const diffMs = end.getTime() - now.getTime();

        // Reminder (about 3 days away) only if still marked as active (not already expired)
        if (diffMs > 0 && diffMs >= reminderMinMs && diffMs <= reminderMaxMs && t.subscriptionStatus !== 'expired') {
          const alreadySent = t.subscriptionExpiryReminderSentForEndDate
            && new Date(t.subscriptionExpiryReminderSentForEndDate).getTime() === end.getTime();
          if (!alreadySent) {
            const merchantAdmins = await User.find({
              tenantId: tenantId,
              role: 'merchant_admin',
              isActive: true,
            }).select('email').lean();

            await Promise.all(
              merchantAdmins.map((a) =>
                sendEmail({
                  to: a.email,
                  subject: 'Cafinity subscription ending soon — action needed',
                  html: `<p>Hi,</p>
                    <p>Your subscription ends on <strong>${end.toDateString()}</strong> (in ~3 days). Please upload a payment receipt to continue.</p>
                    <p>— Cafinity</p>`,
                }).catch(() => {}),
              ),
            );

            await Promise.all(
              superAdminEmails.map((to) =>
                sendEmail({
                  to,
                  subject: 'Cafinity subscription due soon — merchant review',
                  html: `<p>Hi Super Admin,</p>
                    <p>Merchant <strong>${t.businessName}</strong> subscription ends on <strong>${end.toDateString()}</strong>.</p>`,
                }).catch(() => {}),
              ),
            );

            await Tenant.findByIdAndUpdate(t._id, { subscriptionExpiryReminderSentForEndDate: end }).catch(() => {});
          }
        }

        // Deactivation at/after expiry (if not paid)
        if (diffMs <= 0) {
          const alreadyNotified = t.subscriptionDeactivationNotifiedForEndDate
            && new Date(t.subscriptionDeactivationNotifiedForEndDate).getTime() === end.getTime();
          if (!alreadyNotified) {
            await Tenant.findByIdAndUpdate(t._id, {
              subscriptionStatus: 'expired',
              status: 'suspended',
              subscriptionDeactivationNotifiedForEndDate: end,
            }).catch(() => {});

            const merchantAdmins = await User.find({
              tenantId: tenantId,
              role: 'merchant_admin',
              isActive: true,
            }).select('email').lean();

            await Promise.all(
              merchantAdmins.map((a) =>
                sendEmail({
                  to: a.email,
                  subject: 'Cafinity subscription expired — upload receipt to reactivate',
                  html: `<p>Hi,</p>
                    <p>Your subscription expired on <strong>${end.toDateString()}</strong>.</p>
                    <p>Please upload your payment receipt to reactivate.</p>`,
                }).catch(() => {}),
              ),
            );

            await notifySuperAdmins(t._id, {
              type: 'subscription_deactivated',
              title: 'Subscription expired — merchant suspended',
              body: `Merchant "${t.businessName}" subscription expired on ${end.toDateString()}.`,
              meta: { resourceType: 'tenant', resourceId: String(t._id), expiryEndDate: end.toISOString() },
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      logger.error('Subscription monitor failed', { error: err.message });
    } finally {
      running = false;
    }
  };

  // Run shortly after startup, then every 3 hours (avoid heavy load).
  checkSubscriptions().catch(() => {});
  setInterval(() => {
    checkSubscriptions().catch(() => {});
  }, 3 * 60 * 60 * 1000);
});
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
