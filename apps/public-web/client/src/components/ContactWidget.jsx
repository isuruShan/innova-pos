import { useEffect, useState } from 'react';
import { X, MessageCircle, MessageSquare, ArrowUpRight } from 'lucide-react';
import api from '../api';

// Brand SVGs for Facebook, Instagram, and WhatsApp
function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
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

function WhatsAppIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    api.get('/contact/platform')
      .then(res => setContact(res.data))
      .catch(err => console.error('Failed to load contact info in widget:', err));
  }, []);

  const cleanPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, ''); // Strip non-digits
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '94' + cleaned.substring(1); // Sri Lanka conversion
    }
    return cleaned;
  };

  const social = contact?.social || {};
  const supportPhone = contact?.phonePrimary || '';
  const waPhone = cleanPhoneForWhatsApp(supportPhone);

  const contactChannels = {
    whatsapp: waPhone ? `https://wa.me/${waPhone}` : null,
    facebook: social.facebook || 'https://www.facebook.com/cafinity',
    instagram: social.instagram || 'https://www.instagram.com/cafinity',
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-xl shadow-brand-orange/30 transition-all duration-300 hover:scale-110 hover:shadow-brand-orange/40 active:scale-95 cursor-pointer"
          aria-label="Contact support"
        >
          {/* Animated Pulsing Ring */}
          <span className="absolute -inset-1 rounded-full bg-brand-orange opacity-20 blur-sm group-hover:opacity-40 animate-ping transition-opacity duration-1000" />
          
          <MessageCircle size={26} className="relative transition-transform duration-300 group-hover:rotate-12" />

          {/* Tooltip */}
          <div className="absolute right-16 top-1/2 -translate-y-1/2 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 pointer-events-none origin-right whitespace-nowrap bg-theme-bg-card/90 border border-theme-border/70 text-theme-text-header text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md">
            Need help? Contact us
          </div>
        </button>
      )}

      {/* Expanded Contact Panel */}
      {isOpen && (
        <div className="w-80 rounded-2xl border border-theme-border/80 bg-theme-bg-card/90 shadow-2xl backdrop-blur-md p-5 animate-fade-in relative transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-orange" />
              <h3 className="font-extrabold text-sm text-theme-text-header tracking-tight">Contact Us</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-theme-text-muted hover:text-theme-text-header p-1.5 rounded-lg border border-transparent hover:border-theme-border/60 hover:bg-theme-bg-surface/50 transition-all cursor-pointer"
              aria-label="Close support menu"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-xs text-theme-text-muted leading-relaxed mb-4">
            Have questions about registers, pricing, or setup? Chat with our team directly.
          </p>

          {/* Contact Channels List */}
          <div className="space-y-2.5">
            {/* WhatsApp */}
            {contactChannels.whatsapp && (
              <a
                href={contactChannels.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 text-theme-text-main hover:text-theme-text-header transition-all group/item"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
                    <WhatsAppIcon className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold text-theme-text-header">WhatsApp Chat</span>
                    <span className="block text-[10px] text-theme-text-muted">Instant operational support</span>
                  </div>
                </div>
                <ArrowUpRight size={14} className="text-theme-text-muted group-hover/item:text-theme-text-header transition-colors" />
              </a>
            )}

            {/* Facebook */}
            <a
              href={contactChannels.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/5 hover:bg-[#1877F2]/10 hover:border-[#1877F2]/40 text-theme-text-main hover:text-theme-text-header transition-all group/item"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                  <FacebookIcon className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-theme-text-header">Facebook Page</span>
                  <span className="block text-[10px] text-theme-text-muted">General inquiries & updates</span>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-theme-text-muted group-hover/item:text-theme-text-header transition-colors" />
            </a>

            {/* Instagram */}
            <a
              href={contactChannels.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#E1306C]/20 bg-[#E1306C]/5 hover:bg-[#E1306C]/10 hover:border-[#E1306C]/40 text-theme-text-main hover:text-theme-text-header transition-all group/item"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E1306C]/10 text-[#E1306C]">
                  <InstagramIcon className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-theme-text-header">Instagram DM</span>
                  <span className="block text-[10px] text-theme-text-muted">Follow us & drop a message</span>
                </div>
              </div>
              <ArrowUpRight size={14} className="text-theme-text-muted group-hover/item:text-theme-text-header transition-colors" />
            </a>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border/60 text-center">
            <span className="text-[9px] uppercase font-extrabold text-theme-text-muted/50 tracking-wider">
              Typically replies in minutes
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
