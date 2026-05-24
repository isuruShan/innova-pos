const { getMailTransporter } = require('@innovapos/mail-transport');
const {
  getPlatformContact,
  wrapEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  emailPanel,
  emailAlert,
  esc,
} = require('@innovapos/platform-contact');

const sendEmail = async ({ to, subject, html, text }) => {
  const contact = await getPlatformContact().catch(() => null);
  const wrapped = wrapEmailHtml(html, contact);
  const t = getMailTransporter();
  const from = `Cafinity <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`;
  await t.sendMail({ from, to, subject, html: wrapped, text });
};

/**
 * Send welcome email with role-appropriate content.
 * @param {Object} params
 * @param {string} params.to - Email address
 * @param {string} params.name - User's display name
 * @param {string} params.tempPassword - Temporary password
 * @param {string} params.loginUrl - Login URL for the appropriate portal
 * @param {string} [params.role] - User role (merchant_admin, manager, cashier, kitchen)
 */
const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl, role }) => {
  const isOwner = role === 'merchant_admin';
  const isStaff = ['manager', 'cashier', 'kitchen'].includes(role);
  const roleLabel = role ? role.replace(/_/g, ' ') : '';
  
  // Different heading and intro based on role
  const heading = isOwner 
    ? 'Welcome to Cafinity! 🎉' 
    : `You've been added to a Cafinity team! 🎉`;
  
  const subheading = isOwner
    ? 'Your account is ready to use'
    : 'Your staff account is ready';

  const intro = isOwner
    ? 'Congratulations! Your merchant account has been verified and is now active. You can start using Cafinity to manage your café or restaurant right away.'
    : `Your administrator has created a <strong>${roleLabel}</strong> account for you. Use the credentials below to log in and start using the POS system.`;

  const subject = isOwner
    ? '🎉 Welcome to Cafinity - Your Account is Ready!'
    : `🎉 Welcome to Cafinity - Your ${roleLabel} Account is Ready!`;

  const html = `
    ${emailHeading(heading, subheading)}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph(intro)}
    ${emailPanel(`
      <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#16213e;text-transform:uppercase;letter-spacing:0.05em">Your Login Credentials</p>
      <div style="margin:0 0 14px;padding:12px 0;border-bottom:2px solid #e2e8f0">
        <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Email</p>
        <p style="margin:0;color:#16213e;font-weight:700;font-size:16px">${esc(to)}</p>
      </div>
      <div>
        <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">Temporary Password</p>
        <p style="margin:0;font-family:monospace;font-size:20px;letter-spacing:3px;color:#ff6b35;font-weight:800;background:#fff3ed;padding:14px 18px;border-radius:8px;text-align:center">${esc(tempPassword)}</p>
      </div>
    `)}
    ${emailAlert('<strong>Security Notice:</strong> Please change your password immediately after your first login. Never share your password with anyone.', 'warning')}
    ${emailButton(loginUrl, '🔒 Login to Your Account')}
    ${emailParagraph('<span style="color:#94a3b8;font-size:14px">Need help getting started? Our support team is here to assist you every step of the way.</span>')}
  `;
  await sendEmail({ to, subject, html });
};

const sendRejectionEmail = async ({ to, name, reason }) => {
  const html = `
    ${emailHeading('Application Update', 'We\'ve reviewed your application')}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph('Thank you for your interest in Cafinity. After careful review, we were unable to approve your application at this time.')}
    ${emailAlert(`
      <p style="margin:0 0 8px;font-weight:700;color:#991b1b;font-size:15px">Reason for Decision</p>
      <p style="margin:0;color:#1e293b;line-height:1.7">${esc(reason)}</p>
    `, 'error')}
    ${emailParagraph('We appreciate your understanding. If you have questions or would like to discuss your application further, please don\'t hesitate to contact our support team using the details below.')}
    ${emailParagraph('<span style="color:#94a3b8;font-size:14px">We wish you the best in your business endeavors.</span>')}
  `;
  await sendEmail({ to, subject: 'Cafinity Application Status Update', html });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const html = `
    ${emailHeading('Password Reset Request 🔐', 'Reset your Cafinity password')}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph('We received a request to reset your password. Click the button below to create a new password for your account.')}
    ${emailAlert('🕒 <strong>This link expires in 1 hour</strong> for security. If it expires, you can request a new one.', 'warning')}
    ${emailButton(resetUrl, '🔑 Reset My Password')}
    ${emailParagraph('<span style="color:#94a3b8;font-size:14px"><strong>Didn\'t request this?</strong> You can safely ignore this email. Your password will remain unchanged.</span>')}
    ${emailPanel(`
      <p style="margin:0;font-size:14px;color:#64748b;line-height:1.7">
        <strong style="color:#16213e">Security Tip:</strong> Always use a strong, unique password. Never share your password with anyone, even Cafinity staff.
      </p>
    `)}
  `;
  await sendEmail({ to, subject: '🔐 Reset Your Cafinity Password', html });
};

module.exports = { sendEmail, sendWelcomeEmail, sendRejectionEmail, sendPasswordResetEmail };
