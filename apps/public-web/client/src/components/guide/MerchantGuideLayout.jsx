import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../Navbar';
import Footer from '../Footer';

export default function MerchantGuideLayout({ children, backTo = '/merchant-guide', backLabel = 'Back to guide' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-brand-orange border border-gray-300 bg-white px-3 py-2 rounded-lg shadow-sm transition-colors mb-8"
          >
            <ArrowLeft size={16} className="shrink-0" />
            {backLabel}
          </Link>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
