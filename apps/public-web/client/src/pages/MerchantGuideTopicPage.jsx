import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Lightbulb, ListChecks } from 'lucide-react';
import MerchantGuideLayout from '../components/guide/MerchantGuideLayout';
import { GUIDE_SECTIONS, getGuideSectionBySlug } from '../content/merchantGuide';

export default function MerchantGuideTopicPage() {
  const { slug } = useParams();
  const section = getGuideSectionBySlug(slug);
  const idx = GUIDE_SECTIONS.findIndex((s) => s.slug === slug);
  const prev = idx > 0 ? GUIDE_SECTIONS[idx - 1] : null;
  const next = idx >= 0 && idx < GUIDE_SECTIONS.length - 1 ? GUIDE_SECTIONS[idx + 1] : null;

  if (!section) {
    return (
      <MerchantGuideLayout>
        <p className="text-gray-600">Topic not found.</p>
        <Link to="/merchant-guide" className="text-brand-orange font-semibold text-sm mt-4 inline-block">
          Return to guide index
        </Link>
      </MerchantGuideLayout>
    );
  }

  return (
    <MerchantGuideLayout>
      <p className="text-xs font-semibold text-brand-orange uppercase tracking-wide mb-2">Merchant guide</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{section.title}</h1>
      {section.summary ? <p className="text-gray-600 mb-4 leading-relaxed">{section.summary}</p> : null}

      {section.overview ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6 text-sm text-gray-700 leading-relaxed space-y-3">
          {section.overview.split('\n\n').map((para) => (
            <p key={para.slice(0, 40)}>{para}</p>
          ))}
        </div>
      ) : null}

      {section.prerequisites?.length ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-5 mb-8">
          <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm mb-3">
            <ListChecks size={18} />
            Before you start
          </div>
          <ul className="space-y-2 text-sm text-amber-950/90">
            {section.prerequisites.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand-orange font-bold shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="space-y-8">
        {section.steps.map((step, stepIdx) => (
          <li key={step.heading} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange text-sm font-bold">
              {stepIdx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-gray-900 text-lg">{step.heading}</h2>
              <div className="text-gray-600 text-sm mt-2 leading-relaxed space-y-3">
                {step.body.split('\n\n').map((para) => (
                  <p key={para.slice(0, 48)}>{para}</p>
                ))}
              </div>
              {step.tip ? (
                <div className="mt-4 flex gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
                  <Lightbulb size={18} className="shrink-0 text-teal-600 mt-0.5" />
                  <p>{step.tip}</p>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {section.outcome ? (
        <div className="mt-10 rounded-xl bg-gray-100 border border-gray-200 px-5 py-4 text-sm text-gray-800">
          <p className="font-semibold text-gray-900 mb-1">When you are done</p>
          <p className="leading-relaxed">{section.outcome}</p>
        </div>
      ) : null}

      <nav className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-between">
        {prev ? (
          <Link
            to={`/merchant-guide/${prev.slug}`}
            className="text-sm font-medium text-gray-600 hover:text-brand-orange"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`/merchant-guide/${next.slug}`}
            className="text-sm font-medium text-brand-orange hover:underline inline-flex items-center gap-1"
          >
            {next.title}
            <ChevronRight size={14} />
          </Link>
        ) : null}
      </nav>
    </MerchantGuideLayout>
  );
}
