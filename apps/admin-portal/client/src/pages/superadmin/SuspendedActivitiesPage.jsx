import { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, Clock, Ban } from 'lucide-react';
import api from '../../api/axios';

export default function SuspendedActivitiesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const res = await api.get('/tenants/suspended-activities');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load suspended activities', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="text-red-500 shrink-0" size={26} />
            Suspended Merchant Activities
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor activity and active POS sessions in merchant stores after their subscription or trial has ended.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
            <Ban size={22} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No suspended merchants</h3>
          <p className="text-sm text-gray-500">
            There are currently no merchants who have gone out of their subscription or trial plans.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Merchant</th>
                  <th className="px-6 py-4">Status / Reason</th>
                  <th className="px-6 py-4">Deactivation Date</th>
                  <th className="px-6 py-4">Current Plan</th>
                  <th className="px-6 py-4">Post-Expiry Orders</th>
                  <th className="px-6 py-4">Post-Expiry Sessions</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
                {data.map((item) => {
                  const hasActivity = item.activity.hasActivity;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{item.businessName}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{item.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border capitalize ${
                          item.status === 'suspended'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {item.status} ({item.suspensionReason || 'expired'})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono">
                        {item.deactivationDate ? new Date(item.deactivationDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {item.assignedPlan}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${item.activity.ordersCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.activity.ordersCount}
                          </span>
                          {item.activity.ordersCount > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock size={12} />
                              last: {new Date(item.activity.lastOrderDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${item.activity.sessionsCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.activity.sessionsCount}
                          </span>
                          {item.activity.sessionsCount > 0 && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock size={12} />
                              last: {new Date(item.activity.lastSessionDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {hasActivity ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                            Active Post-Suspension
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                            Inactive (Correct)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
