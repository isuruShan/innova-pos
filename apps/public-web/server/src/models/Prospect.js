const mongoose = require('mongoose');

const prospectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, default: '', trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  },
  { timestamps: true }
);

prospectSchema.index({ createdAt: -1 });
prospectSchema.index({ status: 1 });

module.exports = mongoose.model('Prospect', prospectSchema, 'prospects');
