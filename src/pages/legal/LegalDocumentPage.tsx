import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Cookie,
  FileText,
  Flag,
  MessageSquarePlus,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import {
  ATA_OPERATOR_LEGAL_CONFIG,
  ATA_STORAGE_INVENTORY,
  ATA_TRACKING_AUDIT_DISCLOSURE,
  LEGAL_DOCUMENTS,
} from '../../services/legal/legalConfig';
import { fetchLegalDocumentOverride } from '../../services/legal/legalService';
import type { LegalDocumentOverride, LegalPageSlug } from '../../types';

interface LegalDocumentPageProps {
  slug: LegalPageSlug;
  onSelectSlug: (slug: LegalPageSlug) => void;
  onBackToApp: () => void;
  onOpenCookiePreferences: () => void;
  onOpenCopyrightModal: () => void;
  onOpenFeedbackModal: () => void;
}

const LEGAL_TABS: Array<{ slug: LegalPageSlug; label: string }> = [
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms & Conditions' },
  { slug: 'cookie-policy', label: 'Cookie & Storage' },
  { slug: 'refund-policy', label: 'Refund Policy' },
  { slug: 'community-guidelines', label: 'Community Guidelines' },
];

export const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({
  slug,
  onSelectSlug,
  onBackToApp,
  onOpenCookiePreferences,
  onOpenCopyrightModal,
  onOpenFeedbackModal,
}) => {
  const [overrideDoc, setOverrideDoc] = useState<LegalDocumentOverride | null>(
    null
  );
  const [isLoadingOverride, setIsLoadingOverride] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingOverride(true);
    void fetchLegalDocumentOverride(slug)
      .then((res) => {
        if (active) setOverrideDoc(res);
      })
      .finally(() => {
        if (active) setIsLoadingOverride(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const baseDoc = LEGAL_DOCUMENTS[slug];
  const displayTitle = overrideDoc?.title || baseDoc.title;
  const displayLastUpdated =
    overrideDoc?.lastUpdatedLabel || baseDoc.lastUpdated;

  const hasOwnerPlaceholders = Object.values(ATA_OPERATOR_LEGAL_CONFIG).some(
    (val) => typeof val === 'string' && val.includes('[OWNER ACTION REQUIRED')
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Return & Cross-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToApp}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
          <span>Back to All Things Anime</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCopyrightModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
          >
            <Flag className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Copyright Complaint</span>
          </button>
          <button
            type="button"
            onClick={onOpenFeedbackModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
          >
            <MessageSquarePlus
              className="h-3.5 w-3.5 text-[#EF3038]"
              aria-hidden="true"
            />
            <span>Accessibility / Feedback</span>
          </button>
        </div>
      </div>

      {/* Document Selector Tabs */}
      <nav
        aria-label="Legal and compliance documents"
        className="flex flex-wrap gap-2"
      >
        {LEGAL_TABS.map((tab) => {
          const active = tab.slug === slug;
          return (
            <button
              key={tab.slug}
              type="button"
              onClick={() => onSelectSlug(tab.slug)}
              aria-current={active ? 'page' : undefined}
              className={`px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors ${
                active
                  ? 'bg-[#EF3038] text-white border-[#B92335]'
                  : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Main Document Card */}
      <article className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm">
        <header className="bg-[#090B14] px-6 py-6 border-b border-[#303342] cosmic-backdrop-grid space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[#EF3038]">
            <Scale className="h-4 w-4" aria-hidden="true" />
            <span className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] uppercase">
              ATA Legal & Governance
            </span>
          </div>
          <h1 className="font-display-space font-bold text-2xl sm:text-3xl text-white">
            {displayTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#D4D7E2] max-w-2xl">
            {baseDoc.subtitle}
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-4 text-[11px] text-[#A7A9B8] tabular-nums">
            <span>Last Updated: {displayLastUpdated}</span>
            <span>Primary Jurisdiction: {ATA_OPERATOR_LEGAL_CONFIG.primaryJurisdiction}</span>
            {isLoadingOverride && <span>Checking live document updates...</span>}
          </div>
        </header>

        <div className="p-6 sm:p-8 space-y-6">
          {hasOwnerPlaceholders && (
            <div
              role="note"
              className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle
                className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-bold">
                  Operator Registration & Contact Placeholders Pending
                </p>
                <p className="leading-relaxed">
                  Fields marked <code className="font-mono">[OWNER ACTION REQUIRED: ...]</code>{' '}
                  must be completed by the site Owner in{' '}
                  <code className="font-mono">src/services/legal/legalConfig.ts</code>{' '}
                  or via the Owner Legal Compliance editor before commercial or public launch.
                </p>
              </div>
            </div>
          )}

          {overrideDoc?.customSummary && (
            <section className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#090B14] dark:text-white">
                <ShieldCheck
                  className="h-4 w-4 text-[#EF3038]"
                  aria-hidden="true"
                />
                <span>Published Administrator Notice</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-[#090B14] dark:text-[#D4D7E2] whitespace-pre-line">
                {overrideDoc.customSummary}
              </p>
            </section>
          )}

          {overrideDoc && overrideDoc.guidelinesList.length > 0 && (
            <section className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-2">
              <h2 className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
                Supplementary Platform Rules & Updates
              </h2>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#090B14] dark:text-[#D4D7E2]">
                {overrideDoc.guidelinesList.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="space-y-6">
            {baseDoc.sections.map((sec) => (
              <section key={sec.heading} className="space-y-2.5">
                <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                  {sec.heading}
                </h2>
                {sec.paragraphs.map((p, idx) => (
                  <p
                    key={idx}
                    className="text-xs sm:text-sm leading-relaxed text-[#52576B] dark:text-[#D4D7E2]"
                  >
                    {p}
                  </p>
                ))}
                {sec.bullets && sec.bullets.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm leading-relaxed text-[#52576B] dark:text-[#D4D7E2]">
                    {sec.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {/* Cookie & Storage Inventory Table */}
          {slug === 'cookie-policy' && (
            <section
              aria-labelledby="ata-storage-inventory-heading"
              className="pt-4 border-t border-[#D4D7E2] dark:border-[#303342] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="ata-storage-inventory-heading"
                    className="font-display-space font-bold text-lg text-[#090B14] dark:text-white flex items-center gap-2"
                  >
                    <Cookie className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                    <span>Live Browser Storage Inventory</span>
                  </h2>
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] mt-1">
                    Advertising Cookies: {ATA_TRACKING_AUDIT_DISCLOSURE.usesAdvertisingCookies ? 'Yes' : 'None'} ·
                    Analytics Pixels: {ATA_TRACKING_AUDIT_DISCLOSURE.usesGoogleAnalytics ? 'Yes' : 'None'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenCookiePreferences}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
                >
                  <Cookie className="h-4 w-4" aria-hidden="true" />
                  <span>Open Storage Preferences</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#D4D7E2] dark:border-[#303342]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F4F5F8] dark:bg-[#090B14] border-b border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white">
                      <th className="px-3.5 py-2.5 font-semibold">Storage</th>
                      <th className="px-3.5 py-2.5 font-semibold">Key / Database</th>
                      <th className="px-3.5 py-2.5 font-semibold">Category</th>
                      <th className="px-3.5 py-2.5 font-semibold">Purpose & Retention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4D7E2] dark:divide-[#303342]">
                    {ATA_STORAGE_INVENTORY.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3.5 py-3 font-medium text-[#090B14] dark:text-white whitespace-nowrap">
                          {item.storageType}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                          {item.keyOrDatabase}
                        </td>
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              item.category === 'strictly_necessary'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {item.category === 'strictly_necessary'
                              ? 'Strictly Necessary'
                              : 'Functional'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-[#52576B] dark:text-[#D4D7E2] leading-relaxed">
                          <p>{item.purpose}</p>
                          <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                            Retention: {item.retention}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Operator Metadata Summary Footer */}
          <footer className="pt-4 border-t border-[#D4D7E2] dark:border-[#303342] text-xs text-[#52576B] dark:text-[#A7A9B8] flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>All Things Anime (ATA) Legal & Compliance Reference</span>
            </span>
            <span>POPIA · PAIA · ECTA · CPA Aligned</span>
          </footer>
        </div>
      </article>
    </div>
  );
};
