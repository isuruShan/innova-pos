const express = require('express');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendEmail } = require('../utils/mailer');

const router = express.Router();

router.post('/', async (req, res) => {
  const { email, name } = req.body;
  if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });

  try {
    await NewsletterSubscriber.create({
      email: email.toLowerCase().trim(),
      name: (name || '').trim(),
      source: 'website',
    });

    sendEmail({
      to: email,
      subject: 'Welcome to InnovaPOS Newsletter',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a1a2e">You're subscribed!</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Thanks for subscribing to InnovaPOS updates. We'll keep you informed about new features, tips, and offers.</p>
          <p style="color:#888;font-size:12px;margin-top:24px">InnovaSolutions — InnovaPOS Platform</p>
        </div>
      `,
    }).catch(() => {});

    res.status(201).json({ message: 'Subscribed successfully!' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ message: 'Already subscribed!' });
    }
    res.status(500).json({ message: 'Subscription failed' });
  }
});

module.exports = router;
