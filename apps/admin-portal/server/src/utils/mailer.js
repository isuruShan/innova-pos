const { getMailTransporter, getMailConfigurationIssue } = require('@innovapos/mail-transport');
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

const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  const contact = await getPlatformContact().catch(() => null);
  const wrapped = wrapEmailHtml(html, contact);
  const t = getMailTransporter();
  await t.sendMail({
    from: `Cafinity <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`,
    to,
    subject,
    html: wrapped,
  });
};

const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl, role = 'merchant_admin' }) => {
  const isMerchantAdmin = role === 'merchant_admin';
  const roleLabel = role === 'manager' ? 'Manager' : role === 'cashier' ? 'Cashier' : role === 'kitchen_staff' ? 'Kitchen Staff' : role;
  
  const subject = isMerchantAdmin
    ? '🎉 Welcome to Cafinity — Your Account is Ready!'
    : `🎒 Welcome to the Team — Your Cafinity ${roleLabel} Account is Ready!`;

  const heading = isMerchantAdmin
    ? emailHeading('Welcome to Cafinity! 🎉', 'Your merchant account is active')
    : emailHeading('Welcome to the Team! 🎒', `Your ${roleLabel.toLowerCase()} account is ready`);

  const body = isMerchantAdmin
    ? emailParagraph(`Hi <strong>${esc(name)}</strong>,`) +
      emailParagraph('Congratulations! Your merchant account has been verified and is ready to use. You can start managing your café or restaurant right away.')
    : emailParagraph(`Hi <strong>${esc(name)}</strong>,`) +
      emailParagraph(`Your administrator has created a Cafinity account for you as a <strong>${esc(roleLabel)}</strong>. You can now log in using the credentials below.`);

  const trialPanel = isMerchantAdmin
    ? emailPanel(`
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#10b981">🎁 30-Day Free Trial</p>
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.7">You have full access to all features for 30 days. No credit card required!</p>
      `)
    : '';

  const buttonLabel = isMerchantAdmin ? '🚀 Access Admin Portal' : '🚀 Log In to POS';

  await sendEmail({
    to,
    subject,
    html: `
      ${heading}
      ${body}
      ${emailPanel(`
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#16213e;text-transform:uppercase;letter-spacing:0.05em">Your Credentials</p>
        <div style="margin:0 0 16px">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase">Login URL</p>
          <p style="margin:0"><a href="${esc(loginUrl)}" style="color:#ff6b35;font-weight:700;text-decoration:none;font-size:15px">${esc(loginUrl)}</a></p>
        </div>
        <div style="margin:0 0 14px;padding:12px 0;border-top:2px solid #e2e8f0">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase">Temporary Password</p>
          <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:3px;color:#ff6b35;font-family:monospace;background:#fff3ed;padding:14px;border-radius:8px;text-align:center">${esc(tempPassword)}</p>
        </div>
      `)}
      ${emailAlert('<strong>🔒 Security First:</strong> Change this temporary password immediately after your first login. Never share your password with anyone!', 'warning')}
      ${trialPanel}
      ${emailButton(loginUrl, buttonLabel)}
    `,
  });
};

const sendRejectionEmail = async ({ to, name, reason }) => {
  await sendEmail({
    to,
    subject: 'Cafinity Application Status Update',
    html: `
      ${emailHeading('Application Update', 'We\'ve reviewed your application')}
      ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
      ${emailParagraph('Thank you for your interest in Cafinity. After careful review, we were unable to approve your application at this time.')}
      ${emailAlert(`
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#991b1b">Reason for Decision</p>
        <p style="margin:0;color:#334155;line-height:1.7;font-size:15px">${esc(reason)}</p>
      `, 'error')}
      ${emailParagraph('If you believe this is an error or would like to re-apply with updated information, please don\'t hesitate to contact our support team using the details below.')}
      ${emailParagraph('<span style="color:#94a3b8;font-size:14px">We appreciate your understanding and wish you the best in your business endeavors.</span>')}
    `,
  });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: '🔐 Reset Your Cafinity Password',
    html: `
      ${emailHeading('Password Reset Request 🔑', 'Reset your password securely')}
      ${emailParagraph(`Hi <strong>${esc(name || 'there')}</strong>,`)}
      ${emailParagraph('We received a request to reset your password. Click the button below to create a new password.')}
      ${emailAlert('🕒 <strong>This link expires in 30 minutes</strong> for your security. If it expires, you can request a new one.', 'warning')}
      ${emailButton(resetUrl, '🔑 Reset My Password')}
      ${emailParagraph('<span style="color:#94a3b8;font-size:14px"><strong>Didn\'t request this?</strong> You can safely ignore this email. Your password will remain unchanged.</span>')}
      ${emailPanel(`
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.7">
          <strong style="color:#16213e">🛡️ Security Tip:</strong> Always use a strong, unique password. Never share your password with anyone.
        </p>
      `)}
    `,
  });
};

const sendAdminResetPasswordEmail = async ({ to, name, tempPassword, loginUrl, adminName, businessName }) => {
  const adminLabel = adminName ? `${esc(adminName)} (an administrator)` : 'An administrator';
  const bizLabel = businessName ? `for <strong>${esc(businessName)}</strong>` : 'for your organization';

  await sendEmail({
    to,
    subject: `🔐 Temporary Password for your ${esc(businessName || 'Cafinity')} Account`,
    html: `
      ${emailHeading('Password Reset by Admin 🔑', 'Your password has been updated')}
      ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
      ${emailParagraph(`${adminLabel} ${bizLabel} has reset the password for your Cafinity account (<strong>${esc(to)}</strong>).`)}
      ${emailParagraph('A temporary password has been generated so you can log in. Please use the credentials below to access the platform:')}
      ${emailPanel(`
        <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#16213e;text-transform:uppercase;letter-spacing:0.05em">Access Details</p>
        <div style="margin:0 0 16px">
          <p style="margin:0 0 4px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase">Login URL</p>
          <p style="margin:0"><a href="${esc(loginUrl)}" style="color:#ff6b35;font-weight:700;text-decoration:none;font-size:15px">${esc(loginUrl)}</a></p>
        </div>
        <div style="margin:0 0 14px;padding:12px 0;border-top:2px solid #e2e8f0">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase">Temporary Password</p>
          <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:3px;color:#ff6b35;font-family:monospace;background:#fff3ed;padding:14px;border-radius:8px;text-align:center">${esc(tempPassword)}</p>
        </div>
      `)}
      ${emailAlert('<strong>🔒 Immediate Action Required:</strong> For security reasons, you will be prompted to change this temporary password immediately upon your first login.', 'warning')}
      ${emailParagraph('<span style="color:#94a3b8;font-size:14px">If you did not request this change or believe this is an error, please contact your café or restaurant administrator immediately.</span>')}
      ${emailButton(loginUrl, '🚀 Log In and Reset Password')}
    `,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
  sendAdminResetPasswordEmail,
  getMailConfigurationIssue,
};
