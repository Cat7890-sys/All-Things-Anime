import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AuthViewMode } from '../types';
import { AtaLogo } from '../components/AtaLogo';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

interface AuthPageProps {
  initialMode?: AuthViewMode;
  onAuthComplete?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onAuthComplete,
}) => {
  const [mode, setMode] = useState<AuthViewMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const headingTitle =
    mode === 'register'
      ? 'Create Your Independent ATA Account'
      : mode === 'reset'
      ? 'Reset Your Password'
      : 'Sign In to All Things Anime';

  const headingSubtitle =
    mode === 'register'
      ? 'Claim your unique @username and join the ATA universe directly—no external anime service required.'
      : mode === 'reset'
      ? 'Recover access to your independent ATA member account.'
      : 'Access your ATA profile, verification status, and personal preferences.';

  return (
    <section
      aria-labelledby="ata-auth-heading"
      className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
    >
      {/* Cosmic Header */}
      <div className="relative bg-[#090B14] text-white p-6 sm:p-8 border-b border-[#303342] overflow-hidden">
        <svg
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 opacity-25"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="82" stroke="#303342" strokeWidth="1.5" />
          <ellipse
            cx="100"
            cy="100"
            rx="88"
            ry="38"
            transform="rotate(-24 100 100)"
            stroke="#EF3038"
            strokeWidth="2.5"
          />
        </svg>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              ATA Member Portal <span aria-hidden="true">·</span> Independent
              Accounts
            </p>
            <h1
              id="ata-auth-heading"
              className="mt-1.5 font-display-space font-bold text-2xl sm:text-3xl text-white [text-wrap:balance]"
            >
              {headingTitle}
            </h1>
            <p className="mt-1.5 text-sm text-[#A7A9B8] max-w-xl">
              {headingSubtitle}
            </p>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            <AtaLogo variant="compact" surface="dark" />
          </div>
        </div>
      </div>

      {/* Auth Mode Switcher & Form Body */}
      <div className="p-6 sm:p-8 space-y-6">
        {mode !== 'reset' && (
          <div
            className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]"
            role="tablist"
            aria-label="Account authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
              className={`py-2 px-3 min-h-[40px] text-xs sm:text-sm font-semibold rounded-lg transition-colors duration-150 ${
                mode === 'login'
                  ? 'bg-[#EF3038] text-white'
                  : 'text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              className={`py-2 px-3 min-h-[40px] text-xs sm:text-sm font-semibold rounded-lg transition-colors duration-150 ${
                mode === 'register'
                  ? 'bg-[#EF3038] text-white'
                  : 'text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {mode === 'login' && (
          <LoginForm
            onSwitchMode={setMode}
            onLoginSuccess={onAuthComplete}
          />
        )}
        {mode === 'register' && (
          <RegisterForm
            onSwitchMode={setMode}
            onRegistrationSuccess={onAuthComplete}
          />
        )}
        {mode === 'reset' && <ForgotPasswordForm onSwitchMode={setMode} />}

        <div className="flex items-start gap-2.5 border-t border-[#D4D7E2] dark:border-[#303342] pt-4 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
          <ShieldCheck
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="leading-relaxed">
            Credentials are managed securely by Firebase Authentication. ATA
            never stores plaintext passwords and never exposes your email
            address on public profiles.
          </p>
        </div>
      </div>
    </section>
  );
};
