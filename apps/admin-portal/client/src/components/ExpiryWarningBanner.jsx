import { useState } from 'react';
import { X, AlertTriangle, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExpiryWarning } from '../hooks/useSubscriptionGuard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export default function ExpiryWarningBanner() {
  const warningInfo = useExpiryWarning();
  const navigate = useNavigate();
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
                Expiry date: {formattedDate}. Renew now to avoid service interruption.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/subscription')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-orange-700 text-sm font-semibold rounded-lg hover:bg-yellow-50 transition-colors"
            >
              <CreditCard size={14} />
              Renew Now
            </button>
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
