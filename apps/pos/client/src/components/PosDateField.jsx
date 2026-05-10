/**
 * Native date input styled for POS — replaces popup calendar for consistent layout.
 */
export default function PosDateField({
  value,
  onChange,
  min,
  max,
  id,
  disabled,
  className = '',
}) {
  return (
    <input
      type="date"
      id={id}
      disabled={disabled}
      min={min}
      max={max}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={className}
    />
  );
}
