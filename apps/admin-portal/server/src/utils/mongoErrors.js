/** Map Mongo duplicate key errors to a short user-facing message. */
function friendlyDuplicateKeyMessage(err) {
  if (err?.code !== 11000) return null;
  const k = err.keyValue || {};
  if (k.label != null) {
    return `A table named "${k.label}" already exists for this store. Choose a different name.`;
  }
  if (k.qrToken != null) return 'This QR link is already in use. Regenerate the code and try again.';
  return 'This would create a duplicate record. Check for an existing entry with the same details.';
}

function handleWriteError(err, res, fallback = 'Save failed') {
  const dup = friendlyDuplicateKeyMessage(err);
  if (dup) {
    return res.status(409).json({ message: dup });
  }
  return res.status(400).json({ message: err.message || fallback });
}

module.exports = { friendlyDuplicateKeyMessage, handleWriteError };
