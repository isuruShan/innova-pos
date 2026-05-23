export const ORDER_TYPES = [
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

export const ORDER_TYPE_MAP = Object.fromEntries(ORDER_TYPES.map(t => [t.id, t]));

export default function OrderTypeBadge({ orderType, tableNumber, reference, size = 'sm' }) {
  const type = ORDER_TYPE_MAP[orderType] || ORDER_TYPE_MAP['dine-in'];
  const tooltipText = orderType === 'dine-in' && tableNumber
    ? `Table ${tableNumber}`
    : reference || type.label;

  if (size === 'xs') {
    return (
      <span 
        className={`inline-flex items-center justify-center w-6 h-6 text-sm rounded-full border ${type.bg} ${type.color} ${type.border}`}
        title={tooltipText}
      >
        <span>{type.icon}</span>
      </span>
    );
  }

  return (
    <span 
      className={`inline-flex items-center justify-center w-8 h-8 text-lg rounded-full border ${type.bg} ${type.color} ${type.border}`}
      title={tooltipText}
    >
      <span>{type.icon}</span>
    </span>
  );
}
