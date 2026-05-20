import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

/** Billing region from tenant.countryIso (LK = local LKR + all payment methods; else international USD + PayPal only). */
export function useMerchantBillingRegion() {
  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: async () => {
      const { data: sub } = await api.get('/subscriptions/my');
      return sub;
    },
    staleTime: 60_000,
  });

  return useMemo(() => {
    const countryIso = String(data?.tenant?.countryIso || 'LK').toUpperCase();
    const isLocal = countryIso === 'LK';
    return {
      countryIso,
      isLocal,
      isInternational: !isLocal,
      billingNote: isLocal
        ? null
        : 'Your account is billed in USD. PayPal is the available payment method for your region.',
    };
  }, [data?.tenant?.countryIso]);
}
