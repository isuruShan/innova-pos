const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { createLogger } = require('@innovapos/logger');
const logger = createLogger('trial-reminders');
const { sendEmail } = require('../utils/mailer');
const { notifyMerchantAdmins } = require('../lib/notificationHelpers');
const { esc, emailHeading, emailParagraph, emailButton, emailPanel } = require('@innovapos/platform-contact');

/**
 * Daily job to send free trial expiration reminders.
 * Looks for tenants with exactly 3, 2, or 1 days left on their trial
 * and emails all active merchant_admin accounts.
 *
 * Rule: every email is paired with a push notification via notifyMerchantAdmins.
 */
async function sendTrialEndingReminders() {
  try {
    const now = new Date();
    logger.info('[Trial Reminders] Starting trial ending reminders checks', {
      currentTime: now.toISOString(),
    });

    // Find all tenants in trial mode
    const trialingTenants = await Tenant.find({ subscriptionStatus: 'trial', trialEndsAt: { $ne: null } });
    logger.info(`[Trial Reminders] Found ${trialingTenants.length} trialing tenants`);

    let emailsSent = 0;

    for (const tenant of trialingTenants) {
      const trialEnds = new Date(tenant.trialEndsAt);
      
      // Calculate days left, rounded to the nearest integer day
      const diffMs = trialEnds.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysLeft !== 1 && daysLeft !== 2 && daysLeft !== 3) {
        continue;
      }

      logger.info(`[Trial Reminders] Tenant ${tenant.businessName} (${tenant._id}) has exactly ${daysLeft} day(s) left in trial`);

      // Find active merchant admin users for this tenant
      const admins = await User.find({
        tenantId: tenant._id,
        role: 'merchant_admin',
        isActive: true,
      });

      if (!admins.length) {
        logger.warn(`[Trial Reminders] No active merchant_admin found for tenant ${tenant.businessName}`);
        continue;
      }

      // Generate custom template based on days left
      let subject = '';
      let title = '';
      let subtitle = '';
      let paragraph1 = '';
      let paragraph2 = '';
      let pushTitle = '';
      let pushBody = '';

      if (daysLeft === 3) {
        subject = `⏳ Only 3 days left in your Cafinity Free Trial!`;
        title = `Only 3 Days Left! ⏳`;
        subtitle = `Your Cafinity free trial is ending soon`;
        paragraph1 = `Hi <strong>{name}</strong>, your free trial of Cafinity for <strong>${esc(tenant.businessName)}</strong> ends in just <strong>3 days</strong>. We hope you've been enjoying the automated order processing, cashier workflow, and real-time inventory management!`;
        paragraph2 = `To prevent any interruption to your business operations, consider subscribing to a premium plan today. It takes less than 2 minutes to choose a plan and set up your subscription.`;
        pushTitle = '⏳ 3 days left in your free trial';
        pushBody = `${tenant.businessName} trial ends in 3 days. Subscribe now to avoid interruption.`;
      } else if (daysLeft === 2) {
        subject = `🔥 2 days left: Keep your checkout running smoothly with Cafinity`;
        title = `Keep the Checkout Running! 🔥`;
        subtitle = `Only 2 days remaining in your free trial`;
        paragraph1 = `Hi <strong>{name}</strong>, your free trial is ending in <strong>2 days</strong>. Don't lose access to your dashboard analytics, floor plan layouts, and client loyalty configurations.`;
        paragraph2 = `Upgrade your plan now to lock in your store configuration. If your trial expires, you will not be able to log in to the POS register view.`;
        pushTitle = '🔥 2 days left in your free trial';
        pushBody = `${tenant.businessName} trial ends in 2 days. Upgrade now to keep access.`;
      } else if (daysLeft === 1) {
        subject = `🚨 Last Day: Your Cafinity trial expires in 24 hours!`;
        title = `Last 24 Hours! 🚨`;
        subtitle = `Your free trial expires tomorrow`;
        paragraph1 = `Hi <strong>{name}</strong>, this is your final notice. Your free trial of Cafinity for <strong>${esc(tenant.businessName)}</strong> will expire in <strong>24 hours</strong>. After this, your registers will be locked until a subscription payment is verified.`;
        paragraph2 = `Click the button below to subscribe immediately and ensure your kitchen, POS, and manager portals remain online without a single minute of downtime.`;
        pushTitle = '🚨 Trial expires in 24 hours!';
        pushBody = `${tenant.businessName} trial expires today. Subscribe immediately to avoid lockout.`;
      }

      const supportContactPanel = emailPanel(`
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#16213e">📞 Need help choosing a plan or making payment?</p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">
          Reach out to our customer support team anytime:<br/>
          <strong>Email:</strong> <a href="mailto:support@cafinity.io" style="color:#ff6b35;text-decoration:none">support@cafinity.io</a><br/>
          <strong>Phone:</strong> <a href="tel:+94771234567" style="color:#ff6b35;text-decoration:none">+94 77 123 4567</a>
        </p>
      `);

      const loginUrl = `${process.env.ADMIN_PORTAL_URL || 'http://localhost:3000'}/subscription`;

      for (const admin of admins) {
        const htmlBody = `
          ${emailHeading(title, subtitle)}
          ${emailParagraph(paragraph1.replace('{name}', esc(admin.name)))}
          ${emailParagraph(paragraph2)}
          ${emailButton(loginUrl, '💳 Upgrade / Subscribe Now')}
          ${supportContactPanel}
        `;

        await sendEmail({
          to: admin.email,
          subject,
          html: htmlBody,
        });

        emailsSent++;
        logger.info(`[Trial Reminders] Sent reminder email to ${admin.email} (Tenant: ${tenant.businessName})`);
      }

      // Send push notification to all merchant admins for this tenant
      // (batched per-tenant, not per-admin — notifyMerchantAdmins handles FCM delivery)
      await notifyMerchantAdmins(tenant._id, {
        type: 'trial_ending_reminder',
        title: pushTitle,
        body: pushBody,
        meta: {
          resourceType: 'tenant',
          resourceId: String(tenant._id),
          daysLeft,
          trialEndsAt: tenant.trialEndsAt.toISOString(),
        },
      }).catch((err) => {
        logger.warn('[Trial Reminders] Push notification failed', { tenantId: tenant._id, error: err.message });
      });
    }

    logger.info('[Trial Reminders] Completed successfully', {
      trialingTenantsCount: trialingTenants.length,
      emailsSent,
    });

    return { success: true, emailsSent };
  } catch (error) {
    logger.error('[Trial Reminders] Failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = { sendTrialEndingReminders };
