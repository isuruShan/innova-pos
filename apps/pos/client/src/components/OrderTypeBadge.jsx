// Base order types (always available)
export const BASE_ORDER_TYPES = [
  {
    id: 'dine-in',
    label: 'Dine-In',
    icon: '🪑',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    activeBg: 'bg-blue-500',
    placeholder: 'Table number',
    hint: 'Enter table number',
  },
  {
    id: 'takeaway',
    label: 'Take Away',
    icon: '🥡',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    activeBg: 'bg-green-500',
    placeholder: 'Customer name (optional)',
    hint: 'Customer name or ref',
  },
];

// Legacy hardcoded partner types (for fallback)
const LEGACY_PARTNER_TYPES = [
  {
    id: 'uber-eats',
    label: 'Uber Eats',
    icon: '🛵',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    activeBg: 'bg-emerald-600',
    placeholder: 'Uber order #',
    hint: 'Uber Eats order number',
  },
  {
    id: 'pickme',
    label: 'PickMe',
    icon: '🏍️',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    activeBg: 'bg-orange-500',
    placeholder: 'PickMe order #',
    hint: 'PickMe Food order number',
  },
];

// Export full hardcoded list for backwards compatibility
export const ORDER_TYPES = [...BASE_ORDER_TYPES, ...LEGACY_PARTNER_TYPES];

/**
 * Generate dynamic ORDER_TYPES from foodmarket partners
 * @param {Array} partners - Active foodmarket partners with logo, icon, and color
 * @returns {Array} Combined order types (base + dynamic partners)
 */
export function buildOrderTypes(partners = []) {
  const dynamicPartners = partners
    .filter(p => p.isActive)
    .map(p => ({
      id: p.name.toLowerCase().replace(/\s+/g, '-'),
      label: p.name,
      icon: p.icon || '🛵',
      logoUrl: p.logoUrl,
      color: p.color || '#10b981',
      bg: `bg-[${p.color || '#10b981'}]/10`,
      border: `border-[${p.color || '#10b981'}]/30`,
      activeBg: `bg-[${p.color || '#10b981'}]`,
      placeholder: `${p.name} order #`,
      hint: `${p.name} order number`,
      partnerId: p._id,
    }));
  
  return [...BASE_ORDER_TYPES, ...dynamicPartners];
}

export const ORDER_TYPE_MAP = Object.fromEntries(ORDER_TYPES.map(t => [t.id, t]));

export default function OrderTypeBadge({ orderType, tableNumber, reference, logoUrl, icon, color, size = 'sm' }) {
  let type = ORDER_TYPE_MAP[orderType];
  if (!type) {
    const label = orderType
      ? orderType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'Dine-In';
    type = {
      id: orderType,
      label,
      icon: icon || '🛵',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      color: color || '#10b981',
      placeholder: 'Order #',
    };
  }
  
  const tooltipText = orderType === 'dine-in' && tableNumber
    ? `Table ${tableNumber}`
    : reference || type.label;

  // Use prop values if provided (for dynamic partners), else fall back to type config
  const displayLogoUrl = logoUrl || type.logoUrl;
  const displayIcon = icon || type.icon;
  const displayColor = color || type.color;

  const sizeClasses = size === 'xs' 
    ? 'w-6 h-6 text-sm' 
    : 'w-8 h-8 text-lg';

  return (
    <span 
      className={`inline-flex items-center justify-center ${sizeClasses} rounded-full border ${type.bg} ${type.border}`}
      style={{ 
        color: displayColor,
        borderColor: displayColor + '40',
        backgroundColor: displayColor + '10',
      }}
      title={tooltipText}
    >
      {displayLogoUrl ? (
        <img src={displayLogoUrl} alt={type.label} className="w-full h-full object-contain rounded-full p-0.5" />
      ) : (
        <span>{displayIcon}</span>
      )}
    </span>
  );
}
