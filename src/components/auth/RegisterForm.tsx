import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import {
  checkUsernameAvailability,
  mapAuthErrorToMessage,
  registerAtaAccount,
} from '../../services/authService';
import {
  validateRegistrationForm,
  validateUsername,
} from '../../services/validation';
import type {
  AuthViewMode,
  RegisterAccountInput,
  ValidationErrors,
} from '../../types';

interface RegisterFormProps {
  onSwitchMode: (mode: AuthViewMode) => void;
  onRegistrationSuccess?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSwitchMode,
  onRegistrationSuccess,
}) => {
  const [form, setForm] = useState<RegisterAccountInput>({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    ValidationErrors<RegisterAccountInput>
  >({});
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameBlur = async () => {
    const formatErr = validateUsername(form.username);
    if (formatErr) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const available = await checkUsernameAvailability(form.username);
      setUsernameStatus(available ? 'available' : 'taken');
      if (!available) {
        setFieldErrors((prev) => ({
          ...prev,
          username: 'This username is already taken. Please choose another.',
        }));
      }
    } catch {
      setUsernameStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    const errors = validateRegistrationForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await registerAtaAccount(form);
      onRegistrationSuccess?.();
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

      {/* Email */}
      <div>
        <label
          htmlFor="ata-register-email"
          className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
        >
          Email Address
        </label>
        <input
          id="ata-register-email"
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

      {/* Username & Display Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="ata-register-username"
            className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
          >
            Username
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#52576B] dark:text-[#A7A9B8]"
              aria-hidden="true"
            >
              @
            </span>
            <input
              id="ata-register-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, username: e.target.value }));
                setUsernameStatus('idle');
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              onBlur={handleUsernameBlur}
              placeholder="cosmic_fan"
              aria-invalid={Boolean(fieldErrors.username)}
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] pl-8 pr-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
            />
          </div>
          {fieldErrors.username ? (
            <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
              {fieldErrors.username}
            </p>
          ) : usernameStatus === 'checking' ? (
            <p className="mt-1.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Checking handle availability...
            </p>
          ) : usernameStatus === 'available' ? (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Handle is available</span>
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              3–20 chars · letters, numbers, underscores
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="ata-register-display-name"
            className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
          >
            Display Name
          </label>
          <input
            id="ata-register-display-name"
            type="text"
            autoComplete="name"
            value={form.displayName}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, displayName: e.target.value }));
              if (fieldErrors.displayName) {
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }
            }}
            placeholder="Your public name"
            aria-invalid={Boolean(fieldErrors.displayName)}
            className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
          />
          {fieldErrors.displayName ? (
            <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
              {fieldErrors.displayName}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              2–40 characters shown on your profile
            </p>
          )}
        </div>
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="ata-register-password"
          className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="ata-register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, password: e.target.value }));
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="Minimum 8 characters"
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
        {fieldErrors.password ? (
          <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
            {fieldErrors.password}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
            Use at least 8 characters with uppercase, lowercase, and a number.
          </p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label
          htmlFor="ata-register-confirm-password"
          className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
        >
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="ata-register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                confirmPassword: e.target.value,
              }));
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({
                  ...prev,
                  confirmPassword: undefined,
                }));
              }
            }}
            placeholder="Re-enter your password"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] pl-3.5 pr-12 py-2.5 min-h-[44px] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:border-[#EF3038] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={
              showConfirmPassword
                ? 'Hide confirm password'
                : 'Show confirm password'
            }
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {fieldErrors.confirmPassword && (
          <p className="mt-1.5 text-xs text-[#B92335] dark:text-[#EF3038]">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        <span>
          {isSubmitting ? 'Creating ATA Account...' : 'Create ATA Account'}
        </span>
      </button>

      <p className="text-center text-xs text-[#52576B] dark:text-[#A7A9B8] pt-1">
        Already have an ATA account?{' '}
        <button
          type="button"
          onClick={() => onSwitchMode('login')}
          className="font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
        >
          Sign in instead
        </button>
      </p>
    </form>
  );
};
