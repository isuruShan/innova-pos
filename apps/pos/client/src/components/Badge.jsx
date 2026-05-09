const variants = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  preparing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  ok: 'bg-green-500/20 text-green-400 border-green-500/30',
  low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function Badge({ label, variant }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${variants[variant] || variants.ok}`}>
      {label}
    </span>
  );
}
