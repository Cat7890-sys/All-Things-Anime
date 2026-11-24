import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  LogIn,
  MessageSquarePlus,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  submitCopyrightComplaint,
  submitUserFeedback,
} from '../../services/moderationService';
import type { CopyrightComplaint, UserFeedbackRecord } from '../../types';

interface CopyrightFeedbackModalProps {
  isOpen: boolean;
  initialTab?: 'copyright' | 'feedback';
  pageContext?: string;
  onClose: () => void;
  onRequireAuth: () => void;
}

export const CopyrightFeedbackModal: React.FC<CopyrightFeedbackModalProps> = ({
  isOpen,
  initialTab = 'copyright',
  pageContext = '/',
  onClose,
  onRequireAuth,
}) => {
  const { firebaseUser, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'copyright' | 'feedback'>(
    initialTab
  );

  // Copyright Complaint State
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [rightsHolderOrg, setRightsHolderOrg] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [targetType, setTargetType] =
    useState<CopyrightComplaint['targetType']>('post');
  const [targetReference, setTargetReference] = useState('');
  const [description, setDescription] = useState('');
  const [goodFaithConfirmed, setGoodFaithConfirmed] = useState(false);
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);

  // User Feedback State
  const [feedbackCategory, setFeedbackCategory] =
    useState<UserFeedbackRecord['category']>('accessibility');
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setError(null);
    setSuccessId(null);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (profile?.email && !claimantEmail) {
      setClaimantEmail(profile.email);
    } else if (firebaseUser?.email && !claimantEmail) {
      setClaimantEmail(firebaseUser.email);
    }
  }, [profile?.email, firebaseUser?.email, claimantEmail]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSignedIn = Boolean(firebaseUser);
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const handleSubmitCopyright = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const id = await submitCopyrightComplaint({
        claimantName,
        claimantEmail,
        rightsHolderOrganization: rightsHolderOrg,
        workTitle,
        targetType,
        targetReference,
        description,
        goodFaithConfirmed,
        accuracyConfirmed,
      });
      setSuccessId(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit copyright complaint.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const id = await submitUserFeedback({
        category: feedbackCategory,
        subject: feedbackSubject,
        message: feedbackMessage,
        pageContext,
      });
      setSuccessId(id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit feedback.'
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
      aria-labelledby="ata-legal-feedback-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
          <div>
            <h2
              id="ata-legal-feedback-modal-title"
              className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
            >
              Copyright Takedowns & Platform Feedback
            </h2>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Submit formal rights complaints or report bugs & accessibility issues
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'copyright'}
            onClick={() => {
              setActiveTab('copyright');
              setError(null);
              setSuccessId(null);
            }}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors ${
              activeTab === 'copyright'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
            }`}
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Copyright Complaint</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'feedback'}
            onClick={() => {
              setActiveTab('feedback');
              setError(null);
              setSuccessId(null);
            }}
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors ${
              activeTab === 'feedback'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]'
            }`}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Platform Feedback</span>
          </button>
        </div>

        {!isSignedIn ? (
          <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-5 space-y-3 text-center">
            <p className="text-xs sm:text-sm text-[#090B14] dark:text-white font-semibold">
              Sign in required to submit verified requests
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
              To prevent automated abuse and link status updates to your account,
              copyright takedown notices and platform feedback require an ATA account.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireAuth();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Sign In / Register</span>
            </button>
          </div>
        ) : successId ? (
          <div className="space-y-4">
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/50 p-4 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold">Submission Recorded (Ref: {successId})</p>
                <p className="mt-1 opacity-90 leading-relaxed">
                  {activeTab === 'copyright'
                    ? 'Your copyright/takedown notice has been logged for review by ATA administrators.'
                    : 'Thank you for helping improve All Things Anime! Our team will review your feedback.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335]"
              >
                Close
              </button>
            </div>
          </div>
        ) : activeTab === 'copyright' ? (
          <form onSubmit={handleSubmitCopyright} className="space-y-3.5">
            {!isVerified && (
              <div
                role="alert"
                className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 text-xs text-amber-900 dark:text-amber-200"
              >
                Please verify your email address in Profile before submitting a formal copyright complaint.
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
              >
                <AlertCircle className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ata-copy-name"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Full Legal / Claimant Name *
                </label>
                <input
                  id="ata-copy-name"
                  type="text"
                  required
                  value={claimantName}
                  onChange={(e) => setClaimantName(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="ata-copy-email"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Contact Email *
                </label>
                <input
                  id="ata-copy-email"
                  type="email"
                  required
                  value={claimantEmail}
                  onChange={(e) => setClaimantEmail(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ata-copy-org"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Rights Holder / Studio (Optional)
                </label>
                <input
                  id="ata-copy-org"
                  type="text"
                  value={rightsHolderOrg}
                  onChange={(e) => setRightsHolderOrg(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="ata-copy-work"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Copyrighted Work Title *
                </label>
                <input
                  id="ata-copy-work"
                  type="text"
                  required
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="ata-copy-target-type"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Content Type *
                </label>
                <select
                  id="ata-copy-target-type"
                  value={targetType}
                  onChange={(e) =>
                    setTargetType(e.target.value as CopyrightComplaint['targetType'])
                  }
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white"
                >
                  <option value="post">Post</option>
                  <option value="comment">Comment</option>
                  <option value="community">Community</option>
                  <option value="collection">Collection</option>
                  <option value="news">News Article</option>
                  <option value="streaming_link">Where to Watch Link</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="ata-copy-target-ref"
                  className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
                >
                  Target URL, ID, or Reference *
                </label>
                <input
                  id="ata-copy-target-ref"
                  type="text"
                  required
                  value={targetReference}
                  onChange={(e) => setTargetReference(e.target.value)}
                  placeholder="Post ID, page route, or item title"
                  className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="ata-copy-desc"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Detailed Description of Claimed Infringement *
              </label>
              <textarea
                id="ata-copy-desc"
                rows={3}
                required
                minLength={10}
                maxLength={1500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the copyrighted material and where it appears..."
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs sm:text-sm text-[#090B14] dark:text-white"
              />
            </div>

            <div className="space-y-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={goodFaithConfirmed}
                  onChange={(e) => setGoodFaithConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#EF3038]"
                />
                <span className="text-[#090B14] dark:text-[#D4D7E2]">
                  I have a good-faith belief that the disputed use is not authorised by the copyright owner, its agent, or the law.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accuracyConfirmed}
                  onChange={(e) => setAccuracyConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#EF3038]"
                />
                <span className="text-[#090B14] dark:text-[#D4D7E2]">
                  I confirm the information in this notice is accurate and that I am the rights holder or authorised to act on their behalf.
                </span>
              </label>
            </div>

            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Notice: Complaint records are accessible only to you and authorised ATA compliance administrators for takedown resolution.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isVerified}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Copyright Notice'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitFeedback} className="space-y-3.5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
              >
                <AlertCircle className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="ata-fb-category"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Feedback Category *
              </label>
              <select
                id="ata-fb-category"
                value={feedbackCategory}
                onChange={(e) =>
                  setFeedbackCategory(e.target.value as UserFeedbackRecord['category'])
                }
                className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
              >
                <option value="accessibility">Accessibility Issue (WCAG / Screen Reader / Contrast)</option>
                <option value="bug">Bug / Technical Issue</option>
                <option value="streaming">Where to Watch Directory Feedback</option>
                <option value="safety">Safety / Moderation Suggestion</option>
                <option value="feature_request">Feature Request</option>
                <option value="general">General Feedback</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ata-fb-subject"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Subject *
              </label>
              <input
                id="ata-fb-subject"
                type="text"
                required
                minLength={3}
                maxLength={140}
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                placeholder="Short summary of your feedback or issue"
                className="w-full min-h-[44px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs sm:text-sm text-[#090B14] dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="ata-fb-message"
                className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1"
              >
                Details *
              </label>
              <textarea
                id="ata-fb-message"
                rows={4}
                required
                minLength={10}
                maxLength={1500}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Describe steps to reproduce, device/browser notes, or suggestions..."
                className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 text-xs sm:text-sm text-[#090B14] dark:text-white"
              />
            </div>

            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Context included: <span className="font-mono">{pageContext}</span>.
              Feedback is reviewed only by authorised ATA administrators.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] disabled:opacity-60"
              >
                {isSubmitting ? 'Sending...' : 'Send Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
