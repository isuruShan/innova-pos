const { getMailTransporter } = require('@innovapos/mail-transport');
const {
  getPlatformContact,
  wrapEmailHtml,
  emailHeading,
  emailParagraph,
  emailButton,
  emailLabelValue,
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

const sendApplicationReceivedEmail = async ({ to, name }) => {
  await sendEmail({
    to,
    subject: 'Your Cafinity application is under review',
    html: `
      ${emailHeading('Application received', 'We are reviewing your request')}
      ${emailParagraph(`Hi <strong>${esc(name)}</strong>,`)}
      ${emailParagraph('Thank you for applying to <strong>Cafinity</strong>. Your request is now <strong>under review</strong> and our team will respond within <strong>1–2 business days</strong>.')}
      ${emailParagraph('You will receive another email once the review is complete with next steps.')}
    `,
  });
};

const sendNewApplicationAdminEmail = async ({
  to,
  applicantName,
  businessName,
  email,
  mobile,
  applicationId,
  reviewUrl,
}) => {
  await sendEmail({
    to,
    subject: `New merchant application — ${businessName}`,
    html: `
      ${emailHeading('New merchant application', 'Action required')}
      ${emailParagraph('A new merchant signup was submitted and is waiting for review.')}
      ${emailLabelValue('Applicant', `<strong>${esc(applicantName)}</strong>`)}
      ${emailLabelValue('Business', `<strong>${esc(businessName)}</strong>`)}
      ${emailLabelValue('Email', esc(email))}
      ${emailLabelValue('Mobile', esc(mobile))}
      ${reviewUrl ? emailButton(reviewUrl, 'Review application') : ''}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Application ID: ${esc(applicationId)}</p>
    `,
  });
};

module.exports = { sendEmail, sendApplicationReceivedEmail, sendNewApplicationAdminEmail };
