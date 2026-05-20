import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import MerchantGuideLayout from '../components/guide/MerchantGuideLayout';
import { GUIDE_INTRO, GUIDE_SECTIONS, FEATURE_MATRIX } from '../content/merchantGuide';

export default function MerchantGuideIndex() {
  return (
    <MerchantGuideLayout backTo="/" backLabel="Back to home">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange">
            <BookOpen size={24} />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{GUIDE_INTRO.title}</h1>
        </div>
        <p className="text-gray-600 leading-relaxed">{GUIDE_INTRO.subtitle}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        {GUIDE_INTRO.portals.map((p) => (
          <div key={p.name} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="font-semibold text-brand-orange">{p.name}</p>
            <p className="text-sm text-gray-600 mt-1">{p.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4">Topics</h2>
      <ul className="space-y-2">
        {GUIDE_SECTIONS.map((s) => (
          <li key={s.id}>
            <Link
              to={`/merchant-guide/${s.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 hover:border-brand-orange/40 hover:shadow-sm transition group"
            >
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-brand-orange transition-colors">
                  {s.title}
                </p>
                {s.summary ? <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{s.summary}</p> : null}
              </div>
              <ChevronRight size={18} className="text-gray-400 shrink-0 group-hover:text-brand-orange" />
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-12 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Feature map by application</h2>
          <p className="text-sm text-gray-500 mt-1">Where each capability lives for merchant admins.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-5 py-3 font-semibold">Area</th>
                <th className="px-4 py-3 font-semibold">Admin portal</th>
                <th className="px-4 py-3 font-semibold">POS</th>
                <th className="px-4 py-3 font-semibold">Public web</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.area} className="border-t border-gray-100">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.area}</td>
                  <td className="px-4 py-3 text-gray-600">{row.admin}</td>
                  <td className="px-4 py-3 text-gray-600">{row.pos}</td>
                  <td className="px-4 py-3 text-gray-600">{row.web}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MerchantGuideLayout>
  );
}
