import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Clock } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useCashierDraftOrders } from '../../context/CashierDraftOrdersContext';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';

const STATUS_STYLES = {
  available: { bg: 'bg-green-50 text-green-700 border-green-200', text: 'Available' },
  occupied: { bg: 'bg-red-50 text-red-700 border-red-200', text: 'Occupied' },
  reserved: { bg: 'bg-yellow-50 text-yellow-700 border-yellow-200', text: 'Reserved' },
};

export default function StewardTables() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const { data: paidAddons } = useTenantPaidAddons();
  const tableMgmt = paidAddons?.tableManagement === true;
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addDraftWithTable } = useCashierDraftOrders(selectedStoreId);

  const [filterMode, setFilterMode] = useState('my-tables'); // 'my-tables' or 'all'

  // Fetch tables
  const { data: tables = [], isLoading: loadingTables } = useQuery({
    queryKey: ['pos-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
  });

  // Fetch real-time statuses (polls every 10s)
  const { data: tableStatus = {}, isLoading: loadingStatus } = useQuery({
    queryKey: ['floor-plan-status', selectedStoreId],
    queryFn: () => api.get('/floor-plan/status').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
    refetchInterval: 10000,
  });

  const activeTablesList = useMemo(() => {
    return tables.filter((t) => t.active !== false);
  }, [tables]);

  const displayedTables = useMemo(() => {
    if (filterMode === 'my-tables') {
      return activeTablesList.filter(t => String(t.assignedSteward) === String(user._id));
    }
    return activeTablesList;
  }, [activeTablesList, filterMode, user._id]);

  const handleTableClick = (table) => {
    const id = String(table._id);
    const statusObj = tableStatus[id];
    
    if (statusObj && statusObj.status === 'occupied') {
      // Table already has an order, append to it
      navigate('/steward/orders', { state: { editOrderId: statusObj.orderId } });
    } else {
      // Start a new draft
      addDraftWithTable(id, table.label);
      navigate('/steward/orders');
    }
  };

  if (!isStoreReady || loadingTables || loadingStatus) {
    return (
      <div className="p-4 flex justify-center items-center h-full text-gray-400">
        Loading tables...
      </div>
    );
  }

  if (!tableMgmt) {
    return (
      <div className="p-4 text-center mt-10">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Add-on Required</h2>
        <p className="text-gray-500">Table Management must be enabled to use Steward features.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        {/* Toggle my tables / all tables */}
        <div className="bg-gray-100 rounded-xl p-1 flex">
          <button
            onClick={() => setFilterMode('my-tables')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${
              filterMode === 'my-tables' ? 'bg-white shadow text-amber-600' : 'text-gray-500'
            }`}
          >
            My Tables
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${
              filterMode === 'all' ? 'bg-white shadow text-amber-600' : 'text-gray-500'
            }`}
          >
            All Tables
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {displayedTables.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {filterMode === 'my-tables' ? 'No tables assigned to you.' : 'No tables configured.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-safe">
            {displayedTables.map((table) => {
              const id = String(table._id);
              const occupancy = tableStatus[id];
              const status = occupancy?.status || 'available';
              const style = STATUS_STYLES[status] || STATUS_STYLES.available;

              return (
                <button
                  key={id}
                  onClick={() => handleTableClick(table)}
                  className={`flex flex-col text-left p-3 rounded-xl border-2 transition-transform active:scale-95 ${style.bg} ${style.border}`}
                >
                  <div className="flex justify-between items-start w-full mb-2">
                    <span className="text-lg font-bold">{table.label}</span>
                  </div>
                  
                  <span className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-80">
                    {style.text}
                  </span>

                  <div className="mt-auto flex flex-col gap-1 text-xs opacity-70">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users size={12} />
                      {occupancy?.guestsCount != null 
                        ? `${occupancy.guestsCount}/${table.capacity}`
                        : `Max ${table.capacity}`
                      }
                    </span>
                    {status === 'occupied' && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {occupancy.seatedMinutes}m ago
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
