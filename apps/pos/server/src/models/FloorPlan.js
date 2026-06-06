'use strict';

const mongoose = require('mongoose');

const tablePositionSchema = new mongoose.Schema({
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', required: true },
  x: { type: Number, required: true },           // Grid X position
  y: { type: Number, required: true },           // Grid Y position
  width: { type: Number, default: 1, min: 1, max: 4 },  // Grid units wide
  height: { type: Number, default: 1, min: 1, max: 4 }, // Grid units tall
  shape: { type: String, enum: ['rectangle', 'round', 'booth', 'bar'], default: 'rectangle' },
  rotation: { type: Number, default: 0, enum: [0, 90, 180, 270] },  // Degrees
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
  availableFrom: { type: String, default: null }, // HH:mm or null (always available)
  availableUntil: { type: String, default: null },
}, { _id: true });

const lineSchema = new mongoose.Schema({
  x1: { type: Number, required: true },
  y1: { type: Number, required: true },
  x2: { type: Number, required: true },
  y2: { type: Number, required: true },
  color: { type: String, default: '#94a3b8' },
  thickness: { type: Number, default: 2 },
}, { _id: true });

const textSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  text: { type: String, required: true, trim: true },
  color: { type: String, default: '#f8fafc' },
  fontSize: { type: Number, default: 14 },
}, { _id: true });

const floorPlanSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
  name: { type: String, default: 'Main Floor', trim: true, maxlength: 100 },
  gridWidth: { type: Number, default: 20, min: 5, max: 50 },    // Grid columns
  gridHeight: { type: Number, default: 15, min: 5, max: 40 },   // Grid rows
  cellSizePx: { type: Number, default: 50, min: 30, max: 100 }, // Pixel size per cell (for rendering)
  tables: [tablePositionSchema],
  zones: [zoneSchema],
  lines: [lineSchema],
  texts: [textSchema],
  isDefault: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

floorPlanSchema.index({ tenantId: 1, storeId: 1 });

module.exports = mongoose.model('FloorPlan', floorPlanSchema);
