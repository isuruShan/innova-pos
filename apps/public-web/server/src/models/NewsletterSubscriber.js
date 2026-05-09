const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '', trim: true },
    confirmed: { type: Boolean, default: true },
    source: { type: String, default: 'website', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
