import React from 'react';
import { Cookie, Flag, Lock, MessageSquarePlus, Scale } from 'lucide-react';
import type { LegalPageSlug } from '../../types';

interface SiteFooterProps {
  onNavigateLegal: (slug: LegalPageSlug) => void;
  onOpenCookiePreferences: () => void;
  onOpenCopyrightModal: () => void;
  onOpenFeedbackModal: () => void;
  onOpenAdminLogin: () => void;
}

const LEGAL_LINKS: Array<{ slug: LegalPageSlug; label: string }> = [
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms & Conditions' },
  { slug: 'cookie-policy', label: 'Cookie & Storage' },
  { slug: 'refund-policy', label: 'Refund Policy' },
  { slug: 'community-guidelines', label: 'Community Guidelines' },
];

export const SiteFooter: React.FC<SiteFooterProps> = ({
  onNavigateLegal,
  onOpenCookiePreferences,
  onOpenCopyrightModal,
  onOpenFeedbackModal,
  onOpenAdminLogin,
}) => {
  return (
    <footer
      aria-label="Legal, compliance, and platform links"
      className="mt-10 border-t border-[#D4D7E2] dark:border-[#303342] bg-white/90 dark:bg-[#171923]/90"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#090B14] dark:text-white">
              <Scale className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              <span className="font-display-space">All Things Anime (ATA)</span>
            </div>
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] max-w-xl leading-relaxed">
              Independent anime community & discovery companion. Catalogue metadata via AniList; free streaming directory strictly links to verified official legal platforms.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCookiePreferences}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              <Cookie className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Storage Preferences</span>
            </button>
            <button
              type="button"
              onClick={onOpenCopyrightModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              <Flag className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Copyright Notice</span>
            </button>
            <button
              type="button"
              onClick={onOpenFeedbackModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Feedback</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-[#D4D7E2]/70 dark:border-[#303342]/70 flex flex-wrap items-center justify-between gap-3 text-xs">
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGAL_LINKS.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => onNavigateLegal(item.slug)}
                className="text-[#52576B] dark:text-[#A7A9B8] hover:text-[#B92335] dark:hover:text-[#EF3038] font-medium underline-offset-4 hover:underline transition-colors py-1"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors py-1"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>Administrator Portal</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
