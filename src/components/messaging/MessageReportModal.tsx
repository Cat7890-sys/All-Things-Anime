import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Flag, X } from 'lucide-react';
import type { ReportReason } from '../../types';
import { REPORT_DETAILS_MAX_LENGTH } from '../../services/validation';

interface MessageReportModalProps {
  isOpen: boolean;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}

const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'harassment', label: 'Harassment or abusive conduct' },
  { value: 'spam', label: 'Spam or unsolicited promotion' },
  { value: 'hate_speech', label: 'Hate speech or slurs' },
  { value: 'rule_violation', label: 'Community guidelines violation' },
  { value: 'other', label: 'Other safety concern' },
];

export const MessageReportModal: React.FC<MessageReportModalProps> = ({
  isOpen,
  targetLabel,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState<ReportReason>('harassment');
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
      await onSubmit(reason, details);
      setSubmitted(true);
      setDetails('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit report.'
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
      aria-labelledby="ata-msg-report-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="h-4 w-4 text-[#EF3038] shrink-0" aria-hidden="true" />
            <h2
              id="ata-msg-report-title"
              className="font-display-space font-bold text-base text-white truncate"
            >
              Report {targetLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {submitted ? (
            <div className="space-y-4 text-center py-2">
              <CheckCircle2
                className="h-8 w-8 text-[#EF3038] mx-auto"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
                  Report submitted privately
                </p>
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Thank you for helping keep ATA Private Messaging respectful and
                  safe.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[42px] rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335]"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div>
                <label
                  htmlFor="ata-msg-report-reason"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
                >
                  Reason
                </label>
                <select
                  id="ata-msg-report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  className="w-full min-h-[42px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                >
                  {REPORT_REASONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="ata-msg-report-details"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
                >
                  Additional context (optional)
                </label>
                <textarea
                  id="ata-msg-report-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={REPORT_DETAILS_MAX_LENGTH}
                  placeholder="Share brief context for moderation review..."
                  className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-[#EF3038] border border-[#B92335] text-xs font-semibold text-white hover:bg-[#B92335] disabled:opacity-60"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
