import { Grid3X3, Table2 } from 'lucide-react';

export default function ViewModeToggle({ mode, setMode }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white p-1">
      <button
        type="button"
        onClick={() => setMode('grid')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
          mode === 'grid' ? 'bg-brand-brown-deep text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Grid3X3 size={13} />
        Grid
      </button>
      <button
        type="button"
        onClick={() => setMode('table')}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
          mode === 'table' ? 'bg-brand-brown-deep text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Table2 size={13} />
        Table
      </button>
    </div>
  );
}
