/**
 * Back-compat shim — storage backend is selected via STORAGE_PROVIDER (azure | aws).
 */
const { uploadObject, getPresignedUrl, deleteObject } = require('@innovapos/object-storage');

module.exports = {
  uploadToS3: uploadObject,
  getPresignedUrl,
  deleteFromS3: deleteObject,
};
