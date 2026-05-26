import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function SubscriptionEndedBanner() {
  const [supportPhone, setSupportPhone] = useState('+94 77 123 4567');

  useEffect(() => {
    axios.get('/api/platform-contact/public')
      .then((res) => {
        if (res.data?.primaryPhone) {
          setSupportPhone(res.data.primaryPhone);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full bg-red-600 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-medium shadow-md">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="shrink-0 animate-bounce" />
        <span>
          Your subscription has ended. Please renew your subscription in order to continue the service.
        </span>
      </div>
      <div className="flex items-center gap-2 bg-red-700/50 px-3 py-1 rounded-lg border border-red-500/20 shrink-0">
        <span>Immediate Support:</span>
        <a href={`tel:${supportPhone}`} className="font-bold underline hover:text-red-100 transition-colors">
          {supportPhone}
        </a>
      </div>
    </div>
  );
}
