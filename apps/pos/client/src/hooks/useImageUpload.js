import { useState, useCallback } from 'react';
import { optimizeImage, readAsDataURL } from '../utils/imageUpload';
import api from '../api/axios';

/**
 * Hook for handling image uploads with automatic compression and WebP conversion.
 *
 * Usage:
 *   const { upload, uploading, progress, error } = useImageUpload('menu');
 *   const result = await upload(file); // result: { key, url, size, mimeType }
 */
export const useImageUpload = (type = 'menu') => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = useCallback(async (file) => {
    if (!file) throw new Error('No file provided');
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Optimise + convert to WebP (PDFs passed through unchanged)
      const optimized = await optimizeImage(file, type, (pct) => setProgress(Math.round(pct * 0.5)));

      const formData = new FormData();
      formData.append('image', optimized);
      formData.append('type', type);

      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 50) + 50;
          setProgress(pct);
        },
      });

      setProgress(100);
      return data; // { key, url, size, mimeType }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  }, [type]);

  /**
   * Generate a local preview URL from a file (before uploading).
   */
  const preview = useCallback(async (file) => {
    if (!file) return null;
    if (file.type === 'application/pdf') return null;
    return readAsDataURL(file);
  }, []);

  return { upload, preview, uploading, progress, error };
};
