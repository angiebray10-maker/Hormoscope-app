import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isPushSupported, subscribeToPush, getNotificationPermission } from '../utils/pushNotifications';

export default function PushNotificationPrompt() {
  const { user, token } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show if:
    // 1. User is logged in and has completed onboarding
    // 2. Push is supported
    // 3. User has notifications enabled in settings
    // 4. Permission hasn't been granted yet
    // 5. Haven't dismissed this prompt before
    
    if (!user?.onboarding_complete) return;
    if (!isPushSupported()) return;
    if (user?.notifications_enabled === false) return;
    
    const dismissed = localStorage.getItem('pushPromptDismissed');
    if (dismissed) return;
    
    const permission = getNotificationPermission();
    if (permission === 'granted') return; // Already subscribed
    if (permission === 'denied') return; // User blocked notifications
    
    // Show prompt after a short delay
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const subscription = await subscribeToPush(token);
      if (subscription) {
        setShow(false);
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pushPromptDismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom">
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#2d1f3d] rounded-2xl p-4 border border-[#ff8fab]/30 shadow-2xl max-w-sm mx-auto">
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/40 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ff8fab]/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-[#ff8fab]" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-medium text-sm">Enable Daily Check-ins?</h3>
            <p className="text-white/60 text-xs mt-1">
              Get personalized updates about your cycle and how you're feeling.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="px-4 py-1.5 bg-[#ff8fab] text-white text-xs font-medium rounded-full hover:bg-[#ff8fab]/80 transition-all disabled:opacity-50"
              >
                {loading ? 'Enabling...' : 'Enable'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 text-white/50 text-xs hover:text-white transition-all"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
