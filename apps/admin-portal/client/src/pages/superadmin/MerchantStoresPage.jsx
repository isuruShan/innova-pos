import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import StoresPage from '../admin/StoresPage';

export default function MerchantStoresPage() {
  const { id } = useParams();

  const { data: tenant } = useQuery({
    queryKey: ['tenant-workspace', id],
    queryFn: async () => { const { data } = await api.get(`/tenants/${id}`); return data; },
  });

  return (
    <div className="space-y-4">
      <Link to={`/merchants/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Back to merchant
      </Link>
      <StoresPage
        tenantIdOverride={id}
        workspaceMode
        workspaceTitle={tenant?.businessName}
      />
    </div>
  );
}
