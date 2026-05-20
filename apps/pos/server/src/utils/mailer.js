const { getMailTransporter } = require('@innovapos/mail-transport');
const {
  getPlatformContact,
  wrapEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  esc,
} = require('@innovapos/platform-contact');

const sendEmail = async ({ to, subject, html }) => {
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

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: 'Cafinity password reset request',
    html: `
      ${emailHeading('Reset your password')}
      ${emailParagraph(`Hi ${esc(name || 'there')},`)}
      ${emailParagraph('Use the button below to reset your POS password. This link expires in <strong>30 minutes</strong>.')}
      ${emailButton(resetUrl, 'Reset password')}
      ${emailParagraph('<span style="color:#64748b;font-size:13px">If you did not request this, please ignore this email.</span>')}
    `,
  });
};

module.exports = { sendEmail, sendPasswordResetEmail };
