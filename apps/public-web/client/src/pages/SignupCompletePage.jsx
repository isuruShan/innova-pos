import { Link } from 'react-router-dom';
import { CheckCircle, Clock, Mail, Zap } from 'lucide-react';

export default function SignupCompletePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="px-4 py-5 border-b bg-white">
        <Link to="/" className="flex items-center w-fit">
          <img src="/logo-1.png" alt="Cafinity" className="h-10 w-auto rounded-lg shadow-sm" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-100">
            <CheckCircle size={40} className="text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">Application submitted!</h1>
          <p className="text-gray-500 text-base leading-relaxed mb-8">
            Thank you for applying to Cafinity. Our team will review your application and get back to you within <strong>1–2 business days</strong>.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-left space-y-4 mb-8">
            <h3 className="text-sm font-semibold text-gray-700">What happens next?</h3>
            {[
              { icon: Clock, title: 'Review in progress', desc: 'Our team will verify your business details within 1–2 business days.' },
              { icon: Mail, title: 'Email notification', desc: 'You\'ll receive an email with your login credentials once approved.' },
              { icon: Zap, title: 'Start your trial', desc: 'Log in and enjoy your 30-day free trial immediately after approval.' },
            ].map(step => (
              <div key={step.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-brown-deep/5">
                  <step.icon size={15} className="text-brand-teal" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Link to="/"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover transition-colors"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
