export default function StatCard({ label, value, icon: Icon, color = 'amber', sub }) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-[#1e293b] rounded-2xl p-5 border border-slate-700/50 flex items-start gap-4">
      {Icon && (
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border flex-shrink-0 ${colors[color]}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
