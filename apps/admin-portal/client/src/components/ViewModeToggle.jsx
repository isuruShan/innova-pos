import { Grid3X3, Table2 } from 'lucide-react';

export default function ViewModeToggle({ mode, setMode }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1">
      <button
        type="button"
        onClick={() => setMode('grid')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          mode === 'grid' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
        }`}
      >
        <Grid3X3 size={13} />
        Grid
      </button>
      <button
        type="button"
        onClick={() => setMode('table')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          mode === 'table' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
        }`}
      >
        <Table2 size={13} />
        Table
      </button>
    </div>
  );
}
