import { Grid3X3, Table2 } from 'lucide-react';

export default function ViewModeToggle({ mode, setMode }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
      <button
        type="button"
        onClick={() => setMode('grid')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          mode === 'grid' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
        }`}
      >
        <Grid3X3 size={13} />
        Grid
      </button>
      <button
        type="button"
        onClick={() => setMode('table')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          mode === 'table' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
        }`}
      >
        <Table2 size={13} />
        Table
      </button>
    </div>
  );
}
