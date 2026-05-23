import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export function useGbpStatus() {
  return useQuery({
    queryKey: ['google-business-status'],
    queryFn: async () => {
      const { data } = await api.get('/google-business/status');
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useCreateGbpProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/google-business/create-profile');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-business-status'] });
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
  });
}

export function useSyncGbpProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/google-business/sync');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-business-status'] });
    },
  });
}

export function useDisconnectGbp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete('/google-business/disconnect');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-business-status'] });
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
  });
}
