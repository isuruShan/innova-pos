const mongoose = require('mongoose');

const platformUserSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true },
  },
  { collection: 'users', strict: false }
);

module.exports =
  mongoose.models.PlatformUserLookup ||
  mongoose.model('PlatformUserLookup', platformUserSchema);
