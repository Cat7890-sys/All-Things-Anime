import {
  Bell,
  Bookmark,
  Calendar,
  Compass,
  Footprints,
  Home,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Newspaper,
  Sliders,
  Sun,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { ATA_BRAND, NAV_DESTINATIONS } from '../assets/sampleData';
import { AtaLogo } from '../components/AtaLogo';
import { UserAvatar } from '../components/UserAvatar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import {
  PWAInstallBanner,
  PWAInstallButton,
} from '../components/pwa/PWAInstallExperience';
import { PWASystemBanners } from '../components/pwa/PWASystemBanners';
import { NotificationBell } from '../components/notifications/NotificationBell';
import type { NotificationRouteTarget } from '../services/notifications/notificationRoutingService';
import type { AuthViewMode, NavDestinationId } from '../types';

interface AppShellProps {
  activeDestination: NavDestinationId;
  onSelectDestination: (id: NavDestinationId) => void;
  onSelectRouteTarget?: (routeInfo: NotificationRouteTarget) => void;
  onOpenAuth: (mode: AuthViewMode) => void;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  rightSidebar: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ICONS: Record<
  NavDestinationId,
  React.ComponentType<{ className?: string }>
> = {
  home: Home,
  'my-anime': LayoutDashboard,
  'anime-tracker': Bookmark,
  collections: Layers,
  discover: Compass,
  calendar: Calendar,
  news: Newspaper,
  journey: Footprints,
  communities: Users,
  messages: Mail,
  notifications: Bell,
  personalisation: Sliders,
  profile: User,
};

const MOBILE_BOTTOM_IDS: NavDestinationId[] = [
  'home',
  'discover',
  'communities',
  'messages',
];

export const AppShell: React.FC<AppShellProps> = ({
  activeDestination,
  onSelectDestination,
  onSelectRouteTarget,
  onOpenAuth,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  rightSidebar,
  children,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { firebaseUser, profile, isLoadingAuth, logout } = useAuth();
  const isDark = theme === 'dark';

  const accountDisplayName =
    profile?.displayName || firebaseUser?.displayName || 'ATA Member';
  const accountUsername = profile?.username;

  return (
    <div className="min-h-screen bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white flex flex-col transition-colors duration-200">
      {/* Accessible Skip Link */}
      <a
        href="#ata-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-[#EF3038] focus:text-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Mobile Compact Top Header (< lg) — 56px tall + safe-area top */}
      <header className="lg:hidden sticky top-0 z-30 min-h-14 pt-[env(safe-area-inset-top)] bg-white/95 dark:bg-[#171923]/95 backdrop-blur-md border-b border-[#D4D7E2] dark:border-[#303342] px-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectDestination('home')}
          aria-label="ATA — ALL THINGS ANIME Home"
          className="inline-flex items-center min-h-[44px]"
        >
          <AtaLogo variant="compact" />
        </button>

        {/* Secondary top-bar actions + Install trigger + Theme toggle */}
        <div className="flex items-center gap-1">
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-transparent text-[#090B14] dark:text-[#A7A9B8] hover:border-[#D4D7E2] dark:hover:border-[#303342] hover:text-[#090B14] dark:hover:text-white transition-colors duration-150"
          >
            {isDark ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <NotificationBell
            currentUserId={firebaseUser?.uid}
            onNavigateDestination={onSelectDestination}
            onSelectRouteTarget={onSelectRouteTarget}
          />

          <button
            type="button"
            onClick={() => onSelectDestination('profile')}
            aria-label={firebaseUser ? `Profile (${accountDisplayName})` : 'Sign in or Profile'}
            aria-current={activeDestination === 'profile' ? 'page' : undefined}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border transition-colors duration-150 ${
              activeDestination === 'profile'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-transparent text-[#090B14] dark:text-[#A7A9B8] border-transparent hover:border-[#D4D7E2] dark:hover:border-[#303342] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            {firebaseUser ? (
              <UserAvatar
                displayName={accountDisplayName}
                avatarUrl={profile?.avatarUrl}
                size="sm"
                className="h-7 w-7 text-[10px]"
              />
            ) : (
              <User className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Main Responsive 3-Column Container */}
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 lg:px-8 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_320px] gap-6 xl:gap-8 items-start">
          {/* Desktop Left Sidebar */}
          <aside
            aria-label="Primary navigation"
            className="hidden lg:flex flex-col justify-between sticky top-6"
          >
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-5">
              {/* Brand Zone */}
              <div className="border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
                <button
                  type="button"
                  onClick={() => onSelectDestination('home')}
                  className="text-left w-full"
                >
                  <AtaLogo variant="primary" showFullTitle />
                </button>
                <p className="mt-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8] leading-snug">
                  {ATA_BRAND.tagline}
                </p>
              </div>

              {/* 6 Primary Destinations */}
              <nav aria-label="ATA Sections" className="space-y-1.5">
                {NAV_DESTINATIONS.map((item) => {
                  const Icon = NAV_ICONS[item.id];
                  const isActive = activeDestination === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectDestination(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px] text-sm font-semibold rounded-xl border transition-colors duration-150 text-left ${
                        isActive
                          ? 'bg-[#EF3038] text-white border-[#B92335]'
                          : 'bg-transparent text-[#090B14] dark:text-[#A7A9B8] border-transparent hover:bg-[#F4F5F8] dark:hover:bg-[#090B14] hover:border-[#D4D7E2] dark:hover:border-[#303342] hover:text-[#090B14] dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? 'text-white'
                              : 'text-[#52576B] dark:text-[#A7A9B8]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="truncate whitespace-nowrap">
                          {item.label}
                        </span>
                      </span>

                      {item.id === 'messages' && unreadMessagesCount > 0 ? (
                        <span
                          aria-label={`${unreadMessagesCount} unread messages`}
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-white text-[#B92335]'
                              : 'bg-[#EF3038] text-white'
                          }`}
                        >
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      ) : item.id === 'notifications' &&
                        unreadNotificationsCount > 0 ? (
                        <span
                          aria-label={`${unreadNotificationsCount} unread notifications`}
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-white text-[#B92335]'
                              : 'bg-[#EF3038] text-white'
                          }`}
                        >
                          {unreadNotificationsCount > 99
                            ? '99+'
                            : unreadNotificationsCount}
                        </span>
                      ) : (
                        !item.isImplemented && (
                          <span
                            className={`text-[10px] font-medium shrink-0 ${
                              isActive
                                ? 'text-white/85'
                                : 'text-[#52576B] dark:text-[#A7A9B8]/75'
                            }`}
                          >
                            Soon
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Account Status Card */}
              <div className="border-t border-[#D4D7E2] dark:border-[#303342] pt-4 space-y-3">
                {isLoadingAuth ? (
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    Checking account session...
                  </p>
                ) : firebaseUser ? (
                  <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectDestination('profile')}
                      className="w-full flex items-center gap-2.5 text-left"
                    >
                      <UserAvatar
                        displayName={accountDisplayName}
                        avatarUrl={profile?.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                          {accountDisplayName}
                        </p>
                        <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                          {accountUsername ? `@${accountUsername}` : 'ATA Member'}
                        </p>
                      </div>
                    </button>

                    {!firebaseUser.emailVerified && (
                      <p className="text-[11px] font-medium text-[#B92335] dark:text-[#EF3038]">
                        Email verification pending
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-[#A7A9B8] bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('register')}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                      <span>Create Account</span>
                    </button>
                  </div>
                )}

                {/* Install App Trigger (shown when installable or iOS Safari) */}
                <PWAInstallButton />

                {/* Theme Switcher */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    {isDark ? (
                      <Moon
                        className="h-3.5 w-3.5 text-[#EF3038]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Sun
                        className="h-3.5 w-3.5 text-[#EF3038]"
                        aria-hidden="true"
                      />
                    )}
                    <span>{isDark ? 'Dark Theme' : 'Light Theme'}</span>
                  </span>
                  <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
                    Switch
                  </span>
                </button>

                <p className="text-[11px] leading-relaxed text-[#52576B] dark:text-[#A7A9B8]">
                  <span className="font-semibold text-[#090B14] dark:text-white">
                    {ATA_BRAND.foundationLabel}
                  </span>
                </p>
              </div>
            </div>
          </aside>

          {/* Center Main Content Column */}
          <main id="ata-main-content" className="min-w-0 space-y-6">
            <PWASystemBanners />
            <PWAInstallBanner />
            {children}

            <div className="xl:hidden pt-2">{rightSidebar}</div>
          </main>

          {/* Desktop Right Sidebar (>= xl) */}
          <aside
            aria-label="Trending and community highlights"
            className="hidden xl:block sticky top-6"
          >
            {rightSidebar}
          </aside>
        </div>
      </div>

      {/* Mobile Compact Bottom Navigation (< lg) — 56px tall + safe-area bottom */}
      <nav
        aria-label="Mobile primary navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#171923]/95 backdrop-blur-md border-t border-[#D4D7E2] dark:border-[#303342] pb-[env(safe-area-inset-bottom)] px-1"
      >
        <div className="grid grid-cols-4 h-14">
          {MOBILE_BOTTOM_IDS.map((id) => {
            const dest = NAV_DESTINATIONS.find((item) => item.id === id);
            if (!dest) return null;
            const Icon = NAV_ICONS[id];
            const isActive = activeDestination === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectDestination(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors duration-150 ${
                  isActive
                    ? 'text-[#B92335] dark:text-[#EF3038] font-semibold'
                    : 'text-[#52576B] dark:text-[#A7A9B8] font-medium hover:text-[#090B14] dark:hover:text-white'
                }`}
              >
                <span className="relative inline-flex items-center justify-center">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {id === 'messages' && unreadMessagesCount > 0 && (
                    <span
                      aria-label={`${unreadMessagesCount} unread messages`}
                      className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#EF3038] text-white text-[9px] font-bold tabular-nums leading-none"
                    >
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-none whitespace-nowrap">
                  {dest.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
