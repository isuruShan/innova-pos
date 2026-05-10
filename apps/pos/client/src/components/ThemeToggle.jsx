import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/** Sun/Moon control — uses tenant branding text color when placed on the nav bar. */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl border border-white/10 bg-black/20 hover:bg-black/35 transition shrink-0 ${className}`}
      style={{ color: 'var(--color-text, var(--pos-text-primary))' }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}
