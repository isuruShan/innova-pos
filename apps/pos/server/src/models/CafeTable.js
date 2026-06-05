const crypto = require('crypto');
const mongoose = require('mongoose');

/** Café floor table (avoids reserved name "Table" in some contexts) */
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
    /** Seating capacity for this table */
    capacity: { type: Number, default: 4, min: 1, max: 20 },
    /** Shape of the table (for visual layouts) */
    shape: { type: String, enum: ['rectangle', 'round', 'booth', 'bar'], default: 'rectangle' },
    /** Secret segment for public QR ordering links (unguessable). Indexed via schema.index below (unique sparse). */
    qrToken: { type: String, default: null },
    /** Throttle repeated “call waiter” from the same table QR link. */
    lastWaiterCallAt: { type: Date, default: null },
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

cafeTableSchema.pre('save', function ensureQrToken() {
  if (!this.qrToken) {
    this.qrToken = generateQrToken();
  }
});

const CafeTable = mongoose.model('CafeTable', cafeTableSchema);
CafeTable.generateQrToken = generateQrToken;
module.exports = CafeTable;

