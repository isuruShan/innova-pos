export default function StatCard({ label, value, icon: Icon, color = 'amber', sub }) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-[var(--pos-panel)] rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-slate-700/50 flex items-start gap-2.5 sm:gap-4">
      {Icon && (
        <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center border flex-shrink-0 ${colors[color]}`}>
          <Icon size={15} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider leading-tight">{label}</p>
        <p className="text-base sm:text-2xl font-bold text-[var(--pos-text-primary)] mt-0.5 truncate leading-tight" title={value}>{value}</p>
        {sub && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate" title={sub}>{sub}</p>}
      </div>
    </div>
  );
}
