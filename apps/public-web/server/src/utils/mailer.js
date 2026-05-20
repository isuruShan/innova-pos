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

const sendApplicationReceivedEmail = async ({ to, name }) => {
  await sendEmail({
    to,
    subject: 'Your Cafinity application is under review',
    html: `
        <h2 style="color:#1a1a2e">Application Under Review — Cafinity</h2>
        <p>Hi ${name},</p>
        <p>Thank you for applying to Cafinity! Your request is now <strong>under review</strong> and our team will review it within <strong>1–2 business days</strong>.</p>
        <p>You will receive an email once the review is complete with further instructions.</p>
    `,
  });
};

module.exports = { sendEmail, sendApplicationReceivedEmail };
