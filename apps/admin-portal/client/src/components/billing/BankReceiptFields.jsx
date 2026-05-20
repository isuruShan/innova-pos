import { Upload, FileText, Loader } from 'lucide-react';

/**
 * Bank transfer fields: reference + mandatory receipt (no payment date / bank name).
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
  submitLabel = 'Submit receipt',
  isPending = false,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bank reference / transaction ID *</label>
        <input
          type="text"
          value={bankReference}
          onChange={(e) => onBankReferenceChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          maxLength={64}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt photo / PDF *</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] || null)}
        />
        {file ? (
          <div className="flex items-center gap-2 text-sm text-gray-700 p-2 bg-green-50 border border-green-200 rounded-lg">
            <FileText size={14} className="shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <button type="button" className="text-xs underline text-gray-500" onClick={() => onFileChange(null)}>
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef?.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-orange flex items-center justify-center gap-2"
          >
            <Upload size={16} /> Upload receipt
          </button>
        )}
      </div>
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
