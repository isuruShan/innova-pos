import { useQuery } from '@tanstack/react-query';
import { Package, Truck, ArrowLeftRight, TrendingDown, ClipboardList } from 'lucide-react';
import api from '../api/axios';
import { useStoreContext } from '../context/StoreContext';
import { formatCurrency } from '../../../../admin-portal/client/src/utils/format';
import Badge from '../../../../admin-portal/client/src/components/Badge';

export default function DashboardPage() {
  const { selectedStoreId } = useStoreContext();

  const { data: items = [] } = useQuery({
    queryKey: ['ck-inventory', selectedStoreId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: !!selectedStoreId,
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['ck-transfers', selectedStoreId],
    queryFn: () => api.get('/advanced-inventory/transfers').then((r) => r.data),
    enabled: !!selectedStoreId,
  });

  const { data: pos = [] } = useQuery({
    queryKey: ['ck-pos', selectedStoreId],
    queryFn: () => api.get('/purchase-orders').then((r) => r.data),
    enabled: !!selectedStoreId,
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['ck-grns', selectedStoreId],
    queryFn: () => api.get('/goods-receipts').then((r) => r.data),
    enabled: !!selectedStoreId,
  });

  // Calculate metrics
  const totalStockValue = items.reduce((acc, item) => acc + (item.quantity * (item.wacCost || 0)), 0);
  const lowStockCount = items.filter(item => item.quantity < item.minThreshold).length;
  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;
  const activePOs = pos.filter(po => ['draft', 'sent', 'partial'].includes(po.status)).length;
  const recentGRNs = grns.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Commissary Dashboard</h2>
          <p className="text-sm text-slate-300 max-w-xl">
            Monitor central stock levels, authorize branch replenishment transfers, and manage procurement orders.
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 opacity-10 flex items-center justify-center pr-10">
          <Truck size={150} className="text-white" />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Central Stock Value',
            value: formatCurrency(totalStockValue),
            icon: Package,
            color: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
          },
          {
            label: 'Low Stock Items',
            value: lowStockCount,
            icon: TrendingDown,
            color: lowStockCount > 0 ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-200',
          },
          {
            label: 'Pending Branch Requests',
            value: pendingTransfers,
            icon: ArrowLeftRight,
            color: pendingTransfers > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-200',
          },
          {
            label: 'Active Purchase Orders',
            value: activePOs,
            icon: ClipboardList,
            color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
          },
        ].map((card, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{card.label}</p>
              <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
            </div>
            <div className={`p-3 rounded-xl border ${card.color}`}>
              <card.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Details Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent GRN Activity */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <ClipboardList size={16} /> Recent Receipts
          </h3>
          <div className="divide-y divide-gray-150">
            {recentGRNs.length === 0 ? (
              <p className="text-gray-400 text-xs py-4 text-center">No recent goods receipts logged.</p>
            ) : (
              recentGRNs.map((g) => (
                <div key={g._id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-gray-800">{g.receiptNumber}</p>
                    <p className="text-gray-500">{new Date(g.receiptDate).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(g.totalAmount)}</p>
                    <Badge variant={g.status === 'confirmed' ? 'ok' : 'neutral'}>
                      {g.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500" /> Low Stock Watchlist
          </h3>
          <div className="divide-y divide-gray-150">
            {items.filter(i => i.quantity < i.minThreshold).slice(0, 5).length === 0 ? (
              <p className="text-gray-400 text-xs py-4 text-center">All central inventory items are at healthy levels.</p>
            ) : (
              items
                .filter(i => i.quantity < i.minThreshold)
                .slice(0, 5)
                .map((item) => (
                  <div key={item._id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-gray-800">{item.itemName}</p>
                      <p className="text-gray-500">Min. Threshold: {item.minThreshold} {item.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-650">{item.quantity} {item.unit}</p>
                      <span className="text-[10px] text-gray-400">Needs replenishment</span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
