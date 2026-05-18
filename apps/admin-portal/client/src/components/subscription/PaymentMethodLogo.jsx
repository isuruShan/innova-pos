const DEFAULT_IMAGES = {
  stripe: '/payment-icons/stripe.png',
  paypal: '/payment-icons/paypal.png',
  bank_transfer: '/payment-icons/bank.png',
};

export default function PaymentMethodLogo({ method, imageUrl, className = '', size = 'md' }) {
  const key = method === 'bank' ? 'bank_transfer' : method;
  const src = imageUrl || DEFAULT_IMAGES[key] || DEFAULT_IMAGES.bank_transfer;
  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-10';

  return (
    <img
      src={src}
      alt=""
      className={`${h} w-auto object-contain ${className}`}
      onError={(e) => {
        if (e.target.dataset.fallback) return;
        e.target.dataset.fallback = '1';
        e.target.src = DEFAULT_IMAGES[key] || DEFAULT_IMAGES.bank_transfer;
      }}
    />
  );
}
