import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, Clock, User, FileText } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';

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
      {movements.length === 0 ? (
        <div className="text-center py-12 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
          <Package size={32} className="mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-sm text-slate-500">No stock movements found</p>
        </div>
      ) : (
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Change
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Before
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    After
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {movements.map((movement) => (
                  <tr key={movement._id} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-300 text-xs">
                          {new Date(movement.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {new Date(movement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Package size={12} className="text-slate-500 flex-shrink-0" />
                        <span className="text-slate-200 font-medium">
                          {movement.inventoryItemId?.itemName || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        MOVEMENT_TYPE_COLORS[movement.type] || 'text-slate-400 bg-slate-800'
                      }`}>
                        {MOVEMENT_TYPE_LABELS[movement.type] || movement.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        movement.quantity >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {movement.quantity >= 0 ? '+' : ''}{movement.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {movement.previousQty}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-medium">
                      {movement.newQty}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-300 text-xs">
                          {movement.reason.replace(/_/g, ' ')}
                        </span>
                        {movement.notes && (
                          <span className="text-slate-500 text-xs truncate max-w-[200px]" title={movement.notes}>
                            {movement.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User size={11} className="text-slate-500" />
                        <span className="text-slate-400 text-xs">
                          {movement.createdBy?.name || 'Unknown'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
