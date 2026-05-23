import { Upload, ImageIcon, X, Loader } from 'lucide-react';

/** Accepted image MIME types and their file extensions */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.gif';
const ACCEPTED_LABEL = 'JPG, PNG, WEBP or GIF';

/**
 * Validate that a File object is an accepted image type.
 * Returns an error string or null.
 */
export function validateImageFile(file) {
  if (!file) return null;
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Please upload an image file (${ACCEPTED_LABEL}).`;
  }
  return null;
}

/**
 * Bank transfer receipt fields: reference + mandatory receipt image upload.
 * Supports two usage patterns:
 *   1. Controlled form (StoresPage / MerchantAddonsPage / UsersPage):
 *      bankReference, onBankReferenceChange, notes, onNotesChange, file,
 *      onFileChange, fileInputRef, error, isPending, onSubmit, submitLabel
 *
 * All props should be provided; no internal state is kept.
 */
export default function BankReceiptFields({
  bankReference,
  onBankReferenceChange,
  notes,
  onNotesChange,
  file,
  onFileChange,
  fileInputRef,
  error,
  bankReferenceError,
  fileError,
  submitLabel = 'Submit receipt',
  isPending = false,
  onSubmit,
}) {
  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] || null;
    if (!chosen) { onFileChange(null); return; }
    const err = validateImageFile(chosen);
    if (err) {
      // Reset the input so the same file can be re-chosen after correction
      e.target.value = '';
      onFileChange(null);
      // Propagate via the error channel by calling onFileChange with a
      // sentinel that callers recognise — simplest approach: call with null
      // and let the parent read the validation error separately.
      // We also call onFileChange with a special property so callers can
      // show the error. We pass null here and callers should handle via
      // a local validation step at submit time. However, to give immediate
      // feedback we invoke onFileChange with an object carrying the error.
      onFileChange({ _validationError: err });
      return;
    }
    onFileChange(chosen);
  };

  const openPicker = () => fileInputRef?.current?.click();

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Bank reference */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bank reference / transaction ID *
        </label>
        <input
          type="text"
          value={bankReference}
          onChange={(e) => onBankReferenceChange(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${bankReferenceError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          maxLength={64}
          placeholder="e.g. TXN-2026-001234"
        />
        {bankReferenceError && <p className="text-xs text-red-500 mt-1">{bankReferenceError}</p>}
      </div>

      {/* Receipt image upload */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">
            Receipt photo *
          </label>
          {/* Tooltip / hint */}
          <span
            title={`Upload a photo of your payment receipt. Accepted formats: ${ACCEPTED_LABEL}.`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 cursor-help select-none"
          >
            <ImageIcon size={12} />
            Images only ({ACCEPTED_LABEL})
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={handleFileChange}
        />
        {file && !file._validationError ? (
          <div className="flex items-center gap-2 text-sm text-gray-700 p-2 bg-green-50 border border-green-200 rounded-lg">
            <ImageIcon size={14} className="shrink-0 text-green-600" />
            <span className="truncate flex-1">{file.name}</span>
            <button
              type="button"
              className="p-0.5 rounded hover:bg-green-100 text-gray-500"
              onClick={() => { onFileChange(null); if (fileInputRef?.current) fileInputRef.current.value = ''; }}
              aria-label="Remove file"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-orange hover:text-brand-orange flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <Upload size={18} />
            <span>Click to upload receipt photo</span>
            <span className="text-xs text-gray-400">{ACCEPTED_LABEL}</span>
          </button>
        )}
        {file?._validationError && (
          <p className="text-xs text-red-500 mt-1">{file._validationError}</p>
        )}
        {!file?._validationError && fileError && (
          <p className="text-xs text-red-500 mt-1">{fileError}</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          maxLength={2000}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold disabled:opacity-60"
      >
        {isPending ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
        {submitLabel}
      </button>
    </form>
  );
}
