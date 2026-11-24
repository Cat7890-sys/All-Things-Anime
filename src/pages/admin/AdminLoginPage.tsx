import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../../components/AtaLoadingSpinner';
import { AtaLogo } from '../../components/AtaLogo';
import { useAuth } from '../../hooks/useAuth';
import {
  recordAdminLoginSecurityEvent,
  verifyAdminSession,
} from '../../services/admin/adminService';
import {
  loginAtaAccount,
  logoutAtaAccount,
  mapAuthErrorToMessage,
} from '../../services/authService';
import { firebaseProjectMeta } from '../../services/firebase';
import type { AdminAccountRecord } from '../../types';

interface AdminLoginPageProps {
  initialDenialReason?: string | null;
  onAdminAuthenticated: (
    admin: AdminAccountRecord,
    cloudFunctionsAvailable: boolean
  ) => void;
  onReturnToApp: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  initialDenialReason = null,
  onAdminAuthenticated,
  onReturnToApp,
}) => {
  const { firebaseUser, isLoadingAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialDenialReason
  );
  const [showProvisionChecklist, setShowProvisionChecklist] = useState(false);

  useEffect(() => {
    setErrorMessage(initialDenialReason);
  }, [initialDenialReason]);

  useEffect(() => {
    let active = true;
    if (isLoadingAuth || !firebaseUser) return;

    setIsVerifying(true);
    void verifyAdminSession()
      .then((res) => {
        if (!active) return;
        if (res.admin) {
          onAdminAuthenticated(res.admin, res.cloudFunctionsAvailable);
        } else {
          setErrorMessage(
            res.denialReason ||
              'Signed-in account does not hold an active ATA administrator seat.'
          );
        }
      })
      .finally(() => {
        if (active) setIsVerifying(false);
      });

    return () => {
      active = false;
    };
  }, [firebaseUser, isLoadingAuth, onAdminAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setErrorMessage(null);
    setIsVerifying(true);
    try {
      await loginAtaAccount({
        email: email.trim(),
        password,
        rememberSession: false,
      });
      const res = await verifyAdminSession();
      if (res.admin) {
        onAdminAuthenticated(res.admin, res.cloudFunctionsAvailable);
      } else {
        await recordAdminLoginSecurityEvent({
          outcome: 'login_failed',
          email: email.trim(),
          reason: res.denialReason || 'Account is not an active administrator.',
        });
        setErrorMessage(
          res.denialReason ||
            'Access denied: this account does not hold an active ATA administrator seat.'
        );
      }
    } catch (err) {
      const msg = mapAuthErrorToMessage(err);
      await recordAdminLoginSecurityEvent({
        outcome: 'login_failed',
        email: email.trim(),
        reason: msg,
      });
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await recordAdminLoginSecurityEvent({
      outcome: 'logout',
      email: firebaseUser?.email || '',
      reason: 'Signed out from restricted admin portal.',
    });
    await logoutAtaAccount();
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#090B14] text-white flex flex-col justify-center px-4 py-8 cosmic-backdrop-grid">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReturnToApp}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#D4D7E2] bg-[#171923] border border-[#303342] hover:border-[#EF3038] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <span>Return to All Things Anime</span>
          </button>

          <AtaLogo variant="compact" surface="dark" />
        </div>

        <section
          aria-labelledby="ata-admin-portal-heading"
          className="rounded-2xl bg-[#171923] border border-[#303342] shadow-2xl overflow-hidden"
        >
          <header className="px-6 py-6 bg-[#090B14]/80 border-b border-[#303342] space-y-2">
            <div className="inline-flex items-center gap-2 text-[#EF3038]">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] uppercase">
                Restricted Administrator Portal
              </span>
            </div>
            <h1
              id="ata-admin-portal-heading"
              className="font-display-space font-bold text-2xl text-white"
            >
              ATA Governance &amp; Moderation Sign-In
            </h1>
            <p className="text-xs sm:text-sm text-[#A7A9B8] leading-relaxed">
              Access is strictly capped at 3 server-verified administrator seats
              (Owner, Platform Admin, Content Admin). Unauthorised access attempts are logged.
            </p>
          </header>

          <div className="p-6 space-y-5">
            {isLoadingAuth || isVerifying ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <AtaLoadingSpinner size="lg" label="Verifying administrator credentials" />
                <p className="text-xs sm:text-sm text-[#A7A9B8]">
                  Verifying administrator seat and Firebase custom claims...
                </p>
              </div>
            ) : firebaseUser ? (
              <div className="space-y-4">
                <div
                  role="alert"
                  className="rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-4 flex items-start gap-3 text-xs sm:text-sm"
                >
                  <ShieldAlert
                    className="h-5 w-5 text-[#EF3038] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="font-bold text-white">Access Denied</p>
                    <p className="text-[#D4D7E2] leading-relaxed">
                      {errorMessage ||
                        'This Firebase account does not hold an active ATA administrator seat.'}
                    </p>
                    <p className="text-[11px] text-[#A7A9B8] pt-1 font-mono">
                      Signed-in UID: {firebaseUser.uid}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sign Out &amp; Switch Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={onReturnToApp}
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-[#D4D7E2] bg-[#090B14] border border-[#303342] hover:border-[#EF3038] transition-colors"
                  >
                    <span>Return to Public Site</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3.5 text-xs text-white"
                  >
                    <AlertCircle
                      className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="ata-admin-email"
                    className="block text-xs font-semibold text-white mb-1.5"
                  >
                    Administrator Email
                  </label>
                  <input
                    id="ata-admin-email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter authorised administrator email"
                    className="w-full rounded-xl bg-[#090B14] border border-[#303342] px-3.5 py-2.5 min-h-[44px] text-sm text-white placeholder:text-[#A7A9B8]/60 focus:border-[#EF3038] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ata-admin-password"
                    className="block text-xs font-semibold text-white mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="ata-admin-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full rounded-xl bg-[#090B14] border border-[#303342] pl-3.5 pr-12 py-2.5 min-h-[44px] text-sm text-white placeholder:text-[#A7A9B8]/60 focus:border-[#EF3038] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg text-[#A7A9B8] hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || !password || isVerifying}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] disabled:opacity-50 transition-colors"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Verify &amp; Enter Admin Console</span>
                </button>
              </form>
            )}

            <div className="border-t border-[#303342] pt-4 space-y-3">
              <button
                type="button"
                onClick={() => setShowProvisionChecklist((prev) => !prev)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#A7A9B8] hover:text-white transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                <span>
                  {showProvisionChecklist
                    ? 'Hide Owner Provisioning Checklist'
                    : 'Owner First-Time Provisioning Checklist'}
                </span>
              </button>

              {showProvisionChecklist && (
                <div className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-2 text-[11px] text-[#D4D7E2] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    <span>Zero-Credential Server Provisioning Steps</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>
                      Create or verify the Owner&apos;s personal email account in Firebase Authentication (Project{' '}
                      <code className="font-mono text-white">{firebaseProjectMeta.projectId}</code>) and copy its UID.
                    </li>
                    <li>
                      In Cloud Firestore named database{' '}
                      <code className="font-mono text-white">{firebaseProjectMeta.firestoreDatabaseId}</code>{' '}
                      (never <code className="font-mono">(default)</code>), create{' '}
                      <code className="font-mono text-white">admins/{'{uid}'}</code> and{' '}
                      <code className="font-mono text-white">adminSeats/owner</code> with{' '}
                      <code className="font-mono">role: &quot;owner&quot;</code>,{' '}
                      <code className="font-mono">seatId: &quot;owner&quot;</code>,{' '}
                      <code className="font-mono">status: &quot;active&quot;</code>.
                    </li>
                    <li>
                      Deploy <code className="font-mono text-white">firestore.rules</code>,{' '}
                      <code className="font-mono text-white">storage.rules</code>,{' '}
                      <code className="font-mono text-white">firestore.indexes.json</code>, and Cloud Functions (<code className="font-mono">/ADMIN_PROVISIONING.md</code>).
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
