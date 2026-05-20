import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import api from '../../api/axios';

export default function LoyaltyAddonSubscribeBanner({ className = '' }) {
  const { data: catalog = [], isPending } = useQuery({
    queryKey: ['merchant-addon-catalog'],
    queryFn: () => api.get('/paid-addons/merchant-catalog').then((r) => r.data),
    staleTime: 60_000,
  });

  const loyalty = catalog.find((a) => a.code === 'loyalty');
  if (isPending || loyalty?.alreadyActive) return null;

  return (
    <div
      className={`rounded-xl border border-[#e94560]/30 bg-gradient-to-r from-[#16213e] to-[#16213e]/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#e94560]/20 flex items-center justify-center shrink-0">
          <Award className="text-[#e94560]" size={22} />
        </div>
        <div>
          <p className="font-semibold text-white">Activate the Loyalty program add-on</p>
          <p className="text-sm text-slate-300 mt-1">
            {loyalty?.shortDescription ||
              'Earn points on orders, tier customers, and offer rewards at checkout — subscribe to unlock loyalty tools.'}
          </p>
          {loyalty?.priced?.amount > 0 ? (
            <p className="text-xs text-slate-400 mt-2">
              From {loyalty.priced.amount.toLocaleString()} {loyalty.priced.currency} {loyalty.billingLabel || ''}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        to="/addons?code=loyalty"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#e94560] text-white text-sm font-semibold hover:opacity-90 shrink-0"
      >
        View & subscribe
      </Link>
    </div>
  );
}
