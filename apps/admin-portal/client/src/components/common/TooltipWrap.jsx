/** Simple accessible tooltip via native title + optional hint for icon buttons */
export default function TooltipWrap({ label, children, className = '' }) {
  if (!label) return children;
  return (
    <span className={`inline-flex ${className}`} title={label} aria-label={label}>
      {children}
    </span>
  );
}
