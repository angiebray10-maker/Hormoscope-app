import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) return;

    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (isIOSDevice && !isInstalled) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4 pb-24" onClick={handleDismiss}>
      <div className="w-full max-w-sm rounded-2xl p-4 relative" style={{ background: 'rgba(20,20,40,0.95)', border: '1px solid rgba(244,167,185,0.2)', backdropFilter: 'blur(20px)' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors"
          data-testid="install-dismiss-btn"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        <div className="flex items-center gap-4 pr-8">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
            <img src="/logo192.png" alt="HORMOscope" className="w-12 h-12 object-cover" />
          </div>

          <div className="flex-1">
            <h3 className="text-white text-base" style={{ fontFamily: "'Poiret One', cursive" }}>
              Add HORMOscope to Home Screen
            </h3>
            <p className="text-[#9A8B91] text-xs mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
              {isIOS
                ? 'Tap the Share button, then "Add to Home Screen"'
                : 'Quick access from your home screen'}
            </p>
          </div>
        </div>

        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2.5 rounded-full text-white text-sm font-medium"
            style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)', fontFamily: 'Poppins, sans-serif' }}
            data-testid="install-btn"
          >
            Install
          </button>
        )}

        {isIOS && (
          <button
            onClick={handleDismiss}
            className="w-full mt-3 py-2.5 rounded-full text-white text-sm font-medium"
            style={{ background: 'rgba(123,79,166,0.3)', border: '1px solid rgba(201,184,240,0.3)', fontFamily: 'Poppins, sans-serif' }}
            data-testid="install-got-it-btn"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
