const express = require('express');
const { sendEmail } = require('../utils/mailer');
const { validateContactForm } = require('@innovapos/form-validation');
const Prospect = require('../models/Prospect');

const { getPlatformContact } = require('@innovapos/platform-contact');

const router = express.Router();

router.get('/platform', async (req, res) => {
  try {
    const contact = await getPlatformContact();
    res.json(contact);
  } catch (err) {
    console.error('Error fetching platform contact: ', err);
    res.status(500).json({ message: 'Failed to retrieve contact details' });
  }
});

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
    // Save lead to Prospect collection first
    await new Prospect({
      name: safeName,
      email: safeEmail,
      subject: safeSubject,
      message: safeMessage,
      status: 'new'
    }).save();

    // Wrap email dispatch in try/catch to gracefully handle SMTP issues
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
    } catch (emailErr) {
      console.error('SMTP Error during contact submission: ', emailErr);
      // Do not rethrow, we want to succeed because the lead was saved to DB
    }

    res.json({ message: 'Message sent. We will get back to you soon!' });
  } catch (err) {
    console.error('Error saving prospect: ', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
});

module.exports = router;
