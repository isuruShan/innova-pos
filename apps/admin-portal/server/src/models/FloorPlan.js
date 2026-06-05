'use strict';

const mongoose = require('mongoose');

const tablePositionSchema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, default: 1, min: 1, max: 4 },
  height: { type: Number, default: 1, min: 1, max: 4 },
  shape: { type: String, enum: ['rectangle', 'round', 'booth', 'bar'], default: 'rectangle' },
  rotation: { type: Number, default: 0, enum: [0, 90, 180, 270] },
  capacity: { type: Number, default: 4, min: 1, max: 20 },
}, { _id: false });

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  color: { type: String, default: '#3b82f6', match: /^#[0-9a-fA-F]{6}$/ },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  isOutdoor: { type: Boolean, default: false },
  availableFrom: { type: String, default: null },
  availableUntil: { type: String, default: null },
}, { _id: true });

const floorPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  name: { type: String, default: 'Main Floor', trim: true, maxlength: 100 },
  gridWidth: { type: Number, default: 20, min: 5, max: 50 },
  gridHeight: { type: Number, default: 15, min: 5, max: 40 },
  cellSizePx: { type: Number, default: 50, min: 30, max: 100 },
  tables: [tablePositionSchema],
  zones: [zoneSchema],
  isDefault: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

floorPlanSchema.index({ tenantId: 1, storeId: 1 });

module.exports = mongoose.model('FloorPlan', floorPlanSchema);
