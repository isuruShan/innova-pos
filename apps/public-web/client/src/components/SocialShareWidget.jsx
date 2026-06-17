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

export default function SocialShareWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = 'https://cafinity.io';
  const shareTitle = 'Cafinity — Cloud POS for cafés, coffee bars, and counter-service venues';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const shareLinks = {
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

          <p className="text-xs text-theme-text-muted leading-relaxed mb-4">
            Love Cafinity? Help other café and restaurant owners run their venue without the chaos.
          </p>

          {/* Share Actions */}
          <div className="space-y-2.5">
            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-xs font-semibold cursor-pointer ${
                copied
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  : 'bg-theme-bg-surface/40 hover:bg-theme-bg-surface/75 border-theme-border/70 hover:border-theme-border text-theme-text-main hover:text-theme-text-header'
              }`}
            >
              <span className="flex items-center gap-2.5">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Link copied!' : 'Copy Website URL'}</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-theme-text-muted/60">
                {copied ? 'Done' : 'Copy'}
              </span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2 my-2 select-none">
              <div className="h-[1px] flex-1 bg-theme-border/50" />
              <span className="text-[9px] uppercase font-extrabold text-theme-text-muted/40 tracking-wider">Social Platforms</span>
              <div className="h-[1px] flex-1 bg-theme-border/50" />
            </div>

            {/* Social Platform Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {/* X / Twitter */}
              <a
                href={shareLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-theme-bg-surface/30 hover:bg-theme-bg-surface/80 border border-theme-border/70 hover:border-theme-border/90 text-theme-text-main hover:text-theme-text-header transition-all group/item"
                aria-label="Share on X"
              >
                <TwitterIcon className="w-4 h-4 transition-transform group-hover/item:scale-110" />
                <span className="text-[10px] font-bold">X</span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
