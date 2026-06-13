import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { initializePushNotifications } from '../services/pushService';
import { isConfigured } from '../services/firebase';

const DISMISSED_KEY = 'pos_push_banner_dismissed';

/**
 * Dismissible banner prompting users to enable push notifications.
 * Only renders when:
 *  - Firebase is configured (VITE_FIREBASE_* env vars present)
 *  - Browser supports Notification API
 *  - Permission state is 'default' (not yet decided)
 *  - User hasn't dismissed the banner this session
 */
export default function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    const shouldShow =
      isConfigured &&
      'Notification' in window &&
      Notification.permission === 'default' &&
      !dismissed;
    setVisible(shouldShow);
  }, []);

  if (!visible || enabled) return null;

  const handleEnable = async () => {
    setLoading(true);
    try {
      const token = await initializePushNotifications();
      if (token) {
        setEnabled(true);
        setVisible(false);
      } else if (Notification.permission === 'denied') {
        // User blocked — hide banner permanently for session
        sessionStorage.setItem(DISMISSED_KEY, '1');
        setVisible(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="push-permission-banner">
      <div className="push-permission-banner__inner">
        <div className="push-permission-banner__icon">
          <Bell size={18} />
        </div>
        <div className="push-permission-banner__content">
          <span className="push-permission-banner__title">Stay in the loop</span>
          <span className="push-permission-banner__body">
            Enable notifications to get instant alerts for new orders, approvals, and waiter calls.
          </span>
        </div>
        <div className="push-permission-banner__actions">
          <button
            className="push-permission-banner__btn push-permission-banner__btn--dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss notification prompt"
          >
            <BellOff size={14} />
            Not now
          </button>
          <button
            className="push-permission-banner__btn push-permission-banner__btn--enable"
            onClick={handleEnable}
            disabled={loading}
            aria-label="Enable push notifications"
          >
            {loading ? 'Enabling…' : 'Enable notifications'}
          </button>
        </div>
        <button
          className="push-permission-banner__close"
          onClick={handleDismiss}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
