import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fv = require('./index.js');

export const LIMITS = fv.LIMITS;
export const PLACEHOLDERS = fv.PLACEHOLDERS;
export const trim = fv.trim;
export const validateRequired = fv.validateRequired;
export const validatePersonName = fv.validatePersonName;
export const validateBusinessName = fv.validateBusinessName;
export const validateEmail = fv.validateEmail;
export const validatePassword = fv.validatePassword;
export const validateMobile = fv.validateMobile;
export const validateNotes = fv.validateNotes;
export const fieldAttrs = fv.fieldAttrs;
