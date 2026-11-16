import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Flag, X } from 'lucide-react';
import { submitModerationReport } from '../../services/moderationService';
import { REPORT_DETAILS_MAX_LENGTH } from '../../services/validation';
import type { ReportReason, ReportTargetType } from '../../types';

interface ReportModalProps {
  isOpen: boolean;
  targetType: ReportTargetType;
  targetId: string;
  postId: string;
  targetAuthorId: string;
  targetAuthorUsername: string;
  reporterId: string;
  onClose: () => void;
}

const REPORT_REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  {
    value: 'unmarked_spoiler',
    label: 'Unmarked Spoiler',
    hint: 'Major plot reveals shared without spoiler protection.',
  },
  {
    value: 'spam',
    label: 'Spam or Self-Promotion',
    hint: 'Repetitive links, automated text, or off-topic promotion.',
  },
  {
    value: 'harassment',
    label: 'Harassment or Personal Attacks',
    hint: 'Targeted hostility, intimidation, or abuse toward members.',
  },
  {
    value: 'hate_speech',
    label: 'Hate Speech or Slurs',
    hint: 'Discriminatory or dehumanizing content.',
  },
  {
    value: 'other',
    label: 'Other Safety Concern',
    hint: 'Any other issue that violates ATA community standards.',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  targetId,
  postId,
  targetAuthorId,
  targetAuthorUsername,
  reporterId,
  onClose,
}) => {
  const [reason, setReason] = useState<ReportReason>('unmarked_spoiler');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await submitModerationReport(reporterId, {
        targetType,
        targetId,
        postId,
        targetAuthorId,
        reason,
        details,
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit report right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-report-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div className="flex items-center gap-2.5">
            <Flag className="h-4 w-4 text-[#EF3038] shrink-0" aria-hidden="true" />
            <div>
              <h2
                id="ata-report-modal-title"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                Report {targetType === 'post' ? 'Post' : 'Comment'}
              </h2>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Content by @{targetAuthorUsername}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-5 space-y-4">
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/50 p-4 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200"
            >
              <CheckCircle2
                className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Report Recorded</p>
                <p className="mt-1 leading-relaxed opacity-90">
                  Thank you for helping keep All Things Anime welcoming and
                  spoiler-safe. Your report has been saved for moderation review.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
              >
                <AlertCircle
                  className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Reason for Report
              </legend>
              {REPORT_REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      selected
                        ? 'border-[#EF3038] bg-[#EF3038]/5 dark:bg-[#EF3038]/10'
                        : 'border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038]/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ata-report-reason"
                      value={option.value}
                      checked={selected}
                      onChange={() => setReason(option.value)}
                      className="mt-0.5 accent-[#EF3038]"
                    />
                    <span className="text-xs">
                      <span className="block font-semibold text-[#090B14] dark:text-white">
                        {option.label}
                      </span>
                      <span className="block text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="ata-report-details"
                  className="text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Additional Context (Optional)
                </label>
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {details.trim().length}/{REPORT_DETAILS_MAX_LENGTH}
                </span>
              </div>
              <textarea
                id="ata-report-details"
                rows={3}
                maxLength={REPORT_DETAILS_MAX_LENGTH}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened or which episode/series is spoiled..."
                className="w-full resize-none rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs sm:text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[42px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 transition-colors"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
