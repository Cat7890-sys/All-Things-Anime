import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { requestPasswordResetNeutral } from '../../services/authService';
import { validateEmail } from '../../services/validation';
import type { AuthViewMode } from '../../types';

interface ForgotPasswordFormProps {
  onSwitchMode: (mode: AuthViewMode) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSwitchMode,
}) => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedNeutral, setSubmittedNeutral] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const err = validateEmail(email);
    setEmailError(err);
    if (err) return;

    setIsSubmitting(true);
    try {
      await requestPasswordResetNeutral(email);
      setSubmittedNeutral(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to send reset request right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {submittedNeutral ? (
        <div
          role="status"
          className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-2.5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[#090B14] dark:text-white">
            <CheckCircle2
              className="h-4 w-4 text-[#EF3038] shrink-0"
              aria-hidden="true"
            />
            <span>Password Reset Request Processed</span>
          </div>
          <p className="text-xs leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
            If an ATA account is registered with that email address, a password
            reset link has been sent. Please check your inbox and spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-xs leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
            Enter the email address associated with your ATA account and we will
            send instructions to reset your password.
          </p>

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3.5 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed">{submitError}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="ata-reset-email"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Email Address
            </label>
            <input
              id="ata-reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="you@example.com"
              aria-invalid={Boolean(emailError)}
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
            />
            {emailError && (
              <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>
              {isSubmitting ? 'Sending Reset Link...' : 'Send Reset Link'}
            </span>
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => onSwitchMode('login')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back to Sign In</span>
      </button>
    </div>
  );
};
