import { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [platform, setPlatform] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(window.deferredPrompt);

  const handleDismiss = () => {
    localStorage.setItem('cafinity-pos-pwa-dismissed', 'true');
    setShowPrompt(false);
    setShowIosModal(false);
  };

  useEffect(() => {
    // 1. Check if already running in standalone/installed mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return undefined;
    }

    // 2. Check if user dismissed the prompt in this session
    const isDismissed = localStorage.getItem('cafinity-pos-pwa-dismissed');
    if (isDismissed === 'true') {
      return undefined;
    }

    // 3. Detect mobile platform
    const userAgent = window.navigator.userAgent || window.navigator.vendor || window.opera;
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

    let iosTimer = null;
    let cleanupAndroidListeners = null;

    // Use setTimeout to avoid synchronous setState calls inside useEffect body
    const initTimer = setTimeout(() => {
      if (isIOS) {
        setPlatform('ios');
        iosTimer = setTimeout(() => setShowPrompt(true), 2500);
      } else if (isAndroid || window.deferredPrompt) {
        setPlatform('android');
        
        const handleBeforePrompt = () => {
          setInstallPrompt(window.deferredPrompt);
          setShowPrompt(true);
        };

        window.addEventListener('pwa-beforeinstallprompt', handleBeforePrompt);
        window.addEventListener('pwa-installed', handleDismiss);

        cleanupAndroidListeners = () => {
          window.removeEventListener('pwa-beforeinstallprompt', handleBeforePrompt);
          window.removeEventListener('pwa-installed', handleDismiss);
        };

        if (window.deferredPrompt) {
          setShowPrompt(true);
        }
      }
    }, 0);

    return () => {
      clearTimeout(initTimer);
      if (iosTimer) clearTimeout(iosTimer);
      if (cleanupAndroidListeners) cleanupAndroidListeners();
    };
  }, []);

  const handleInstallClick = async () => {
    if (platform === 'ios') {
      setShowIosModal(true);
    } else if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log(`PWA install user choice: ${outcome}`);
      if (outcome === 'accepted') {
        handleDismiss();
      }
    } else {
      // Fallback for Android when prompt event is delayed/not fired yet
      alert('To install Cafinity POS, tap the three dots in your browser menu and select "Install app" or "Add to Home Screen".');
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Floating Install Banner */}
      <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="relative overflow-hidden bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
          
          {/* Subtle amber gradient border glow */}
          <div className="absolute inset-0 border border-amber-500/10 pointer-events-none rounded-2xl" />
          
          {/* App Info */}
          <div className="flex items-center gap-3">
            <img 
              src="/logo-1.png" 
              alt="Cafinity POS logo" 
              className="w-12 h-12 rounded-xl object-cover shadow-lg border border-slate-800" 
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-100 truncate">Cafinity POS</h4>
              <p className="text-xs text-slate-400 mt-0.5 font-light">Install app for a native, offline-capable experience.</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download size={13} />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/50 rounded-lg transition"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-left animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo-1.png" 
                  alt="Cafinity POS logo" 
                  className="w-10 h-10 rounded-xl object-cover shadow-lg border border-slate-800" 
                />
                <div>
                  <h3 className="text-base font-bold text-slate-100">Install Cafinity POS</h3>
                  <p className="text-xs text-slate-400">Add to your iPhone Home Screen</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-800/50 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-4 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-semibold text-amber-400 shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="leading-relaxed">
                    Tap the <span className="font-semibold text-slate-100">Share</span> button at the bottom of your Safari browser.
                  </p>
                  <div className="mt-2 flex items-center justify-center p-2 rounded-xl bg-slate-950 border border-slate-800 max-w-[120px]">
                    <Share size={18} className="text-sky-400" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-semibold text-amber-400 shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="leading-relaxed">
                    Scroll down and select <span className="font-semibold text-slate-100">Add to Home Screen</span>.
                  </p>
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 max-w-[200px]">
                    <Plus size={16} className="text-slate-400 border border-dashed border-slate-600 rounded p-0.5" />
                    <span className="text-xs font-medium text-slate-300">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-xs font-semibold text-amber-400 shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="leading-relaxed">
                    Tap <span className="font-semibold text-slate-100">Add</span> in the top right corner to complete the installation.
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl text-sm transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
