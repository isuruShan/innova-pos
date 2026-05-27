import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useExpiryWarning } from '../hooks/useSubscriptionGuard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export default function ExpiryWarningBanner() {
  const warningInfo = useExpiryWarning();
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const dismissMutation = useMutation({
    mutationFn: () => api.post('/api/subscription/dismiss-expiry-warning'),
    onSuccess: () => {
      setDismissed(true);
      // Refetch user/tenant data to update dismissal status
      queryClient.invalidateQueries({ queryKey: ['user'] });
    }
  });

  // Don't show if no warning, or if manually dismissed
  if (!warningInfo || dismissed) {
    return null;
  }

  const { daysLeft, expiryDate } = warningInfo;
  const formattedDate = new Date(expiryDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="bg-gradient-to-r from-yellow-600 to-orange-600 border-b border-orange-700">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {daysLeft === 1 
                  ? 'Your subscription expires tomorrow!' 
                  : `Your subscription expires in ${daysLeft} days`
                }
              </p>
              <p className="text-xs text-yellow-50">
                Expiry date: {formattedDate}. Please contact your administrator to renew.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => dismissMutation.mutate()}
              disabled={dismissMutation.isPending}
              className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Dismiss warning"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
