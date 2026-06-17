import { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';

// Custom brand icons for social networks
function FacebookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
    </svg>
  );
}

function TwitterIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
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

export default function SocialShareWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.cafinity.io';
  const shareTitle = 'Cafinity — Cloud POS for cafés, coffee bars, and counter-service venues';

  const triggerFeedback = (message) => {
    setFeedbackMsg(message);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleCopyLink = async (platform = null) => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (platform === 'instagram') {
        triggerFeedback('Link copied! Paste it in your Instagram bio or story.');
      } else if (platform === 'tiktok') {
        triggerFeedback('Link copied! Paste it in your TikTok description or bio.');
      } else {
        triggerFeedback('Website URL copied to clipboard!');
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const shareLinks = {
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareTitle + ': ' + shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 select-none">
      {/* Floating Clickable Thumbnail Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-theme-bg-card/95 border border-theme-border/90 shadow-lg shadow-brand-orange/10 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
          aria-label="Share this website"
        >
          {/* Animated Pulsing Border Ring */}
          <span className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-brand-orange to-amber-500 opacity-20 blur-sm group-hover:opacity-40 animate-pulse transition-opacity" />
          
          <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-theme-border/60 bg-theme-bg-surface/50 p-1 flex items-center justify-center">
            <img src="/logo-1.png" alt="Cafinity Logo" className="h-full w-auto object-contain rounded-md" />
          </div>

          {/* Hover Tooltip */}
          <div className="absolute right-16 top-1/2 -translate-y-1/2 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 pointer-events-none origin-right whitespace-nowrap bg-theme-bg-card/90 border border-theme-border/70 text-theme-text-header text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md">
            Share Cafinity
          </div>
        </button>
      )}

      {/* Expanded Share Menu Card */}
      {isOpen && (
        <div className="w-80 rounded-2xl border border-theme-border/80 bg-theme-bg-card/90 shadow-2xl backdrop-blur-md p-5 animate-fade-in relative transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-brand-orange animate-pulse" />
              <h3 className="font-extrabold text-sm text-theme-text-header tracking-tight">Share Cafinity</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-theme-text-muted hover:text-theme-text-header p-1.5 rounded-lg border border-transparent hover:border-theme-border/60 hover:bg-theme-bg-surface/50 transition-all cursor-pointer"
              aria-label="Close share menu"
            >
              <X size={14} />
            </button>
          </div>

          {/* Dynamic Helper/Feedback Banner */}
          {feedbackMsg ? (
            <div className="mb-4 p-2.5 rounded-xl bg-brand-orange/10 border border-brand-orange/25 text-[11px] leading-relaxed text-brand-orange text-center font-medium animate-fade-in">
              {feedbackMsg}
            </div>
          ) : (
            <p className="text-xs text-theme-text-muted leading-relaxed mb-4">
              Love Cafinity? Help other café and restaurant owners run their venue without the chaos.
            </p>
          )}

          {/* Share Actions */}
          <div className="space-y-2.5">
            {/* Copy Link */}
            <button
              onClick={() => handleCopyLink()}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border bg-theme-bg-surface/40 hover:bg-theme-bg-surface/75 border-theme-border/70 hover:border-theme-border text-theme-text-main hover:text-theme-text-header transition-all text-xs font-semibold cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Copy size={14} />
                <span>Copy Website URL</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-theme-text-muted/60">
                Copy
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2 my-2 select-none">
              <div className="h-[1px] flex-1 bg-theme-border/50" />
              <span className="text-[9px] uppercase font-extrabold text-theme-text-muted/40 tracking-wider">Share to Apps</span>
              <div className="h-[1px] flex-1 bg-theme-border/50" />
            </div>

            {/* Social Platform Buttons Grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* WhatsApp */}
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item"
                aria-label="Share on WhatsApp"
              >
                <WhatsAppIcon className="w-4.5 h-4.5 text-[#25D366] transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">WhatsApp</span>
              </a>

              {/* X / Twitter */}
              <a
                href={shareLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item"
                aria-label="Share on X"
              >
                <TwitterIcon className="w-4 h-4 transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">X / Twitter</span>
              </a>

              {/* Facebook */}
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item"
                aria-label="Share on Facebook"
              >
                <FacebookIcon className="w-4 h-4 text-[#1877F2] transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">Facebook</span>
              </a>

              {/* LinkedIn */}
              <a
                href={shareLinks.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item"
                aria-label="Share on LinkedIn"
              >
                <LinkedInIcon className="w-4 h-4 text-[#0A66C2] transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">LinkedIn</span>
              </a>

              {/* Instagram */}
              <button
                onClick={() => handleCopyLink('instagram')}
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item cursor-pointer"
                aria-label="Copy link for Instagram"
              >
                <InstagramIcon className="w-4.5 h-4.5 text-[#E1306C] transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">Instagram</span>
              </button>

              {/* TikTok */}
              <button
                onClick={() => handleCopyLink('tiktok')}
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item cursor-pointer"
                aria-label="Copy link for TikTok"
              >
                <TikTokIcon className="w-4.5 h-4.5 text-[#00f2fe] transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">TikTok</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
