import { Award, ExternalLink } from 'lucide-react';
import { adminPath } from '@innovapos/app-urls';
import { useTenantPaidAddons } from '../hooks/useTenantPaidAddons';

const subscribeUrl = adminPath('/addons?code=loyalty');

export default function LoyaltyAddonBanner({ className = '' }) {
  const { data, isPending } = useTenantPaidAddons();

  if (isPending || data?.loyalty) return null;

  return (
    <div
      className={`rounded-xl border border-[#e94560]/40 bg-[#16213e]/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${className}`}
    >
      <div className="flex gap-3">
        <Award className="text-[#e94560] shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-semibold text-[var(--pos-text-primary)]">Loyalty program is a paid add-on</p>
          <p className="text-xs text-slate-400 mt-1">
            Points, tiers, and rewards are available after you subscribe in the admin portal. Until then, checkout and
            customer tools stay in basic mode.
          </p>
        </div>
      </div>
      <a
        href={subscribeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg bg-[#e94560] text-white hover:opacity-90 shrink-0"
      >
        Subscribe in admin
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
