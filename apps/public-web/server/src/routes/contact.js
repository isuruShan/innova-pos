const express = require('express');
const { sendEmail } = require('../utils/mailer');
const { validateContactForm } = require('@innovapos/form-validation');

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const errors = validateContactForm({ name, email, subject, message });
  const firstKey = Object.keys(errors)[0];
  if (firstKey) {
    return res.status(400).json({ message: errors[firstKey], errors });
  }

  const safeName = String(name).trim();
  const safeEmail = String(email).trim().toLowerCase();
  const safeSubject = String(subject || '').trim();
  const safeMessage = String(message).trim();

  try {
    await sendEmail({
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_FROM,
      subject: `[Cafinity Contact] ${safeSubject || 'New message'} — from ${safeName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Subject:</strong> ${safeSubject || '—'}</p>
          <p><strong>Message:</strong></p>
          <div style="background:#f5f5f5;padding:16px;border-radius:6px">${safeMessage.replace(/\n/g, '<br>')}</div>
        </div>
      `,
    });
    res.json({ message: 'Message sent. We will get back to you soon!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

module.exports = router;
