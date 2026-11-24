import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import {
  loginAtaAccount,
  mapAuthErrorToMessage,
} from '../../services/authService';
import { validateLoginForm } from '../../services/validation';
import { buildAppHref } from '../../services/routingService';
import type {
  AuthViewMode,
  LegalPageSlug,
  LoginAccountInput,
  ValidationErrors,
} from '../../types';

interface LoginFormProps {
  onSwitchMode: (mode: AuthViewMode) => void;
  onLoginSuccess?: () => void;
  onNavigateLegal?: (slug: LegalPageSlug) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchMode,
  onLoginSuccess,
  onNavigateLegal,
}) => {
  const [form, setForm] = useState<LoginAccountInput>({
    email: '',
    password: '',
    rememberSession: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    ValidationErrors<LoginAccountInput>
  >({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openLegal = (slug: LegalPageSlug) => {
    if (onNavigateLegal) {
      onNavigateLegal(slug);
      return;
    }
    const href = buildAppHref({ kind: 'legal', slug }, import.meta.env.BASE_URL);
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const errors = validateLoginForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await loginAtaAccount(form);
      onLoginSuccess?.();
    } catch (error) {
      setSubmitError(mapAuthErrorToMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          htmlFor="ata-login-email"
          className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
        >
          Email Address
        </label>
        <input
          id="ata-login-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, email: e.target.value }));
            if (fieldErrors.email) {
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }
          }}
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
        />
        {fieldErrors.email && (
          <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="ata-login-password"
            className="block text-xs font-semibold text-[#090B14] dark:text-white"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => onSwitchMode('reset')}
            className="text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="ata-login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }));
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="Enter your password"
            aria-invalid={Boolean(fieldErrors.password)}
            className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] pl-3.5 pr-12 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
        <input
          type="checkbox"
          checked={form.rememberSession}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, rememberSession: e.target.checked }))
          }
          className="h-4 w-4 rounded border-[#D4D7E2] dark:border-[#303342] accent-[#EF3038]"
        />
        <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
          Keep my ATA session signed in on this device
        </span>
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        <span>{isSubmitting ? 'Signing In...' : 'Sign In to ATA'}</span>
      </button>

      <p className="text-center text-xs text-[#52576B] dark:text-[#A7A9B8] pt-1">
        New to All Things Anime?{' '}
        <button
          type="button"
          onClick={() => onSwitchMode('register')}
          className="font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
        >
          Create an independent ATA account
        </button>
      </p>

      <p className="text-center text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
        Signing in is governed by our{' '}
        <button
          type="button"
          onClick={() => openLegal('privacy-policy')}
          className="font-semibold text-[#090B14] dark:text-white hover:text-[#EF3038] underline underline-offset-2"
        >
          Privacy Policy
        </button>{' '}
        and{' '}
        <button
          type="button"
          onClick={() => openLegal('terms')}
          className="font-semibold text-[#090B14] dark:text-white hover:text-[#EF3038] underline underline-offset-2"
        >
          Terms &amp; Conditions
        </button>
        .
      </p>
    </form>
  );
};
