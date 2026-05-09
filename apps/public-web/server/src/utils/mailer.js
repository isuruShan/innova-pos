const { getMailTransporter } = require('@innovapos/mail-transport');

const sendEmail = async ({ to, subject, html }) => {
  const t = getMailTransporter();
  await t.sendMail({
    from: `InnovaPOS <${process.env.EMAIL_FROM || 'innovasolutionslk@gmail.com'}>`,
    to,
    subject,
    html,
  });
};

const sendApplicationReceivedEmail = async ({ to, name }) => {
  await sendEmail({
    to,
    subject: 'We received your InnovaPOS application',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#1a1a2e">Application Received — InnovaPOS</h2>
        <p>Hi ${name},</p>
        <p>Thank you for applying to InnovaPOS! We have received your application and our team will review it within <strong>1–2 business days</strong>.</p>
        <p>You will receive an email once the review is complete with further instructions.</p>
        <p style="color:#888;font-size:12px;margin-top:24px">InnovaSolutions — InnovaPOS Platform</p>
      </div>
    `,
  });
};

module.exports = { sendEmail, sendApplicationReceivedEmail };
