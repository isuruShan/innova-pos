const { getMailTransporter } = require('@innovapos/mail-transport');

const sendEmail = async ({ to, subject, html }) => {
  if (!to) return;
  const t = getMailTransporter();
  await t.sendMail({
    from: `Cafinity <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`,
    to,
    subject,
    html,
  });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  await sendEmail({
    to,
    subject: 'Cafinity password reset request',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">Reset your password</h2>
        <p>Hi ${name || 'there'},</p>
        <p>We received a request to reset your password. This link will expire in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#e94560;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset Password</a></p>
        <p style="font-size:12px;color:#888">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendPasswordResetEmail };
