const crypto = require('crypto');
const mongoose = require('mongoose');

const cafeTableSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    label: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    qrToken: { type: String, default: null, sparse: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

cafeTableSchema.index({ tenantId: 1, storeId: 1, label: 1 }, { unique: true });
cafeTableSchema.index({ qrToken: 1 }, { unique: true, sparse: true });

function generateQrToken() {
  return crypto.randomBytes(24).toString('hex');
}

cafeTableSchema.pre('save', function ensureQrToken(next) {
  if (!this.qrToken) {
    this.qrToken = generateQrToken();
  }
  next();
});

const CafeTable = mongoose.model('CafeTable', cafeTableSchema);
CafeTable.generateQrToken = generateQrToken;
module.exports = CafeTable;
