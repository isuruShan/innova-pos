'use strict';

const crypto = require('crypto');

// Resolve a 32-byte key from environment variables
const secret = process.env.UBER_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-key-32-chars-long-123456';
const KEY = crypto.createHash('sha256').update(secret).digest();
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt a plain-text string
 * @param {string} text
 * @returns {string} iv:encryptedText (hex format)
 */
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a cipher-text string
 * @param {string} cipherText
 * @returns {string} decrypted plain-text
 */
function decrypt(cipherText) {
  if (!cipherText || !cipherText.includes(':')) return '';
  try {
    const [ivHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[Encryption] Decryption failed:', e.message);
    return '';
  }
}

module.exports = {
  encrypt,
  decrypt,
};
