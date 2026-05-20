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

const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl }) => {
  await sendEmail({
    to,
    subject: 'Welcome to Cafinity — Your account is ready',
    html: `
      ${emailHeading('Welcome aboard!', 'Your merchant account is active')}
      ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
      ${emailParagraph('Your merchant account has been verified. Use the credentials below to sign in, then change your password right away.')}
      ${emailPanel(`
        <p style="margin:0 0 10px;font-size:13px;color:#64748b;font-weight:600">Login URL</p>
        <p style="margin:0 0 18px"><a href="${esc(loginUrl)}" style="color:#e94560;font-weight:600;text-decoration:none">${esc(loginUrl)}</a></p>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600">Temporary password</p>
        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:3px;color:#16213e;font-family:monospace">${esc(tempPassword)}</p>
      `)}
      ${emailAlert('<strong style="color:#e94560">Please change your password</strong> immediately after your first login.', 'warning')}
      ${emailParagraph('You have a <strong>30-day free trial</strong> with full access to all features.')}
      ${emailButton(loginUrl, 'Access admin portal')}
    `,
  });
};

const sendRejectionEmail = async ({ to, name, reason }) => {
  await sendEmail({
    to,
    subject: 'Update on your Cafinity application',
    html: `
      ${emailHeading('Application update')}
      ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
      ${emailParagraph('Thank you for your interest in Cafinity. After reviewing your application, we were unable to approve it at this time.')}
      ${emailAlert(`
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#991b1b">Reason</p>
        <p style="margin:0;color:#334155;line-height:1.55">${esc(reason)}</p>
      `, 'error')}
      ${emailParagraph('If you believe this is an error or would like to re-apply with updated information, please contact our support team using the details in the footer below.')}
    `,
  });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: 'Cafinity password reset request',
    html: `
      ${emailHeading('Reset your password')}
      ${emailParagraph(`Hi ${esc(name || 'there')},`)}
      ${emailParagraph('We received a request to reset your password. This link expires in <strong>30 minutes</strong>.')}
      ${emailButton(resetUrl, 'Reset password')}
      ${emailParagraph('<span style="color:#64748b;font-size:13px">If you did not request this, you can safely ignore this email.</span>')}
    `,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendRejectionEmail,
  sendPasswordResetEmail,
  getMailConfigurationIssue,
};
