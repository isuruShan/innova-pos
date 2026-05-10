const { getMailTransporter } = require('@innovapos/mail-transport');

/**
 * Send a transactional email.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const t = getMailTransporter();
  const from = `Cafinity <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`;

  await t.sendMail({ from, to, subject, html, text });
};

/**
 * Send welcome email with temporary password.
 */
const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Welcome to Cafinity, ${name}!</h2>
      <p>Your merchant account has been verified and is ready to use.</p>
      <p>Here are your login credentials:</p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
      </div>
      <p><strong>Please change your password after your first login.</strong></p>
      <a href="${loginUrl}" style="display: inline-block; background: #e94560; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
        Login to POS
      </a>
      <p style="margin-top: 24px; color: #888; font-size: 12px;">InnovaSolutions &mdash; InnovaPOS Platform</p>
    </div>
  `;
  await sendEmail({ to, subject: 'Your Cafinity account is ready', html });
};

/**
 * Send verification rejection email.
 */
const sendRejectionEmail = async ({ to, name, reason }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Application Update — ${name}</h2>
      <p>Thank you for your interest in Cafinity.</p>
      <p>After reviewing your application, we were unable to approve it at this time.</p>
      <div style="background: #fff3f3; padding: 16px; border-radius: 8px; border-left: 4px solid #e94560; margin: 16px 0;">
        <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
      </div>
      <p>If you believe this is a mistake or have additional information, please contact us at
        <a href="mailto:${process.env.EMAIL_FROM}">${process.env.EMAIL_FROM}</a>.
      </p>
      <p style="margin-top: 24px; color: #888; font-size: 12px;">InnovaSolutions &mdash; InnovaPOS Platform</p>
    </div>
  `;
  await sendEmail({ to, subject: 'InnovaPOS Application Status Update', html });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Password Reset Request</h2>
      <p>Hi ${name}, we received a request to reset your password.</p>
      <p>Click the button below to reset your password (valid for 1 hour):</p>
      <a href="${resetUrl}" style="display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 8px 0;">
        Reset Password
      </a>
      <p style="color: #888; font-size: 12px;">If you did not request this, please ignore this email.</p>
      <p style="margin-top: 24px; color: #888; font-size: 12px;">InnovaSolutions &mdash; InnovaPOS Platform</p>
    </div>
  `;
  await sendEmail({ to, subject: 'Reset your Cafinity password', html });
};

module.exports = { sendEmail, sendWelcomeEmail, sendRejectionEmail, sendPasswordResetEmail };
