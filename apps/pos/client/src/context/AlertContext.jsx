import { createContext, useContext, useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    title: 'Notification',
    type: 'info', // 'info' | 'success' | 'error'
  });

  const showAlert = (message, title = 'Notification', type = 'info') => {
    setAlertState({
      isOpen: true,
      message,
      title,
      type,
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && alertState.isOpen) {
        closeAlert();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alertState.isOpen]);

  const { isOpen, message, title, type } = alertState;

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
          {/* Backdrop click to close */}
          <div className="absolute inset-0 -z-10" onClick={closeAlert} />

          {/* Alert dialog container */}
          <div className="w-full sm:max-w-md bg-[var(--pos-panel)] border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] transition-all duration-300 transform translate-y-0 sm:translate-y-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 bg-slate-800/20">
              <div className="flex items-center gap-2.5">
                {type === 'error' && <AlertCircle className="text-red-400" size={18} />}
                {type === 'success' && <CheckCircle className="text-green-400" size={18} />}
                {type === 'info' && <Info className="text-sky-400" size={18} />}
                <h3 className="text-sm font-bold text-[var(--pos-text-primary)]">{title}</h3>
              </div>
              <button
                type="button"
                onClick={closeAlert}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-800/10 flex justify-end">
              <button
                type="button"
                onClick={closeAlert}
                className="w-full sm:w-auto px-5 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
