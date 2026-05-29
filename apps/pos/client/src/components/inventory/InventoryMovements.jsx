import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, Clock, User, FileText } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import ResponsiveTable from '../ResponsiveTable';

const MOVEMENT_TYPE_LABELS = {
  adjustment: 'Manual Adjustment',
  grn: 'Goods Receipt',
  goods_return: 'Goods Return',
  waste: 'Waste',
  opening: 'Opening Balance',
};

const MOVEMENT_TYPE_COLORS = {
  adjustment: 'text-amber-400 bg-amber-500/10',
  grn: 'text-green-400 bg-green-500/10',
  goods_return: 'text-red-400 bg-red-500/10',
  waste: 'text-orange-400 bg-orange-500/10',
  opening: 'text-blue-400 bg-blue-500/10',
};

export default function InventoryMovements() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [filter, setFilter] = useState('all');

  const { data: movements = [], isPending } = useQuery({
    queryKey: ['stock-movements', selectedStoreId, filter],
    queryFn: () => {
      const params = {};
      if (filter !== 'all') params.type = filter;
      return api.get('/stock-movements', { params }).then(r => r.data);
    },
    enabled: isStoreReady,
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'adjustment', label: 'Adjustments' },
          { key: 'grn', label: 'Receipts' },
          { key: 'goods_return', label: 'Returns' },
          { key: 'waste', label: 'Waste' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === f.key
                ? 'bg-amber-500 text-[var(--pos-selection-text)]'
                : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Movements Table */}
      <ResponsiveTable
        rows={movements}
        rowKey={(m) => m._id}
        emptyState={
          <div className="text-center py-8">
            <Package size={32} className="mx-auto mb-3 text-slate-500 opacity-50" />
            <p className="text-sm text-slate-500">No stock movements found</p>
          </div>
        }
        columns={[
          {
            key: 'datetime',
            header: 'Date/Time',
            mobilePrimary: true,
            render: (m) => (
              <div className="flex flex-col">
                <span className="text-slate-300 text-xs">{new Date(m.createdAt).toLocaleDateString()}</span>
                <span className="text-slate-500 text-xs">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ),
          },
          {
            key: 'item',
            header: 'Item',
            mobileSecondary: true,
            render: (m) => (
              <div className="flex items-center gap-2">
                <Package size={12} className="text-slate-500 flex-shrink-0" />
                <span className="text-slate-200 font-medium">
                  {m.inventoryItemId?.itemName || 'Unknown'}
                </span>
              </div>
            ),
          },
          {
            key: 'change',
            header: 'Change',
            mobileRight: true,
            className: 'text-right',
            headerClassName: 'text-right',
            render: (m) => (
              <span className={`font-semibold ${
                m.quantity >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {m.quantity >= 0 ? '+' : ''}{m.quantity}
              </span>
            ),
          },
          {
            key: 'type',
            header: 'Type',
            render: (m) => (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                MOVEMENT_TYPE_COLORS[m.type] || 'text-slate-400 bg-slate-800'
              }`}>
                {MOVEMENT_TYPE_LABELS[m.type] || m.type}
              </span>
            ),
          },
          {
            key: 'before',
            header: 'Before',
            className: 'text-right',
            headerClassName: 'text-right',
            render: (m) => <span className="text-slate-400">{m.previousQty}</span>,
          },
          {
            key: 'after',
            header: 'After',
            className: 'text-right',
            headerClassName: 'text-right',
            render: (m) => <span className="text-slate-200 font-medium">{m.newQty}</span>,
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (m) => (
              <div className="flex flex-col">
                <span className="text-slate-300 text-xs">{m.reason.replace(/_/g, ' ')}</span>
                {m.notes && (
                  <span className="text-slate-500 text-xs truncate max-w-[200px]" title={m.notes}>
                    {m.notes}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'user',
            header: 'User',
            render: (m) => (
              <div className="flex items-center gap-1.5">
                <User size={11} className="text-slate-500" />
                <span className="text-slate-400 text-xs">{m.createdBy?.name || 'Unknown'}</span>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
