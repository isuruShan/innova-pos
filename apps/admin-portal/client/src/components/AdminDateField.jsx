/**
 * Native date input — same interaction model as POS (no popup calendar library).
 */
export default function AdminDateField({
  value,
  onChange,
  min,
  max,
  id,
  disabled,
  required,
  className = '',
  ...rest
}) {
  return (
    <input
      type="date"
      id={id}
      disabled={disabled}
      required={required}
      min={min}
      max={max}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={
        className ||
        'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30'
      }
      {...rest}
    />
  );
}
