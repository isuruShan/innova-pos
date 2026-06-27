import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import api from '../api';
import { fieldAttrs } from '../utils/formFields';

// Custom Brand SVGs since modern lucide-react removed brand icons
function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function LinkedInIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

function YouTubeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.95 1.96C5.12 19.5 12 19.5 12 19.5s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  );
}

export default function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    api.get('/contact/platform')
      .then(res => setContact(res.data))
      .catch(err => console.error('Failed to load platform contact details:', err));
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    try {
      await api.post('/newsletter', { email });
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  const social = contact?.social || {};
  const hasSocial = Object.values(social).some(Boolean);

  return (
    <footer id="footer" className="bg-theme-bg-card border-t border-theme-border/80 text-theme-text-main transition-colors duration-250">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-theme-bg-surface/40 p-1 rounded-lg border border-theme-border/50">
                <img src="/logo-1.png" alt="Cafinity" className="h-9 w-auto rounded-md" />
              </div>
              <span className="font-extrabold text-lg tracking-tight text-theme-text-header">
                {contact?.brandName || 'Cafinity'}
              </span>
            </div>
            <p className="text-theme-text-muted text-sm leading-relaxed mb-6 max-w-sm">
              Cafinity is the unified Point of Sale built for busy cafes, counter service, specialty espresso, and restaurant floor plans.
            </p>
            {/* Newsletter */}
            <div>
              <p className="text-sm font-semibold mb-3 text-theme-text-header">Stay updated</p>
              {status === 'success' ? (
                <p className="text-sm text-green-500 font-medium">Subscribed! Thanks for joining.</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={fieldAttrs('email').placeholder}
                    maxLength={fieldAttrs('email').maxLength}
                    required
                    className="flex-1 bg-theme-bg-surface/50 border border-theme-border/85 rounded-lg px-3 py-2 text-sm placeholder-theme-text-muted/60 text-theme-text-main focus:outline-none focus:border-brand-orange"
                  />
                  <button type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 bg-brand-orange hover:bg-brand-orange-hover cursor-pointer"
                  >
                    Subscribe
                  </button>
                </form>
              )}
              {status === 'error' && <p className="text-sm text-red-500 mt-1">Something went wrong. Try again.</p>}
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-semibold mb-4 text-theme-text-header">Platform</p>
            <ul className="space-y-2">
              <li>
                <a href="/#features" className="text-sm text-theme-text-muted hover:text-theme-text-header transition-colors">Features</a>
              </li>
              <li>
                <a href="/#pricing" className="text-sm text-theme-text-muted hover:text-theme-text-header transition-colors">Pricing</a>
              </li>
              <li>
                <Link to="/merchant-guide" className="text-sm text-theme-text-muted hover:text-theme-text-header transition-colors">Guide</Link>
              </li>
              <li>
                <a href="/#contact" className="text-sm text-theme-text-muted hover:text-theme-text-header transition-colors">Contact</a>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <p className="text-sm font-semibold mb-4 text-theme-text-header">Contact</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-theme-text-muted">
                <Mail size={14} className="shrink-0" />
                <span>{contact?.supportEmail || 'innovasolutionslk@gmail.com'}</span>
              </li>
              
              {contact?.phonePrimary && (
                <li className="flex items-center gap-2 text-sm text-theme-text-muted">
                  <Phone size={14} className="shrink-0" />
                  <a
                    href={`tel:${contact.phonePrimary}`}
                    className="hover:text-theme-text-header transition-colors"
                  >
                    {contact.phonePrimary}
                  </a>
                </li>
              )}

              {(contact?.addressLine1 || contact?.city) && (
                <li className="flex items-start gap-2 text-sm text-theme-text-muted">
                  <MapPin size={14} className="shrink-0 mt-0.5" />
                  <span>
                    {contact.addressLine1}
                    {contact.addressLine2 && `, ${contact.addressLine2}`}
                    {contact.city && `, ${contact.city}`}
                    {contact.country && `, ${contact.country}`}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Social Links & Copyright */}
        <div className="border-t border-theme-border/60 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-theme-text-muted">
            &copy; {new Date().getFullYear()} {contact?.brandName || 'Cafinity'}. All rights reserved.
          </p>
          
          <div className="flex items-center gap-5">
            {hasSocial && (
              <div className="flex items-center gap-4 mr-2 border-r border-theme-border/80 pr-6">
                {social.facebook && (
                  <a href={social.facebook} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="Facebook">
                    <FacebookIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {social.instagram && (
                  <a href={social.instagram} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="Instagram">
                    <InstagramIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {social.tiktok && (
                  <a href={social.tiktok} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="TikTok">
                    <TikTokIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {social.linkedin && (
                  <a href={social.linkedin} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="LinkedIn">
                    <LinkedInIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {social.twitter && (
                  <a href={social.twitter} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="Twitter/X">
                    <TwitterIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
                {social.youtube && (
                  <a href={social.youtube} target="_blank" rel="noreferrer" className="text-theme-text-muted hover:text-theme-text-header transition-colors" aria-label="YouTube">
                    <YouTubeIcon className="w-[18px] h-[18px]" />
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-4">
              {['Privacy Policy', 'Terms of Service'].map(l => (
                <a key={l} href="#" className="text-sm text-theme-text-muted hover:text-theme-text-header transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
