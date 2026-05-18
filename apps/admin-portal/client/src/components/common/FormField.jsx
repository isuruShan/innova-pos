/** Labeled form control — use instead of placeholder-only inputs. */
export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}) {
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      )}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange';
