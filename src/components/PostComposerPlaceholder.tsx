import React, { useState } from 'react';
import { ImagePlus, Info, MessageSquarePlus, Send } from 'lucide-react';

const COMPOSER_PROMPTS = ['Opinion', 'Series Review', 'Debate Prompt'] as const;
type ComposerPromptType = (typeof COMPOSER_PROMPTS)[number];

export const PostComposerPlaceholder: React.FC = () => {
  const [draftText, setDraftText] = useState('');
  const [selectedPrompt, setSelectedPrompt] =
    useState<ComposerPromptType>('Opinion');
  const [showInactiveNotice, setShowInactiveNotice] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowInactiveNotice(true);
  };

  return (
    <section
      aria-labelledby="composer-placeholder-heading"
      className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
        <div className="flex items-center gap-2.5">
          <MessageSquarePlus
            className="h-5 w-5 text-[#EF3038]"
            aria-hidden="true"
          />
          <h2
            id="composer-placeholder-heading"
            className="font-display-space font-bold text-xl sm:text-2xl text-[#090B14] dark:text-white"
          >
            Share Your Opinion
          </h2>
        </div>
        <span className="text-xs font-medium text-[#52576B] dark:text-[#A7A9B8]">
          Visual Placeholder <span aria-hidden="true">·</span> Posting Inactive
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Preview post format"
        >
          {COMPOSER_PROMPTS.map((type) => {
            const isActive = selectedPrompt === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setSelectedPrompt(type);
                  setShowInactiveNotice(false);
                }}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors duration-150 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#EF3038] text-white border-[#B92335]'
                    : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:text-[#090B14] dark:hover:text-white hover:border-[#EF3038]/60'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="ata-composer-preview" className="sr-only">
            Post composer visual preview
          </label>
          <textarea
            id="ata-composer-preview"
            rows={3}
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              if (showInactiveNotice) setShowInactiveNotice(false);
            }}
            placeholder={`Preview layout for a future ${selectedPrompt.toLowerCase()} post (e.g., which anime scene changed how you look at visual pacing?)`}
            className="w-full resize-none rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/80 focus:border-[#EF3038] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF3038]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowInactiveNotice(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-[#090B14] dark:text-[#A7A9B8] bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038]/60 hover:text-[#090B14] dark:hover:text-white transition-colors whitespace-nowrap"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            <span>Attach Media (Preview)</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors duration-150 whitespace-nowrap"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Preview Post Action</span>
          </button>
        </div>

        {showInactiveNotice && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-xs text-[#090B14] dark:text-white"
          >
            <Info
              className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">
                Composer Placeholder — Publishing Not Connected Yet
              </p>
              <p className="mt-0.5 text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                This card previews the layout for posting opinions on ATA. Real
                publishing will activate once member accounts and Firestore
                persistence are integrated in a later build.
              </p>
            </div>
          </div>
        )}
      </form>
    </section>
  );
};
