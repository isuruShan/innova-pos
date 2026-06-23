import { useTheme } from '../context/ThemeContext';

const darkVariants = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  preparing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ready: 'bg-green-500/20 text-green-400 border-green-500/30',
  delivered: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  ok: 'bg-green-500/20 text-green-400 border-green-500/30',
  low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const lightVariants = {
  pending: 'bg-amber-50 text-amber-800 border-amber-300',
  preparing: 'bg-blue-50 text-blue-800 border-blue-300',
  ready: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  delivered: 'bg-purple-50 text-purple-800 border-purple-300',
  completed: 'bg-slate-100 text-slate-800 border-slate-350',
  cancelled: 'bg-red-50 text-red-800 border-red-300',
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  low: 'bg-amber-50 text-amber-800 border-amber-300',
  critical: 'bg-red-50 text-red-800 border-red-300',
};

export default function Badge({ label, variant }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const variants = isLight ? lightVariants : darkVariants;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${variants[variant] || variants.ok}`}>
      {label}
    </span>
  );
}

