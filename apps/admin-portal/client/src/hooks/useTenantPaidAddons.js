import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

export function useTenantPaidAddons({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['tenant-paid-addons'],
    queryFn: () => api.get('/tenant/paid-addons').then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });
}
