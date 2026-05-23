import { useEffect, useState } from 'react';
import { useGbpStatus, useCreateGbpProfile, useSyncGbpProfile, useDisconnectGbp } from '../../hooks/useGoogleBusiness';
import { useToast } from '../../context/ToastContext';
import api from '../../api/axios';
import { 
  Globe, 
  MapPin, 
  Phone, 
  Info, 
  CheckCircle, 
  Loader, 
  LogOut, 
  RefreshCw, 
  ExternalLink,
  AlertTriangle,
  Building
} from 'lucide-react';

export default function GoogleBusinessCard({ businessDetails }) {
  const toast = useToast();
  const { data: gbp, isLoading, error, refetch } = useGbpStatus();
  const createProfileMutation = useCreateGbpProfile();
  const syncMutation = useSyncGbpProfile();
  const disconnectMutation = useDisconnectGbp();
  const [connecting, setConnecting] = useState(false);

  // Check URL params for connection success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      toast.success('Google Account connected successfully!');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      refetch();
    }
  }, [toast, refetch]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get('/google-business/oauth/start');
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to get authorization URL');
        setConnecting(false);
      }
    } catch (err) {
      toast.error('Connection initiation failed');
      setConnecting(false);
    }
  };

  const handleCreateProfile = async () => {
    try {
      await createProfileMutation.mutateAsync();
      toast.success('Google Business Profile location created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create profile');
    }
  };

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.success('Business details successfully synced to Google!');
    } catch (err) {
      toast.error('Sync failed');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Google Business Profile?')) return;
    try {
      await disconnectMutation.mutateAsync();
      toast.success('Google connection removed');
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  if (isLoading || connecting) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center min-h-[200px]">
        <Loader className="animate-spin text-brand-orange mb-3" size={28} />
        <p className="text-sm text-gray-500 font-medium">Checking Google Business Profile status...</p>
      </div>
    );
  }

  if (error || gbp?.status === 'error') {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 space-y-4">
        <div className="flex items-start gap-3 text-red-600">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">Google Connection Error</h3>
            <p className="text-sm text-gray-500 mt-1">
              {error?.message || 'An error occurred while connecting or communicating with the Google Business Profile API.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Reconnect Google Account
          </button>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  const status = gbp?.status || 'disconnected';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <Building size={18} />
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">Google Business Profile</h3>
            <p className="text-sm text-gray-500 mt-0.5">Link your restaurant to Google Search and Google Maps.</p>
          </div>
        </div>
        
        {status === 'pending_verification' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            Pending Verification
          </span>
        )}
        {status === 'verified' && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            Live on Google
          </span>
        )}
      </div>

      <div className="p-6 space-y-6">
        {status === 'disconnected' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Connect your POS to Google Business Profile to create or connect your storefront. Once connected, your business details (name, address, phone, website, and description) will sync directly to Google Maps and Search.
            </p>
            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm"
            >
              <Globe size={16} />
              Connect with Google
            </button>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <Info className="text-blue-600 shrink-0 mt-0.5" size={16} />
              <div className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">Google Account Connected!</span> You can now create your public Google Business Profile listing. Review the details below that will be sent to Google.
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Profile pre-fill data</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span>Business Name: <strong className="text-gray-900">{businessDetails.businessName || 'Not Set'}</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span>Address: <span className="text-gray-900">{businessDetails.address || 'Not Set'}</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span>Phone: <span className="text-gray-900">{businessDetails.phone || 'Not Set'}</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className={`${businessDetails.website ? 'text-emerald-500' : 'text-gray-300'}`} />
                  <span>Website: <span className="text-gray-900">{businessDetails.website || 'Optional'}</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className={`${businessDetails.description ? 'text-emerald-500' : 'text-gray-300'}`} />
                  <span>Description: <span className="text-gray-900 line-clamp-1">{businessDetails.description || 'Optional'}</span></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <span>Category: <strong className="text-gray-900">{(businessDetails.category || '').replace('categories/gcid:', '').replace('_', ' ')}</strong></span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleCreateProfile}
                disabled={createProfileMutation.isPending || !businessDetails.businessName || !businessDetails.address || !businessDetails.phone}
                className="px-5 py-2.5 bg-brand-orange text-white text-sm font-semibold rounded-xl hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
              >
                {createProfileMutation.isPending ? 'Creating profile...' : 'Create profile on Google'}
              </button>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition"
              >
                <LogOut size={14} />
                Disconnect Account
              </button>
            </div>
          </div>
        )}

        {(status === 'pending_verification' || status === 'verified') && (
          <div className="space-y-5">
            <div className={`border rounded-xl p-4 flex items-start gap-3 ${
              status === 'verified' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
            }`}>
              <CheckCircle className={status === 'verified' ? 'text-emerald-600' : 'text-amber-600'} size={18} />
              <div>
                <h4 className={`text-sm font-semibold ${status === 'verified' ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {status === 'verified' ? 'Your Listing is Live!' : 'Awaiting Google Verification'}
                </h4>
                <p className={`text-xs mt-0.5 ${status === 'verified' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {status === 'verified' 
                    ? 'Customers can find your restaurant on Google Search and Google Maps.' 
                    : 'Google is reviewing your profile listing. Verification postcards or phone calls may be required depending on eligibility.'
                  }
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm border-t border-gray-100 pt-4">
              <div>
                <span className="text-xs text-gray-400 block">Google Account</span>
                <span className="font-medium text-gray-800">{gbp?.gbpAccountName || 'Default'}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Location Reference</span>
                <span className="font-medium text-gray-800 truncate block">{gbp?.gbpLocationName || 'Pending'}</span>
              </div>
              {gbp?.lastSyncedAt && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-400 block">Last Synced</span>
                  <span className="font-medium text-gray-800">{new Date(gbp.lastSyncedAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="flex gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
                >
                  <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
                  Sync details
                </button>
                {gbp?.gbpPlaceId && (
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${gbp.gbpPlaceId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                  >
                    <ExternalLink size={12} />
                    View on Google Maps
                  </a>
                )}
              </div>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition"
              >
                <LogOut size={14} />
                Disconnect Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
