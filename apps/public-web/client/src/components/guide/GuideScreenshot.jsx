/** Visual frame for guide docs — real image or a labeled UI placeholder. */
export default function GuideScreenshot({ src, alt, caption, portal = 'admin' }) {
  const badge =
    portal === 'pos'
      ? 'bg-slate-800 text-amber-300 border-slate-600'
      : portal === 'web'
        ? 'bg-teal-50 text-teal-800 border-teal-200'
        : 'bg-orange-50 text-brand-orange border-orange-200';

  const label = portal === 'pos' ? 'POS app' : portal === 'web' ? 'Public website' : 'Admin portal';

  return (
    <figure className="my-6 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className={`px-3 py-1.5 text-xs font-semibold border-b ${badge}`}>{label}</div>
      {src ? (
        <img src={src} alt={alt || caption || ''} className="w-full h-auto block bg-gray-100" loading="lazy" />
      ) : (
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-8">
          <p className="text-sm text-gray-500 text-center">{alt || 'Screenshot'}</p>
        </div>
      )}
      {caption ? (
        <figcaption className="px-4 py-2.5 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
