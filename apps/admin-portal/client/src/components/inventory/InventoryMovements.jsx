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
  adjustment: 'text-amber-700 bg-amber-50 border border-amber-100',
  grn: 'text-green-700 bg-green-50 border border-green-100',
  goods_return: 'text-red-650 bg-red-50 border border-red-100',
  waste: 'text-orange-700 bg-orange-50 border border-orange-100',
  opening: 'text-blue-700 bg-blue-50 border border-blue-100',
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
        <Loader2 size={24} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f.key
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
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
            <Package size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">No stock movements found</p>
          </div>
        }
        columns={[
          {
            key: 'datetime',
            header: 'Date/Time',
            mobilePrimary: true,
            render: (m) => (
              <div className="flex flex-col">
                <span className="text-gray-700 text-xs font-medium">{new Date(m.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-400 text-[10px]">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ),
          },
          {
            key: 'item',
            header: 'Item',
            mobileSecondary: true,
            render: (m) => (
              <div className="flex items-center gap-2">
                <Package size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-800 font-medium">
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
                m.quantity >= 0 ? 'text-green-600' : 'text-red-500'
              }`}>
                {m.quantity >= 0 ? '+' : ''}{m.quantity}
              </span>
            ),
          },
          {
            key: 'type',
            header: 'Type',
            render: (m) => (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                MOVEMENT_TYPE_COLORS[m.type] || 'text-gray-550 bg-gray-100 border border-gray-200'
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
            render: (m) => <span className="text-gray-500">{m.previousQty}</span>,
          },
          {
            key: 'after',
            header: 'After',
            className: 'text-right',
            headerClassName: 'text-right',
            render: (m) => <span className="text-gray-900 font-medium">{m.newQty}</span>,
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (m) => (
              <div className="flex flex-col">
                <span className="text-gray-700 text-xs font-medium">{m.reason.replace(/_/g, ' ')}</span>
                {m.notes && (
                  <span className="text-gray-450 text-xs truncate max-w-[200px] mt-0.5" title={m.notes}>
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
                <User size={11} className="text-gray-400" />
                <span className="text-gray-500 text-xs">{m.createdBy?.name || 'Unknown'}</span>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

