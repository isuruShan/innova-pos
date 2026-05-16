const express = require('express');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();

router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ message: 'Name, email, and message are required' });
  }

  try {
    await sendEmail({
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_FROM,
      subject: `[Cafinity Contact] ${subject || 'New message'} — from ${name}`,
      html: `
        <motion.div style="font-family:Arial,sans-serif;max-width:600px">
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject || '—'}</p>
          <p><strong>Message:</strong></p>
          <div style="background:#f5f5f5;padding:16px;border-radius:6px">${message.replace(/\n/g, '<br>')}</div>
        </div>
      `,
    });
    res.json({ message: 'Message sent. We will get back to you soon!' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

module.exports = router;
