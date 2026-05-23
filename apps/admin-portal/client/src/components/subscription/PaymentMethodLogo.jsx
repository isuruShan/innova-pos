import { Building2 } from 'lucide-react';

const DEFAULT_IMAGES = {
  stripe: '/payment-icons/stripe.png',
  paypal: '/payment-icons/paypal.png',
};

export default function PaymentMethodLogo({ method, imageUrl, className = '', size = 'md' }) {
  const key = method === 'bank' ? 'bank_transfer' : method;
  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-10';

  // Bank transfer: render inline icon — no image file available
  if (key === 'bank_transfer' && !imageUrl) {
    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;
    const pad = size === 'sm' ? 'p-1.5' : size === 'lg' ? 'p-2.5' : 'p-2';
    return (
      <div className={`${h} aspect-square bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center ${pad} shrink-0 ${className}`}>
        <Building2 size={iconSize} className="text-slate-500" />
      </div>
    );
  }

  const src = imageUrl || DEFAULT_IMAGES[key];
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className={`${h} w-auto object-contain ${className}`}
      onError={(e) => {
        if (e.target.dataset.fallback) return;
        e.target.dataset.fallback = '1';
        e.target.style.display = 'none';
      }}
    />
  );
}
