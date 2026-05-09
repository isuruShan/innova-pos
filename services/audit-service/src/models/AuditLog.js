const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userEmail: { type: String, default: null },
    userRole: { type: String, default: null },

    action: { type: String, required: true, index: true },
    resource: { type: String, required: true, index: true },
    resourceId: { type: String, default: null },

    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    serviceSource: { type: String, default: 'unknown' },

    // Immutable timestamp — set explicitly to prevent updates
    timestamp: { type: Date, default: Date.now, immutable: true, index: true },
  },
  {
    timestamps: false,   // We use our own timestamp field
    versionKey: false,
  }
);

// No updates allowed — audit logs are append-only
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable'));
  }
  next();
});

auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ tenantId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
