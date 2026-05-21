import { X, LayoutDashboard, Monitor } from 'lucide-react';
import { getAdminUrl, getPosUrl } from '@innovapos/app-urls';

const portals = [
  {
    id: 'admin',
    title: 'Admin portal',
    description: 'Manage subscription, stores, menu, staff, and merchant settings.',
    href: `${getAdminUrl()}/login`,
    logo: '/signin-admin.png',
    icon: LayoutDashboard,
    accent: 'from-amber-500/15 to-orange-600/10 border-amber-300/60 hover:border-amber-400',
  },
  {
    id: 'pos',
    title: 'POS',
    description: 'Take orders, run the kitchen display, and work your café floor.',
    href: `${getPosUrl()}/login`,
    logo: '/signin-pos.png',
    icon: Monitor,
    accent: 'from-teal-500/15 to-cyan-600/10 border-teal-300/60 hover:border-teal-400',
  },
];

export default function SignInPortalModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] min-h-[100dvh] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-portal-title"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h2 id="signin-portal-title" className="text-xl font-bold text-gray-900">
              Sign in
            </h2>
            <p className="text-sm text-gray-500 mt-1">Choose where you want to sign in.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {portals.map((p) => {
            const Icon = p.icon;
            return (
              <a
                key={p.id}
                href={p.href}
                className={`group flex flex-col rounded-xl border-2 bg-gradient-to-br p-5 transition-all shadow-sm hover:shadow-md ${p.accent}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-1">
                    <img src={p.logo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <Icon size={18} className="text-gray-400 shrink-0 sm:hidden" aria-hidden />
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{p.title}</h3>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed flex-1">{p.description}</p>
                <span className="mt-4 text-sm font-semibold text-brand-orange group-hover:underline">
                  Open {p.title} →
                </span>
              </a>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">
          New merchant?{' '}
          <a href="/signup" className="text-brand-orange font-medium hover:underline" onClick={onClose}>
            Start your free trial
          </a>
        </p>
      </div>
    </div>
  );
}
