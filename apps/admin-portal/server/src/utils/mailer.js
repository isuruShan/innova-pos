const { getMailTransporter, getMailConfigurationIssue } = require('@innovapos/mail-transport');

const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  const t = getMailTransporter();
  await t.sendMail({
    from: `InnovaPOS <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`,
    to,
    subject,
    html,
  });
};

const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl }) => {
  await sendEmail({
    to,
    subject: 'Welcome to InnovaPOS — Your account is ready',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1a2e;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#ffffff;font-size:24px;margin:0">Welcome to InnovaPOS!</h1>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Your merchant account has been verified and is now active! Here are your login credentials:</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">
            <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280">Login URL</p>
            <a href="${loginUrl}" style="color:#e94560;font-weight:bold">${loginUrl}</a>
            <p style="margin:16px 0 8px 0;font-size:14px;color:#6b7280">Temporary password</p>
            <p style="font-size:20px;font-weight:bold;letter-spacing:2px;color:#1a1a2e;margin:0">${tempPassword}</p>
          </div>

          <p style="color:#e94560;font-weight:bold">⚠ Please change your password immediately after logging in.</p>
          <p>You have a <strong>30-day free trial</strong> starting today. Enjoy all features with no restrictions.</p>

          <a href="${loginUrl}" style="display:inline-block;background:#e94560;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">
            Access your admin portal
          </a>

          <p style="color:#9ca3af;font-size:12px;margin-top:32px">InnovaSolutions — InnovaPOS Platform</p>
        </div>
      </div>
    `,
  });
};

const sendRejectionEmail = async ({ to, name, reason }) => {
  await sendEmail({
    to,
    subject: 'Update on your InnovaPOS application',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1a2e;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#ffffff;font-size:24px;margin:0">Application Update</h1>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Hi <strong>${name}</strong>,</p>
          <p>Thank you for your interest in InnovaPOS. After reviewing your application, we were unable to approve it at this time.</p>

          <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:16px;margin:20px 0">
            <p style="margin:0 0 8px 0;font-size:14px;color:#991b1b;font-weight:bold">Reason</p>
            <p style="margin:0;color:#1f2937">${reason}</p>
          </div>

          <p>If you believe this is an error or would like to re-apply with updated information, please contact us at
            <a href="mailto:innovasolutionslk@gmail.com" style="color:#e94560">innovasolutionslk@gmail.com</a>.
          </p>

          <p style="color:#9ca3af;font-size:12px;margin-top:32px">InnovaSolutions — InnovaPOS Platform</p>
        </div>
      </div>
    `,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendRejectionEmail,
  getMailConfigurationIssue,
};
