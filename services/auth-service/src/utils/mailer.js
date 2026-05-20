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

const sendWelcomeEmail = async ({ to, name, tempPassword, loginUrl }) => {
  const html = `
    ${emailHeading('Welcome to Cafinity', 'Your account is ready')}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph('Your merchant account has been verified and is ready to use.')}
    ${emailPanel(`
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600">Email</p>
      <p style="margin:0 0 14px;color:#16213e;font-weight:600">${esc(to)}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600">Temporary password</p>
      <p style="margin:0;font-family:monospace;font-size:18px;letter-spacing:2px;color:#16213e">${esc(tempPassword)}</p>
    `)}
    ${emailAlert('<strong>Please change your password</strong> after your first login.', 'warning')}
    ${emailButton(loginUrl, 'Login to POS')}
  `;
  await sendEmail({ to, subject: 'Your Cafinity account is ready', html });
};

const sendRejectionEmail = async ({ to, name, reason }) => {
  const html = `
    ${emailHeading('Application update')}
    ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
    ${emailParagraph('Thank you for your interest in Cafinity. We were unable to approve your application at this time.')}
    ${emailAlert(`
      <p style="margin:0 0 6px;font-weight:700;color:#991b1b">Reason</p>
      <p style="margin:0">${esc(reason)}</p>
    `, 'error')}
    ${emailParagraph('Contact us using the details below if you have questions.')}
  `;
  await sendEmail({ to, subject: 'InnovaPOS Application Status Update', html });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const html = `
    ${emailHeading('Password reset')}
    ${emailParagraph(`Hi ${esc(name)},`)}
    ${emailParagraph('Click below to reset your password (valid for 1 hour).')}
    ${emailButton(resetUrl, 'Reset password')}
    ${emailParagraph('<span style="color:#64748b;font-size:13px">If you did not request this, ignore this email.</span>')}
  `;
  await sendEmail({ to, subject: 'Reset your Cafinity password', html });
};

module.exports = { sendEmail, sendWelcomeEmail, sendRejectionEmail, sendPasswordResetEmail };
