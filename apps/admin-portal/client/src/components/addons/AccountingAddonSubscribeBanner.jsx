import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import api from '../../api/axios';

export default function AccountingAddonSubscribeBanner({ className = '' }) {
  const { data: catalog = [], isPending } = useQuery({
    queryKey: ['merchant-addon-catalog'],
    queryFn: () => api.get('/paid-addons/merchant-catalog').then((r) => r.data),
    staleTime: 60_000,
  });

  const accounting = catalog.find((a) => a.code === 'accounting');
  if (isPending || accounting?.alreadyActive) return null;

  return (
    <div
      className={`rounded-xl border border-indigo-500/30 bg-gradient-to-r from-[#1e1b4b] to-[#312e81]/80 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
          <Wallet className="text-indigo-400" size={22} />
        </div>
        <div>
          <p className="font-semibold text-white">Activate the Advanced Accounting Module</p>
          <p className="text-sm text-slate-300 mt-1">
            {accounting?.shortDescription ||
              'Double-entry bookkeeping, payroll management, creditors, debtors, and automated tax statements.'}
          </p>
          {accounting?.priced?.amount > 0 ? (
            <p className="text-xs text-slate-400 mt-2">
              From {accounting.priced.amount.toLocaleString()} {accounting.priced.currency} {accounting.billingLabel || ''}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        to="/addons?code=accounting"
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors shrink-0"
      >
        View & subscribe
      </Link>
    </div>
  );
}
