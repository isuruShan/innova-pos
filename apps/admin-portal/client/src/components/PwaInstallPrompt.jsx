import { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [platform, setPlatform] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(window.deferredPrompt);

  const handleDismiss = () => {
    localStorage.setItem('cafinity-admin-pwa-dismissed', 'true');
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
    const isDismissed = localStorage.getItem('cafinity-admin-pwa-dismissed');
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
      alert('To install Cafinity Admin, tap the three dots in your browser menu and select "Install app" or "Add to Home Screen".');
    }
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Floating Install Banner */}
      <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="relative overflow-hidden bg-brand-brown-deep/90 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
          
          {/* Subtle brand orange border glow */}
          <div className="absolute inset-0 border border-brand-orange/20 pointer-events-none rounded-2xl" />
          
          {/* App Info */}
          <div className="flex items-center gap-3">
            <img 
              src="/logo-2.png" 
              alt="Cafinity Admin logo" 
              className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10" 
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate">Cafinity Admin</h4>
              <p className="text-xs text-gray-400 mt-0.5 font-light">Install the portal for managing merchants & approvals.</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-brand-orange/20 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Download size={13} />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm bg-brand-brown-deep border border-white/10 rounded-2xl p-6 shadow-2xl text-left animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <img 
                  src="/logo-2.png" 
                  alt="Cafinity Admin logo" 
                  className="w-10 h-10 rounded-xl object-cover shadow-lg border border-white/10" 
                />
                <div>
                  <h3 className="text-base font-bold text-white">Install Cafinity Admin</h3>
                  <p className="text-xs text-gray-400 font-light">Add to your iPhone Home Screen</p>
                </div>
              </div>
              <button 
                onClick={() => setShowIosModal(false)}
                className="text-gray-400 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-4 text-sm text-gray-300 font-light">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-brand-orange shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="leading-relaxed">
                    Tap the <span className="font-semibold text-white">Share</span> button at the bottom of your Safari browser.
                  </p>
                  <div className="mt-2 flex items-center justify-center p-2 rounded-xl bg-black/30 border border-white/5 max-w-[120px]">
                    <Share size={18} className="text-sky-400" />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-brand-orange shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="leading-relaxed">
                    Scroll down and select <span className="font-semibold text-white">Add to Home Screen</span>.
                  </p>
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/5 max-w-[200px]">
                    <Plus size={16} className="text-gray-400 border border-dashed border-white/20 rounded p-0.5" />
                    <span className="text-xs font-medium text-gray-300">Add to Home Screen</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-brand-orange shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="leading-relaxed">
                    Tap <span className="font-semibold text-white">Add</span> in the top right corner to complete the installation.
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowIosModal(false)}
              className="mt-6 w-full py-3 bg-white/10 hover:bg-white/15 text-gray-200 hover:text-white font-semibold rounded-xl text-sm transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
