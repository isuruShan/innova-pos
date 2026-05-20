const { getMailTransporter } = require('@innovapos/mail-transport');
const { getPlatformContact, wrapEmailHtml } = require('@innovapos/platform-contact');

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
        <h2 style="color:#1a1a2e">Reset your password</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Use this link to reset your password. It expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#e94560;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset Password</a></p>
    `,
  });
};

module.exports = { sendEmail, sendPasswordResetEmail };
