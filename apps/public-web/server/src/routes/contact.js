const express = require('express');
const rateLimit = require('express-rate-limit');
const { getRateLimitStore } = require('@innovapos/shared-middleware');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();

let contactLimiter = null;

/** Own Redis store instance — never pass a store shared with app.use(rateLimit(...)). */
async function initContactRateLimit(logger) {
  const store = await getRateLimitStore(logger, { prefix: 'rl:publicweb:contact' });
  contactLimiter = rateLimit({
    ...(store ? { store } : {}),
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { message: 'Too many messages sent' },
  });
}

router.post('/', (req, res, next) => {
  if (!contactLimiter) {
    return res.status(503).json({ message: 'Service unavailable' });
  }
  return contactLimiter(req, res, next);
}, async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return res.status(400).json({ message: 'Name, email, and message are required' });
  }

  try {
    await sendEmail({
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_FROM,
      subject: `[Cafinity Contact] ${subject || 'New message'} — from ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
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

router.initContactRateLimit = initContactRateLimit;
module.exports = router;
