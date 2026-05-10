const { getMailTransporter } = require('@innovapos/mail-transport');

const sendEmail = async ({ to, subject, html }) => {
  const t = getMailTransporter();
  await t.sendMail({
    from: `Cafinity <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`,
    to,
    subject,
    html,
  });
};

const sendApplicationReceivedEmail = async ({ to, name }) => {
  await sendEmail({
    to,
    subject: 'Your Cafinity application is under review',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">Application Under Review — Cafinity</h2>
        <p>Hi ${name},</p>
        <p>Thank you for applying to Cafinity! Your request is now <strong>under review</strong> and our team will review it within <strong>1–2 business days</strong>.</p>
        <p>You will receive an email once the review is complete with further instructions.</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Cafinity</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendApplicationReceivedEmail };
