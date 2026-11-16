import React, { useState } from 'react';
import { ArrowUpRight, Flame, MessageSquare, ThumbsUp, X } from 'lucide-react';
import type { DiscussionCategory, DiscussionThread } from '../types';

interface PopularDiscussionsProps {
  discussions: DiscussionThread[];
}

const CATEGORIES: DiscussionCategory[] = [
  'All',
  'Story & Lore',
  'Animation',
  'Debates',
];

export const PopularDiscussions: React.FC<PopularDiscussionsProps> = ({
  discussions,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<DiscussionCategory>('All');
  const [activeThread, setActiveThread] = useState<DiscussionThread | null>(
    null
  );

  const visibleThreads =
    selectedCategory === 'All'
      ? discussions
      : discussions.filter((thread) => thread.category === selectedCategory);

  return (
    <section
      id="popular-discussions"
      aria-labelledby="popular-discussions-heading"
      className="space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
        <div>
          <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
            Demonstration Feed <span aria-hidden="true">·</span> Sample Content
          </p>
          <h2
            id="popular-discussions-heading"
            className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white mt-1"
          >
            Popular Discussions
          </h2>
        </div>

        {/* Interactive Category Filter Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter sample discussions by topic"
        >
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg border transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#EF3038] text-white border-[#B92335]'
                    : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:text-[#090B14] dark:hover:text-white hover:border-[#EF3038]/60'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Discussion Cards */}
      <div className="space-y-3.5">
        {visibleThreads.map((thread) => (
          <article
            key={thread.id}
            className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-5 transition-colors duration-150 hover:border-[#EF3038]/60 dark:hover:border-[#EF3038]/60"
          >
            {/* Unboxed Metadata Line */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              <span className="font-semibold text-[#090B14] dark:text-white">
                {thread.authorDisplay}
              </span>
              <span>{thread.authorHandle}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#B92335] dark:text-[#EF3038]">
                {thread.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>{thread.seriesTitle}</span>
              <span aria-hidden="true">·</span>
              <span>{thread.sampleTimestamp}</span>
            </div>

            <h3 className="mt-2.5 font-display-space text-base sm:text-lg font-bold leading-snug text-[#090B14] dark:text-white">
              {thread.title}
            </h3>

            <p className="mt-1.5 text-sm leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
              {thread.excerpt}
            </p>

            {/* Footer Metrics & Reader Action */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3.5 border-t border-[#D4D7E2]/70 dark:border-[#303342]">
              <div className="flex items-center gap-4 text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-display-space font-semibold text-[#090B14] dark:text-white">
                    {thread.sampleUpvotes}
                  </span>
                  <span>sample votes</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-display-space font-semibold text-[#090B14] dark:text-white">
                    {thread.sampleReplyCount}
                  </span>
                  <span>sample replies</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveThread(thread)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[38px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] hover:text-[#B92335] dark:hover:text-white transition-colors duration-150 whitespace-nowrap"
              >
                <span>Open Sample Thread</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Accessible Thread Preview Modal */}
      {activeThread && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sample-thread-modal-title"
          onClick={() => setActiveThread(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
              <div>
                <p className="font-accent-orbitron text-[11px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
                  Demonstration Thread Preview <span aria-hidden="true">·</span>{' '}
                  {activeThread.seriesTitle}
                </p>
                <h3
                  id="sample-thread-modal-title"
                  className="mt-1.5 font-display-space text-lg sm:text-xl font-bold text-[#090B14] dark:text-white"
                >
                  {activeThread.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveThread(null)}
                aria-label="Close sample thread preview"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              <span className="font-semibold text-[#090B14] dark:text-white">
                {activeThread.authorDisplay} ({activeThread.authorHandle})
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeThread.category}</span>
              <span aria-hidden="true">·</span>
              <span>{activeThread.sampleTimestamp}</span>
            </div>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#090B14] dark:text-white/90">
              {activeThread.fullSampleBody}
            </p>

            <div className="mt-5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              <div className="flex items-center gap-2 font-semibold text-[#090B14] dark:text-white">
                <Flame
                  className="h-4 w-4 text-[#EF3038]"
                  aria-hidden="true"
                />
                <span>Sample Showcase Entry</span>
              </div>
              <p className="mt-1 leading-relaxed">
                This is original demonstration content illustrating curated
                editorial previews. Use the live Community Feed above to publish
                real posts, react, comment, and follow members.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
