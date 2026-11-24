import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileWarning,
  Flag,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Newspaper,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../../components/AtaLoadingSpinner';
import { AtaLogo } from '../../components/AtaLogo';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_SEAT_METADATA,
  hasAdminPermission,
  hasAnyAdminPermission,
  sanitizeAdminPermissions,
} from '../../services/admin/adminRbac';
import {
  checkSystemHealthDiagnostics,
  deleteAdminNewsArticle,
  deleteAdminStreamingAvailability,
  deleteAdminStreamingProvider,
  deleteCatalogueOverride,
  fetchAdminChallengesAndParties,
  fetchAdminOverviewStats,
  listAdminAuditLogs,
  listAdminLoginEvents,
  listAdminSeatsForAdmin,
  listAdminStreamingAvailability,
  listAdminStreamingProviders,
  listAllAdminNews,
  listAllAnnouncementsForAdmin,
  listCatalogueOverridesForAdmin,
  listCollectionsForAdmin,
  listCommunitiesForAdmin,
  listCopyrightComplaintsForAdmin,
  listDeletionRequestsForAdmin,
  listModerationDecisionsForAdmin,
  listRecentPostsForAdmin,
  listReportsForAdmin,
  listSecurityIncidentsForAdmin,
  listStreamingReportsForAdmin,
  listUserFeedbackForAdmin,
  listUsersForAdmin,
  manageAdminSeatViaCallable,
  markStreamingReportReviewed,
  moderateContentViaCallableOrDirect,
  moderateEventViaAdmin,
  moderateUserViaCallable,
  publishOrUpdateAnnouncement,
  reauthenticateAdminPassword,
  recordAdminLoginSecurityEvent,
  saveAdminNewsArticle,
  saveAdminStreamingAvailability,
  saveAdminStreamingProvider,
  saveCatalogueOverride,
  saveLegalDocumentOverride,
  saveSecurityIncident,
  updateDeletionRequestDirect,
  updateUserFeedbackStatus,
  type AdminOverviewStats,
  type SystemHealthDiagnosticSnapshot,
} from '../../services/admin/adminService';
import { logoutAtaAccount } from '../../services/authService';
import {
  APPROVED_STREAMING_DOMAINS,
  COUNTRY_CATALOG,
} from '../../services/companion/streamingDirectory';
import {
  ATA_LEGAL_RISK_REGISTER,
  ATA_OPERATOR_LEGAL_CONFIG,
  LEGAL_DOCUMENTS,
} from '../../services/legal/legalConfig';
import { fetchAllLegalDocumentOverrides } from '../../services/legal/legalService';
import type {
  AccountDeletionRequest,
  AdminAccountRecord,
  AdminAuditLogEntry,
  AdminLoginEvent,
  AdminNewsArticle,
  AdminPermission,
  AdminReportRecord,
  AdminSeatId,
  AdminSeatStatus,
  AdminSeatSummary,
  AnimeChallenge,
  AnimeStreamingAvailability,
  AtaCommunity,
  AtaPost,
  AtaUserAccount,
  CatalogueOverrideRecord,
  CopyrightComplaint,
  LegalDocumentOverride,
  LegalPageSlug,
  ModerationDecisionRecord,
  NewsCategory,
  PlatformAnnouncement,
  SecurityIncidentRecord,
  StreamingAvailabilityReport,
  StreamingProvider,
  UserCollection,
  UserFeedbackRecord,
  WatchParty,
} from '../../types';

interface AdminDashboardPageProps {
  admin: AdminAccountRecord;
  cloudFunctionsAvailable: boolean;
  onReturnToApp: () => void;
  onSignedOut: () => void;
}

type AdminModuleId =
  | 'overview'
  | 'users'
  | 'moderation'
  | 'catalogue'
  | 'streaming'
  | 'announcements'
  | 'operations'
  | 'governance';

const REAUTH_WINDOW_MS = 15 * 60 * 1000;

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  admin,
  cloudFunctionsAvailable,
  onReturnToApp,
  onSignedOut,
}) => {
  const [activeModule, setActiveModule] = useState<AdminModuleId>('overview');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Reauthentication (required for bans, seat assignments/transfers, incident logs)
  const [lastReauthAtMs, setLastReauthAtMs] = useState<number>(0);
  const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthing, setIsReauthing] = useState(false);

  const isReauthFresh = Date.now() - lastReauthAtMs < REAUTH_WINDOW_MS;

  // Overview
  const [overviewStats, setOverviewStats] = useState<AdminOverviewStats | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // Module A: Users & Deletion
  const [usersList, setUsersList] = useState<AtaUserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequest[]>([]);
  const [userActionReason, setUserActionReason] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Module B: Moderation & Copyright
  const [reports, setReports] = useState<AdminReportRecord[]>([]);
  const [copyrightComplaints, setCopyrightComplaints] = useState<CopyrightComplaint[]>([]);
  const [recentPosts, setRecentPosts] = useState<
    Array<AtaPost & { moderationStatus?: string; moderationReason?: string }>
  >([]);
  const [communities, setCommunities] = useState<
    Array<AtaCommunity & { moderationStatus?: string }>
  >([]);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [adminChallenges, setAdminChallenges] = useState<AnimeChallenge[]>([]);
  const [adminWatchParties, setAdminWatchParties] = useState<WatchParty[]>([]);
  const [decisions, setDecisions] = useState<ModerationDecisionRecord[]>([]);
  const [modReasonInput, setModReasonInput] = useState('');
  const [isLoadingModeration, setIsLoadingModeration] = useState(false);

  // Module C: Catalogue Overrides & News
  const [overrides, setOverrides] = useState<CatalogueOverrideRecord[]>([]);
  const [newsList, setNewsList] = useState<AdminNewsArticle[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    animeId: '',
    animeTitle: '',
    overrideTitle: '',
    overrideSynopsis: '',
    editorialNote: '',
    isFeatured: false,
    isTrendingOverride: false,
    isSeasonalHighlight: false,
    recommendationPinned: false,
    isHiddenFromCatalogue: false,
    metadataIssueFlag: false,
  });
  const [newsForm, setNewsForm] = useState({
    id: '',
    title: '',
    source: 'ATA Editorial',
    sourceUrl: 'https://anilist.co',
    category: 'Industry' as NewsCategory,
    publishedAt: new Date().toISOString().slice(0, 10),
    summary: '',
    imageUrl: '',
    author: admin.displayLabel || 'ATA Editorial',
    status: 'published' as AdminNewsArticle['status'],
    isFeatured: false,
  });

  // Module D: Where to Watch
  const [providers, setProviders] = useState<StreamingProvider[]>([]);
  const [availabilityList, setAvailabilityList] = useState<AnimeStreamingAvailability[]>([]);
  const [streamingReports, setStreamingReports] = useState<StreamingAvailabilityReport[]>([]);
  const [isLoadingStreaming, setIsLoadingStreaming] = useState(false);
  const [providerForm, setProviderForm] = useState({
    id: '',
    name: '',
    shortLabel: '',
    accentHex: '#EF3038',
    description: '',
    supportedCountriesCsv: 'ZA, US, GB',
    officialUrl: 'https://www.youtube.com/',
    allowedDomainsCsv: 'www.youtube.com, youtube.com',
    accessModel: 'Free with Ads' as StreamingProvider['accessModel'],
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
  });
  const [availForm, setAvailForm] = useState({
    id: '',
    animeId: '',
    animeTitle: '',
    providerId: '',
    providerName: '',
    countryCode: 'ZA',
    officialUrl: 'https://www.youtube.com/',
    accessModel: 'Free with Ads' as AnimeStreamingAvailability['accessModel'],
    availabilityType: 'full_series' as AnimeStreamingAvailability['availabilityType'],
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    source: 'Official Licensor Channel Verification',
    notes: '',
  });

  // Module E: Announcements
  const [announcements, setAnnouncements] = useState<PlatformAnnouncement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(false);
  const [announceForm, setAnnounceForm] = useState({
    id: '',
    title: '',
    body: '',
    kind: 'general' as PlatformAnnouncement['kind'],
    audience: 'all_users' as PlatformAnnouncement['audience'],
    targetUidsCsv: '',
    isActive: true,
    sendInAppNotification: false,
  });

  // Module F: Operations, Feedback, Legal, Security Incidents, System Health
  const [feedbackList, setFeedbackList] = useState<UserFeedbackRecord[]>([]);
  const [legalOverrides, setLegalOverrides] = useState<
    Partial<Record<LegalPageSlug, LegalDocumentOverride>>
  >({});
  const [legalSlug, setLegalSlug] = useState<LegalPageSlug>('community-guidelines');
  const [legalForm, setLegalForm] = useState({
    title: LEGAL_DOCUMENTS['community-guidelines'].title,
    customSummary: '',
    guidelinesLines: '',
    lastUpdatedLabel: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
  });
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    severity: 'low' as SecurityIncidentRecord['severity'],
    status: 'investigating' as SecurityIncidentRecord['status'],
    summary: '',
    remediationSteps: '',
    regulatorsNotified: false,
  });
  const [healthSnapshot, setHealthSnapshot] =
    useState<SystemHealthDiagnosticSnapshot | null>(null);
  const [isLoadingOps, setIsLoadingOps] = useState(false);

  // Module G: Owner Governance & Audit Logs
  const [adminSeats, setAdminSeats] = useState<AdminSeatSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [loginEvents, setLoginEvents] = useState<AdminLoginEvent[]>([]);
  const [isLoadingGovernance, setIsLoadingGovernance] = useState(false);
  const [seatForm, setSeatForm] = useState<{
    seatId: AdminSeatId;
    targetUid: string;
    displayLabel: string;
    status: AdminSeatStatus;
    permissions: AdminPermission[];
    restrictionReason: string;
    transferOwnership: boolean;
  }>({
    seatId: 'platform_admin',
    targetUid: '',
    displayLabel: 'Platform Admin',
    status: 'active',
    permissions: [...ADMIN_SEAT_METADATA.platform_admin.defaultPermissions],
    restrictionReason: '',
    transferOwnership: false,
  });

  const notifySuccess = (message: string) =>
    setStatusBanner({ type: 'success', message });
  const notifyError = (err: unknown, fallback = 'Operation failed.') =>
    setStatusBanner({
      type: 'error',
      message: err instanceof Error ? err.message : fallback,
    });

  const loadOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const stats = await fetchAdminOverviewStats();
      setOverviewStats(stats);
    } catch (err) {
      notifyError(err, 'Unable to load platform counts.');
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const loadUsersModule = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const [usersRes, delRes] = await Promise.all([
        listUsersForAdmin(),
        listDeletionRequestsForAdmin(),
      ]);
      setUsersList(usersRes);
      setDeletionRequests(delRes);
    } catch (err) {
      notifyError(err, 'Unable to load users & deletion requests.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const loadModerationModule = useCallback(async () => {
    setIsLoadingModeration(true);
    try {
      const [repRes, copyRes, postsRes, commRes, colRes, decRes, eventsRes] =
        await Promise.all([
          listReportsForAdmin(),
          listCopyrightComplaintsForAdmin(),
          listRecentPostsForAdmin(),
          listCommunitiesForAdmin(),
          listCollectionsForAdmin(),
          listModerationDecisionsForAdmin(),
          fetchAdminChallengesAndParties().catch(() => ({
            challenges: [],
            watchParties: [],
          })),
        ]);
      setReports(repRes);
      setCopyrightComplaints(copyRes);
      setRecentPosts(postsRes);
      setCommunities(commRes);
      setCollections(colRes);
      setDecisions(decRes);
      setAdminChallenges(eventsRes.challenges);
      setAdminWatchParties(eventsRes.watchParties);
    } catch (err) {
      notifyError(err, 'Unable to load moderation queues.');
    } finally {
      setIsLoadingModeration(false);
    }
  }, []);

  const loadCatalogueModule = useCallback(async () => {
    setIsLoadingCatalogue(true);
    try {
      const [ovRes, nRes] = await Promise.all([
        listCatalogueOverridesForAdmin(),
        listAllAdminNews(),
      ]);
      setOverrides(ovRes);
      setNewsList(nRes);
    } catch (err) {
      notifyError(err, 'Unable to load catalogue & news items.');
    } finally {
      setIsLoadingCatalogue(false);
    }
  }, []);

  const loadStreamingModule = useCallback(async () => {
    setIsLoadingStreaming(true);
    try {
      const [pRes, aRes, rRes] = await Promise.all([
        listAdminStreamingProviders(),
        listAdminStreamingAvailability(),
        listStreamingReportsForAdmin(),
      ]);
      setProviders(pRes);
      setAvailabilityList(aRes);
      setStreamingReports(rRes);
    } catch (err) {
      notifyError(err, 'Unable to load Where to Watch directory data.');
    } finally {
      setIsLoadingStreaming(false);
    }
  }, []);

  const loadAnnouncementsModule = useCallback(async () => {
    setIsLoadingAnnouncements(true);
    try {
      const res = await listAllAnnouncementsForAdmin();
      setAnnouncements(res);
    } catch (err) {
      notifyError(err, 'Unable to load announcements.');
    } finally {
      setIsLoadingAnnouncements(false);
    }
  }, []);

  const loadOpsModule = useCallback(async () => {
    setIsLoadingOps(true);
    try {
      const [fbRes, legRes, incRes, diagRes, statsRes] = await Promise.all([
        listUserFeedbackForAdmin(),
        fetchAllLegalDocumentOverrides(),
        listSecurityIncidentsForAdmin(),
        checkSystemHealthDiagnostics(),
        fetchAdminOverviewStats(),
      ]);
      setFeedbackList(fbRes);
      setLegalOverrides(legRes);
      setIncidents(incRes);
      setHealthSnapshot(diagRes);
      setOverviewStats(statsRes);
    } catch (err) {
      notifyError(err, 'Unable to load operations & legal modules.');
    } finally {
      setIsLoadingOps(false);
    }
  }, []);

  const loadGovernanceModule = useCallback(async () => {
    setIsLoadingGovernance(true);
    try {
      const [seatsRes, logsRes, eventsRes] = await Promise.all([
        listAdminSeatsForAdmin(),
        listAdminAuditLogs(),
        listAdminLoginEvents(),
      ]);
      setAdminSeats(seatsRes);
      setAuditLogs(logsRes);
      setLoginEvents(eventsRes);
    } catch (err) {
      notifyError(err, 'Unable to load governance & audit records.');
    } finally {
      setIsLoadingGovernance(false);
    }
  }, []);

  useEffect(() => {
    if (activeModule === 'overview') void loadOverview();
    if (activeModule === 'users') void loadUsersModule();
    if (activeModule === 'moderation') void loadModerationModule();
    if (activeModule === 'catalogue') void loadCatalogueModule();
    if (activeModule === 'streaming') void loadStreamingModule();
    if (activeModule === 'announcements') void loadAnnouncementsModule();
    if (activeModule === 'operations') void loadOpsModule();
    if (activeModule === 'governance') void loadGovernanceModule();
  }, [
    activeModule,
    loadOverview,
    loadUsersModule,
    loadModerationModule,
    loadCatalogueModule,
    loadStreamingModule,
    loadAnnouncementsModule,
    loadOpsModule,
    loadGovernanceModule,
  ]);

  useEffect(() => {
    const existing = legalOverrides[legalSlug];
    setLegalForm({
      title: existing?.title || LEGAL_DOCUMENTS[legalSlug].title,
      customSummary: existing?.customSummary || '',
      guidelinesLines: (existing?.guidelinesList || []).join('\n'),
      lastUpdatedLabel:
        existing?.lastUpdatedLabel || ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    });
  }, [legalSlug, legalOverrides]);

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReauthing) return;
    setReauthError(null);
    setIsReauthing(true);
    try {
      await reauthenticateAdminPassword(reauthPassword);
      setLastReauthAtMs(Date.now());
      setReauthPassword('');
      setIsReauthModalOpen(false);
      notifySuccess('Administrator reauthentication verified for 15 minutes.');
    } catch (err) {
      setReauthError(
        err instanceof Error ? err.message : 'Reauthentication failed.'
      );
    } finally {
      setIsReauthing(false);
    }
  };

  const requireFreshReauth = (): boolean => {
    if (isReauthFresh) return true;
    setIsReauthModalOpen(true);
    setStatusBanner({
      type: 'error',
      message:
        'Please confirm your password via Reauthenticate before performing this high-sensitivity action.',
    });
    return false;
  };

  const handleSignOut = async () => {
    await recordAdminLoginSecurityEvent({
      outcome: 'logout',
      email: admin.email,
      reason: 'Administrator signed out from dashboard.',
    });
    await logoutAtaAccount();
    onSignedOut();
  };

  const navModules: Array<{
    id: AdminModuleId;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      Icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'users',
      label: 'Users & Deletions',
      Icon: Users,
      visible: hasAnyAdminPermission(admin, [
        'user_management',
        'account_moderation',
      ]),
    },
    {
      id: 'moderation',
      label: 'Moderation & Copyright',
      Icon: Flag,
      visible: hasAnyAdminPermission(admin, [
        'content_moderation',
        'community_management',
        'copyright_complaints',
        'user_reports',
      ]),
    },
    {
      id: 'catalogue',
      label: 'Catalogue & News',
      Icon: BookOpen,
      visible: hasAnyAdminPermission(admin, [
        'catalogue_management',
        'metadata_corrections',
        'featured_content',
        'seasonal_displays',
        'recommendations',
        'anime_news',
      ]),
    },
    {
      id: 'streaming',
      label: 'Where to Watch',
      Icon: Tv,
      visible: hasAnyAdminPermission(admin, [
        'where_to_watch',
        'country_availability',
        'streaming_verification',
      ]),
    },
    {
      id: 'announcements',
      label: 'Announcements',
      Icon: Megaphone,
      visible: hasAdminPermission(admin, 'announcements'),
    },
    {
      id: 'operations',
      label: 'Ops, Legal & Health',
      Icon: Activity,
      visible: hasAnyAdminPermission(admin, [
        'platform_statistics',
        'operational_monitoring',
        'user_feedback',
        'legal_compliance',
        'security_incidents',
        'system_health',
      ]),
    },
    {
      id: 'governance',
      label: 'Admin Seats & Logs',
      Icon: Shield,
      visible: hasAnyAdminPermission(admin, ['admin_management', 'audit_logs']),
    },
  ];

  const filteredUsers = usersList.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#090B14] text-white flex flex-col">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 bg-[#171923]/95 backdrop-blur-md border-b border-[#303342] px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-[1440px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AtaLogo variant="compact" surface="dark" />
            <div className="border-l border-[#303342] pl-3">
              <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
                ATA Admin Console · {ADMIN_SEAT_METADATA[admin.seatId].title}
              </p>
              <p className="text-xs text-[#D4D7E2]">
                {admin.displayLabel} ({admin.email || admin.uid})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReauthModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors ${
                isReauthFresh
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/50'
                  : 'bg-[#090B14] text-[#D4D7E2] border-[#303342] hover:border-[#EF3038]'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isReauthFresh ? 'Reauth Active (15m)' : 'Reauthenticate'}
              </span>
            </button>

            <button
              type="button"
              onClick={onReturnToApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#D4D7E2] bg-[#090B14] border border-[#303342] hover:border-[#EF3038] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
              <span>Public Site</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)] gap-6 items-start">
        {/* Sidebar Navigation */}
        <aside
          aria-label="Administrator dashboard modules"
          className="bg-[#171923] border border-[#303342] rounded-2xl p-3 space-y-1.5 lg:sticky lg:top-20"
        >
          {navModules
            .filter((m) => m.visible)
            .map((mod) => {
              const Icon = mod.Icon;
              const active = activeModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveModule(mod.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors text-left ${
                    active
                      ? 'bg-[#EF3038] text-white border-[#B92335]'
                      : 'bg-transparent text-[#D4D7E2] border-transparent hover:bg-[#090B14] hover:border-[#303342]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{mod.label}</span>
                </button>
              );
            })}
        </aside>

        {/* Main Admin Workspace */}
        <main className="min-w-0 space-y-6">
          {!cloudFunctionsAvailable && (
            <div
              role="note"
              className="rounded-2xl bg-amber-500/10 border border-amber-500/40 p-4 flex items-start gap-3 text-xs text-amber-200"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-white">
                  Cloud Functions Callables Not Detected Yet
                </p>
                <p className="leading-relaxed">
                  Direct Firestore-rule administration works immediately, while Firebase Auth account disabling, custom claims sync, seat transfers, and post/comment/community overrides require deploying the Cloud Functions in{' '}
                  <code className="font-mono text-white">/functions</code> (see <code className="font-mono text-white">/ADMIN_PROVISIONING.md</code>).
                </p>
              </div>
            </div>
          )}

          {statusBanner && (
            <div
              role={statusBanner.type === 'error' ? 'alert' : 'status'}
              className={`rounded-2xl border p-4 flex items-start justify-between gap-3 text-xs ${
                statusBanner.type === 'error'
                  ? 'bg-[#EF3038]/15 border-[#EF3038] text-white'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {statusBanner.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>{statusBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-[11px] font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {activeModule === 'overview' && (
            <section className="space-y-6">
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display-space font-bold text-2xl text-white">
                    Platform Operations Overview
                  </h1>
                  <p className="text-xs text-[#A7A9B8] mt-1">
                    Verified real-time Firestore collection counts — zero mock telemetry.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadOverview()}
                  disabled={isLoadingOverview}
                  className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342] hover:border-[#EF3038]"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-[#EF3038] ${isLoadingOverview ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>Refresh Counts</span>
                </button>
              </div>

              {isLoadingOverview && !overviewStats ? (
                <div className="py-12 flex justify-center">
                  <AtaLoadingSpinner size="lg" label="Loading overview counts" />
                </div>
              ) : (
                overviewStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { label: 'Users', value: overviewStats.totalUsers },
                      { label: 'Posts', value: overviewStats.totalPosts },
                      { label: 'Communities', value: overviewStats.totalCommunities },
                      { label: 'Collections', value: overviewStats.totalCollections },
                      { label: 'Anime Challenges', value: overviewStats.totalChallenges },
                      { label: 'Watch Parties', value: overviewStats.totalWatchParties },
                      { label: 'Challenge Joins', value: overviewStats.totalChallengeParticipations },
                      { label: 'Admin News', value: overviewStats.totalAdminNews },
                      { label: 'Safety Reports', value: overviewStats.totalReports },
                      { label: 'Copyright Notices', value: overviewStats.totalCopyrightComplaints },
                      { label: 'Deletion Requests', value: overviewStats.totalDeletionRequests },
                      { label: 'Streaming Reports', value: overviewStats.totalStreamingReports },
                      { label: 'User Feedback', value: overviewStats.totalFeedback },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="bg-[#171923] border border-[#303342] rounded-2xl p-4 space-y-1"
                      >
                        <p className="text-[11px] font-semibold text-[#A7A9B8] uppercase tracking-wider">
                          {stat.label}
                        </p>
                        <p className="font-display-space font-bold text-2xl text-white tabular-nums">
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              )}

              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-3">
                <h2 className="font-display-space font-bold text-base text-white">
                  Active Seat Permissions ({admin.permissions.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  {admin.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2.5 py-1 rounded-lg bg-[#090B14] border border-[#303342] text-[11px] font-mono text-[#D4D7E2]"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* MODULE A: USERS & DELETION REQUESTS */}
          {activeModule === 'users' && (
            <section className="space-y-6">
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display-space font-bold text-xl text-white">
                      Member Accounts &amp; Moderation
                    </h1>
                    <p className="text-xs text-[#A7A9B8] mt-0.5">
                      Inspect verification, toggle badges, suspend, permanently ban (requires 15m reauth), or restore accounts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadUsersModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342] hover:border-[#EF3038]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Reload</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by @username, display name, email, or UID..."
                    className="w-full min-h-[42px] rounded-xl bg-[#090B14] border border-[#303342] px-3.5 py-2 text-xs text-white focus:border-[#EF3038] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={userActionReason}
                    onChange={(e) => setUserActionReason(e.target.value)}
                    placeholder="Reason for suspend/ban/restore/deletion decision..."
                    className="w-full min-h-[42px] rounded-xl bg-[#090B14] border border-[#303342] px-3.5 py-2 text-xs text-white focus:border-[#EF3038] focus:outline-none"
                  />
                </div>

                {isLoadingUsers ? (
                  <div className="py-8 flex justify-center">
                    <AtaLoadingSpinner size="md" label="Loading member accounts" />
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                    {filteredUsers.map((u) => (
                      <div
                        key={u.uid}
                        className="rounded-xl bg-[#090B14] border border-[#303342] p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white">
                              {u.displayName || 'Unnamed'}
                            </span>
                            <span className="text-[#A7A9B8]">@{u.username}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                u.accountStatus === 'active'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : u.accountStatus === 'banned'
                                    ? 'bg-[#EF3038]/20 text-[#EF3038]'
                                    : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {u.accountStatus}
                            </span>
                            {u.isVerifiedBadge && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-bold">
                                Verified Badge
                              </span>
                            )}
                          </div>
                          <p className="text-[#A7A9B8]">
                            {u.email} · UID: <span className="font-mono">{u.uid}</span>
                          </p>
                        </div>

                        {hasAdminPermission(admin, 'account_moderation') && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateUserViaCallable({
                                    action: 'toggle_verify',
                                    targetUid: u.uid,
                                    isVerifiedBadge: !u.isVerifiedBadge,
                                  });
                                  notifySuccess(`Updated badge for @${u.username}.`);
                                  void loadUsersModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038]"
                            >
                              {u.isVerifiedBadge ? 'Remove Badge' : 'Verify Badge'}
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateUserViaCallable({
                                    action: 'suspend',
                                    targetUid: u.uid,
                                    reason:
                                      userActionReason.trim() ||
                                      'Temporarily suspended pending moderation review.',
                                  });
                                  notifySuccess(`Suspended @${u.username}.`);
                                  void loadUsersModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40"
                            >
                              Suspend
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (!requireFreshReauth()) return;
                                try {
                                  await moderateUserViaCallable({
                                    action: 'ban',
                                    targetUid: u.uid,
                                    reason:
                                      userActionReason.trim() ||
                                      'Permanently banned for severe policy violations.',
                                  });
                                  notifySuccess(`Permanently banned @${u.username}.`);
                                  void loadUsersModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-[#EF3038] text-white border border-[#B92335]"
                            >
                              Ban
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateUserViaCallable({
                                    action: 'restore',
                                    targetUid: u.uid,
                                    reason: userActionReason.trim() || 'Account restored by admin.',
                                  });
                                  notifySuccess(`Restored @${u.username}.`);
                                  void loadUsersModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                            >
                              Restore
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Account Deletion Requests Queue */}
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  <h2 className="font-display-space font-bold text-lg text-white">
                    POPIA / GDPR Account Deletion Requests ({deletionRequests.length})
                  </h2>
                </div>

                {deletionRequests.length === 0 ? (
                  <p className="text-xs text-[#A7A9B8]">No account deletion requests pending.</p>
                ) : (
                  <div className="space-y-2.5">
                    {deletionRequests.map((reqItem) => (
                      <div
                        key={reqItem.id}
                        className="rounded-xl bg-[#090B14] border border-[#303342] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-white">
                            @{reqItem.username || 'member'} ({reqItem.email}) —{' '}
                            <span className="uppercase text-[#EF3038]">{reqItem.status}</span>
                          </p>
                          <p className="text-[#A7A9B8]">
                            Reason: {reqItem.reason || 'No reason specified.'}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!requireFreshReauth()) return;
                              try {
                                await moderateUserViaCallable({
                                  action: 'complete_deletion_request',
                                  targetUid: reqItem.userId,
                                  deletionRequestId: reqItem.id,
                                  reason:
                                    userActionReason.trim() ||
                                    'Account deletion request completed by compliance admin.',
                                });
                                notifySuccess(`Completed deletion request ${reqItem.id}.`);
                                void loadUsersModule();
                              } catch {
                                try {
                                  await updateDeletionRequestDirect(
                                    admin,
                                    reqItem.id,
                                    'completed',
                                    userActionReason.trim() || 'Marked completed in Firestore.'
                                  );
                                  notifySuccess(`Marked deletion request ${reqItem.id} completed.`);
                                  void loadUsersModule();
                                } catch (err2) {
                                  notifyError(err2);
                                }
                              }
                            }}
                            className="px-3 py-1.5 min-h-[36px] rounded-lg font-semibold bg-[#EF3038] text-white"
                          >
                            Complete Deletion
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateDeletionRequestDirect(
                                  admin,
                                  reqItem.id,
                                  'declined',
                                  userActionReason.trim() || 'Declined after review.'
                                );
                                notifySuccess(`Declined deletion request ${reqItem.id}.`);
                                void loadUsersModule();
                              } catch (err) {
                                notifyError(err);
                              }
                            }}
                            className="px-3 py-1.5 min-h-[36px] rounded-lg font-semibold bg-[#171923] border border-[#303342]"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MODULE B: MODERATION & COPYRIGHT */}
          {activeModule === 'moderation' && (
            <section className="space-y-6">
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display-space font-bold text-xl text-white">
                      Content Moderation, Reports &amp; Copyright Takedowns
                    </h1>
                    <p className="text-xs text-[#A7A9B8] mt-0.5">
                      Hide or restore reported items while preserving immutable moderation evidence logs.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadModerationModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342] hover:border-[#EF3038]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Reload Queues</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={modReasonInput}
                  onChange={(e) => setModReasonInput(e.target.value)}
                  placeholder="Enter moderation reason / resolution notes before taking action..."
                  className="w-full min-h-[42px] rounded-xl bg-[#090B14] border border-[#303342] px-3.5 py-2 text-xs text-white focus:border-[#EF3038] focus:outline-none"
                />

                {isLoadingModeration ? (
                  <div className="py-8 flex justify-center">
                    <AtaLoadingSpinner size="md" label="Loading moderation queues" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Reports Queue */}
                    <div className="space-y-2.5">
                      <h2 className="font-display-space font-bold text-base text-white">
                        Safety &amp; Content Reports ({reports.length})
                      </h2>
                      {reports.map((rep) => (
                        <div
                          key={rep.id}
                          className="rounded-xl bg-[#090B14] border border-[#303342] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <p className="font-bold text-white">
                              [{rep.targetType}] Reason: {rep.reason} · Status:{' '}
                              <span className="text-[#EF3038]">{rep.status}</span>
                            </p>
                            <p className="text-[#D4D7E2]">{rep.details || 'No extra notes.'}</p>
                            <p className="text-[11px] font-mono text-[#A7A9B8]">
                              Target ID: {rep.targetId} · Author UID: {rep.targetAuthorId}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateContentViaCallableOrDirect(admin, {
                                    kind: 'report',
                                    targetId: rep.id,
                                    action: 'remove',
                                    reportStatus: 'action_taken',
                                    reason: modReasonInput.trim() || `Action taken on ${rep.reason}`,
                                    contentCollection: rep.targetType,
                                  });
                                  notifySuccess(`Marked report ${rep.id} action_taken.`);
                                  void loadModerationModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-[#EF3038] text-white"
                            >
                              Mark Action Taken
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateContentViaCallableOrDirect(admin, {
                                    kind: 'report',
                                    targetId: rep.id,
                                    action: 'dismiss',
                                    reportStatus: 'dismissed',
                                    reason: modReasonInput.trim() || 'Dismissed after review.',
                                  });
                                  notifySuccess(`Dismissed report ${rep.id}.`);
                                  void loadModerationModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-[#171923] border border-[#303342]"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Copyright Complaints */}
                    <div className="space-y-2.5">
                      <h2 className="font-display-space font-bold text-base text-white flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                        <span>Copyright &amp; Takedown Complaints ({copyrightComplaints.length})</span>
                      </h2>
                      {copyrightComplaints.map((cc) => (
                        <div
                          key={cc.id}
                          className="rounded-xl bg-[#090B14] border border-[#303342] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <p className="font-bold text-white">
                              {cc.workTitle} ({cc.targetType}) —{' '}
                              <span className="text-[#EF3038]">{cc.status}</span>
                            </p>
                            <p className="text-[#D4D7E2]">{cc.description}</p>
                            <p className="text-[11px] text-[#A7A9B8]">
                              Claimant: {cc.claimantName} ({cc.claimantEmail}) · Ref: {cc.targetReference}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateContentViaCallableOrDirect(admin, {
                                    kind: 'copyright',
                                    targetId: cc.id,
                                    action: 'remove',
                                    copyrightStatus: 'action_taken',
                                    reason: modReasonInput.trim() || 'Takedown notice actioned.',
                                  });
                                  notifySuccess(`Actioned copyright notice ${cc.id}.`);
                                  void loadModerationModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-[#EF3038] text-white"
                            >
                              Action Takedown
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await moderateContentViaCallableOrDirect(admin, {
                                    kind: 'copyright',
                                    targetId: cc.id,
                                    action: 'dismiss',
                                    copyrightStatus: 'dismissed',
                                    reason: modReasonInput.trim() || 'Insufficient claim evidence.',
                                  });
                                  notifySuccess(`Dismissed copyright notice ${cc.id}.`);
                                  void loadModerationModule();
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg font-semibold bg-[#171923] border border-[#303342]"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Posts, Communities & Collections Direct Moderation */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="space-y-2.5">
                        <h3 className="font-display-space font-bold text-sm text-white">
                          Recent Posts ({recentPosts.length})
                        </h3>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {recentPosts.map((post) => (
                            <div
                              key={post.id}
                              className="rounded-xl bg-[#090B14] border border-[#303342] p-3 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-white">
                                  @{post.authorUsername}
                                </span>
                                <span className="font-mono text-[10px] text-[#A7A9B8]">
                                  {post.moderationStatus || 'active'}
                                </span>
                              </div>
                              <p className="text-[#D4D7E2] line-clamp-2">{post.content}</p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await moderateContentViaCallableOrDirect(admin, {
                                        kind: 'post',
                                        targetId: post.id,
                                        action:
                                          post.moderationStatus === 'removed_by_moderator'
                                            ? 'restore'
                                            : 'remove',
                                        reason:
                                          modReasonInput.trim() ||
                                          'Moderator visibility decision.',
                                      });
                                      notifySuccess(`Updated post ${post.id}.`);
                                      void loadModerationModule();
                                    } catch (err) {
                                      notifyError(err);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038]"
                                >
                                  {post.moderationStatus === 'removed_by_moderator'
                                    ? 'Restore Post'
                                    : 'Hide Post'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <h3 className="font-display-space font-bold text-sm text-white">
                          Communities ({communities.length}) &amp; Collections ({collections.length})
                        </h3>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {communities.map((comm) => (
                            <div
                              key={comm.id}
                              className="rounded-xl bg-[#090B14] border border-[#303342] p-3 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">{comm.name}</p>
                                <p className="text-[11px] text-[#A7A9B8]">
                                  Status: {comm.status} · Mod: {comm.moderationStatus || 'active'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await moderateContentViaCallableOrDirect(admin, {
                                      kind: 'community',
                                      targetId: comm.id,
                                      action:
                                        comm.moderationStatus === 'removed_by_moderator'
                                          ? 'restore'
                                          : 'remove',
                                      reason:
                                        modReasonInput.trim() || 'Community moderation action.',
                                    });
                                    notifySuccess(`Updated community ${comm.name}.`);
                                    void loadModerationModule();
                                  } catch (err) {
                                    notifyError(err);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038] shrink-0"
                              >
                                {comm.moderationStatus === 'removed_by_moderator'
                                  ? 'Restore'
                                  : 'Hide'}
                              </button>
                            </div>
                          ))}

                          {collections.map((col) => (
                            <div
                              key={col.id}
                              className="rounded-xl bg-[#090B14] border border-[#303342] p-3 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">
                                  Collection: {col.title}
                                </p>
                                <p className="text-[11px] text-[#A7A9B8]">
                                  @{col.ownerUsername} · Visibility: {col.visibility}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await moderateContentViaCallableOrDirect(admin, {
                                      kind: 'collection',
                                      targetId: col.id,
                                      action: col.visibility === 'public' ? 'remove' : 'restore',
                                      reason:
                                        modReasonInput.trim() ||
                                        'Collection visibility moderated.',
                                    });
                                    notifySuccess(`Updated collection ${col.title}.`);
                                    void loadModerationModule();
                                  } catch (err) {
                                    notifyError(err);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038] shrink-0"
                              >
                                {col.visibility === 'public' ? 'Set Private' : 'Restore Public'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Challenges & Watch Parties Moderation */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="space-y-2.5">
                        <h3 className="font-display-space font-bold text-sm text-white flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                          <span>Anime Challenges ({adminChallenges.length})</span>
                        </h3>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {adminChallenges.length === 0 ? (
                            <p className="text-xs text-[#A7A9B8]">No challenges created yet.</p>
                          ) : (
                            adminChallenges.map((ch) => (
                              <div
                                key={ch.id}
                                className="rounded-xl bg-[#090B14] border border-[#303342] p-3 text-xs space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-white truncate">
                                      {ch.title} {ch.isFeatured ? '· Featured' : ''}
                                    </p>
                                    <p className="text-[11px] text-[#A7A9B8]">
                                      @{ch.creatorUsername} · {ch.participantCount} joined · Mod:{' '}
                                      <span className="text-[#EF3038]">{ch.moderationStatus}</span> · Status: {ch.status}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {hasAdminPermission(admin, 'featured_content') && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await moderateEventViaAdmin(admin, {
                                            eventType: 'challenge',
                                            eventId: ch.id,
                                            action: ch.isFeatured ? 'unfeature' : 'feature',
                                            reason: modReasonInput.trim() || 'Featured spotlight update.',
                                          });
                                          notifySuccess(`Updated featured state for "${ch.title}".`);
                                          void loadModerationModule();
                                        } catch (err) {
                                          notifyError(err);
                                        }
                                      }}
                                      className="px-2.5 py-1 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038]"
                                    >
                                      {ch.isFeatured ? 'Unfeature' : 'Feature'}
                                    </button>
                                  )}
                                  {hasAdminPermission(admin, 'content_moderation') && (
                                    <>
                                      {ch.moderationStatus === 'active' ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await moderateEventViaAdmin(admin, {
                                                  eventType: 'challenge',
                                                  eventId: ch.id,
                                                  action: 'suspend',
                                                  reason:
                                                    modReasonInput.trim() ||
                                                    'Challenge suspended pending review.',
                                                });
                                                notifySuccess(`Suspended challenge "${ch.title}".`);
                                                void loadModerationModule();
                                              } catch (err) {
                                                notifyError(err);
                                              }
                                            }}
                                            className="px-2.5 py-1 rounded-lg font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40"
                                          >
                                            Suspend
                                          </button>
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                await moderateEventViaAdmin(admin, {
                                                  eventType: 'challenge',
                                                  eventId: ch.id,
                                                  action: 'remove',
                                                  reason:
                                                    modReasonInput.trim() ||
                                                    'Challenge removed by administrator.',
                                                });
                                                notifySuccess(`Removed challenge "${ch.title}".`);
                                                void loadModerationModule();
                                              } catch (err) {
                                                notifyError(err);
                                              }
                                            }}
                                            className="px-2.5 py-1 rounded-lg font-semibold bg-[#EF3038] text-white"
                                          >
                                            Hide / Remove
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await moderateEventViaAdmin(admin, {
                                                eventType: 'challenge',
                                                eventId: ch.id,
                                                action: 'restore',
                                                reason:
                                                  modReasonInput.trim() ||
                                                  'Challenge restored by administrator.',
                                              });
                                              notifySuccess(`Restored challenge "${ch.title}".`);
                                              void loadModerationModule();
                                            } catch (err) {
                                              notifyError(err);
                                            }
                                          }}
                                          className="px-2.5 py-1 rounded-lg font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                                        >
                                          Restore
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <h3 className="font-display-space font-bold text-sm text-white flex items-center gap-2">
                          <Tv className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                          <span>Watch Parties ({adminWatchParties.length})</span>
                        </h3>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {adminWatchParties.length === 0 ? (
                            <p className="text-xs text-[#A7A9B8]">No watch parties scheduled yet.</p>
                          ) : (
                            adminWatchParties.map((wp) => (
                              <div
                                key={wp.id}
                                className="rounded-xl bg-[#090B14] border border-[#303342] p-3 text-xs space-y-2"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate">
                                    {wp.title} · {wp.animeTitle}
                                  </p>
                                  <p className="text-[11px] text-[#A7A9B8]">
                                    Host @{wp.creatorUsername} · {wp.participantCount} joined · Mod:{' '}
                                    <span className="text-[#EF3038]">{wp.moderationStatus}</span> · Status: {wp.status}
                                  </p>
                                </div>
                                {hasAdminPermission(admin, 'content_moderation') && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {wp.moderationStatus === 'active' ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await moderateEventViaAdmin(admin, {
                                                eventType: 'watch_party',
                                                eventId: wp.id,
                                                action: 'suspend',
                                                reason:
                                                  modReasonInput.trim() ||
                                                  'Watch party suspended and cancelled.',
                                              });
                                              notifySuccess(`Suspended watch party "${wp.title}".`);
                                              void loadModerationModule();
                                            } catch (err) {
                                              notifyError(err);
                                            }
                                          }}
                                          className="px-2.5 py-1 rounded-lg font-semibold bg-amber-500/15 text-amber-200 border border-amber-500/40"
                                        >
                                          Suspend &amp; Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await moderateEventViaAdmin(admin, {
                                                eventType: 'watch_party',
                                                eventId: wp.id,
                                                action: 'remove',
                                                reason:
                                                  modReasonInput.trim() ||
                                                  'Watch party removed by administrator.',
                                              });
                                              notifySuccess(`Removed watch party "${wp.title}".`);
                                              void loadModerationModule();
                                            } catch (err) {
                                              notifyError(err);
                                            }
                                          }}
                                          className="px-2.5 py-1 rounded-lg font-semibold bg-[#EF3038] text-white"
                                        >
                                          Hide / Remove
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await moderateEventViaAdmin(admin, {
                                              eventType: 'watch_party',
                                              eventId: wp.id,
                                              action: 'restore',
                                              reason:
                                                modReasonInput.trim() ||
                                                'Watch party restored by administrator.',
                                            });
                                            notifySuccess(`Restored watch party "${wp.title}".`);
                                            void loadModerationModule();
                                          } catch (err) {
                                            notifyError(err);
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded-lg font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/40"
                                      >
                                        Restore
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Evidence Decision Log */}
                    <div className="space-y-2.5">
                      <h3 className="font-display-space font-bold text-sm text-white">
                        Immutable Moderation Decisions Log ({decisions.length})
                      </h3>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs">
                        {decisions.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-lg bg-[#090B14] border border-[#303342] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              <strong className="text-white uppercase">{d.action}</strong>{' '}
                              <span className="font-mono text-[#A7A9B8]">
                                [{d.targetType}:{d.targetId}]
                              </span>{' '}
                              — {d.reason}
                            </span>
                            <span className="text-[11px] text-[#A7A9B8] font-mono">
                              Actor: {d.actorRole}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MODULE C: ANIME CATALOGUE OVERRIDES & NEWS */}
          {activeModule === 'catalogue' && (
            <section className="space-y-6">
              {/* Catalogue Overrides */}
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1 className="font-display-space font-bold text-xl text-white">
                      Anime Catalogue Curation &amp; Metadata Overrides
                    </h1>
                    <p className="text-xs text-[#A7A9B8]">
                      Pin featured/seasonal picks, correct titles/synopses, or hide inappropriate AniList catalogue items.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadCatalogueModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Refresh</span>
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveCatalogueOverride(admin, {
                        animeId: Number(overrideForm.animeId),
                        animeTitle: overrideForm.animeTitle,
                        overrideTitle: overrideForm.overrideTitle,
                        overrideSynopsis: overrideForm.overrideSynopsis,
                        editorialNote: overrideForm.editorialNote,
                        isFeatured: overrideForm.isFeatured,
                        isTrendingOverride: overrideForm.isTrendingOverride,
                        isSeasonalHighlight: overrideForm.isSeasonalHighlight,
                        recommendationPinned: overrideForm.recommendationPinned,
                        isHiddenFromCatalogue: overrideForm.isHiddenFromCatalogue,
                        metadataIssueFlag: overrideForm.metadataIssueFlag,
                      });
                      notifySuccess(`Saved override for AniList #${overrideForm.animeId}.`);
                      void loadCatalogueModule();
                    } catch (err) {
                      notifyError(err);
                    }
                  }}
                  className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="number"
                      required
                      min={1}
                      value={overrideForm.animeId}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, animeId: e.target.value }))
                      }
                      placeholder="AniList Anime ID (e.g. 21)"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={overrideForm.animeTitle}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, animeTitle: e.target.value }))
                      }
                      placeholder="Reference Title *"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      value={overrideForm.overrideTitle}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, overrideTitle: e.target.value }))
                      }
                      placeholder="Override Display Title (Optional)"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <textarea
                      rows={2}
                      value={overrideForm.overrideSynopsis}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, overrideSynopsis: e.target.value }))
                      }
                      placeholder="Override Synopsis (Optional)"
                      className="rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                    />
                    <textarea
                      rows={2}
                      value={overrideForm.editorialNote}
                      onChange={(e) =>
                        setOverrideForm((p) => ({ ...p, editorialNote: e.target.value }))
                      }
                      placeholder="Editorial Spotlight Note (Optional)"
                      className="rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1">
                    {[
                      ['isFeatured', 'Featured Spotlight'],
                      ['isTrendingOverride', 'Trending Pin'],
                      ['isSeasonalHighlight', 'Seasonal Highlight'],
                      ['recommendationPinned', 'Pin Recommendation'],
                      ['isHiddenFromCatalogue', 'Hide from Discover'],
                      ['metadataIssueFlag', 'Metadata Flagged'],
                    ].map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(overrideForm[key as keyof typeof overrideForm])}
                          onChange={(e) =>
                            setOverrideForm((p) => ({
                              ...p,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#EF3038]"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                    >
                      Save Catalogue Override
                    </button>
                  </div>
                </form>

                {!isLoadingCatalogue && overrides.length > 0 && (
                  <div className="space-y-2">
                    {overrides.map((ov) => (
                      <div
                        key={ov.id}
                        className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">
                            #{ov.animeId} · {ov.overrideTitle || ov.animeTitle}
                          </p>
                          <p className="text-[11px] text-[#A7A9B8]">
                            {[
                              ov.isFeatured && 'Featured',
                              ov.isSeasonalHighlight && 'Seasonal',
                              ov.isTrendingOverride && 'Trending',
                              ov.isHiddenFromCatalogue && 'HIDDEN',
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Metadata Override'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteCatalogueOverride(admin, ov.animeId);
                              notifySuccess(`Deleted override #${ov.animeId}.`);
                              void loadCatalogueModule();
                            } catch (err) {
                              notifyError(err);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038]"
                        >
                          Remove Override
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anime News Manager */}
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  <h2 className="font-display-space font-bold text-lg text-white">
                    ATA News Centre Articles ({newsList.length})
                  </h2>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveAdminNewsArticle(admin, {
                        id: newsForm.id || undefined,
                        title: newsForm.title,
                        source: newsForm.source,
                        sourceUrl: newsForm.sourceUrl,
                        category: newsForm.category,
                        publishedAt: newsForm.publishedAt,
                        summary: newsForm.summary,
                        imageUrl: newsForm.imageUrl,
                        author: newsForm.author,
                        status: newsForm.status,
                        isFeatured: newsForm.isFeatured,
                      });
                      notifySuccess('Saved news article.');
                      setNewsForm((p) => ({ ...p, id: '', title: '', summary: '' }));
                      void loadCatalogueModule();
                    } catch (err) {
                      notifyError(err);
                    }
                  }}
                  className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newsForm.title}
                      onChange={(e) => setNewsForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Headline *"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={newsForm.source}
                      onChange={(e) => setNewsForm((p) => ({ ...p, source: e.target.value }))}
                      placeholder="Verified Source *"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={newsForm.category}
                      onChange={(e) =>
                        setNewsForm((p) => ({ ...p, category: e.target.value as NewsCategory }))
                      }
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    >
                      {(['Industry', 'Releases', 'Reviews', 'Interviews', 'Events'] as const).map(
                        (cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        )
                      )}
                    </select>
                    <select
                      value={newsForm.status}
                      onChange={(e) =>
                        setNewsForm((p) => ({
                          ...p,
                          status: e.target.value as AdminNewsArticle['status'],
                        }))
                      }
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                    <input
                      type="text"
                      value={newsForm.publishedAt}
                      onChange={(e) => setNewsForm((p) => ({ ...p, publishedAt: e.target.value }))}
                      placeholder="YYYY-MM-DD"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="url"
                      value={newsForm.sourceUrl}
                      onChange={(e) => setNewsForm((p) => ({ ...p, sourceUrl: e.target.value }))}
                      placeholder="Source HTTPS URL"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="url"
                      value={newsForm.imageUrl}
                      onChange={(e) => setNewsForm((p) => ({ ...p, imageUrl: e.target.value }))}
                      placeholder="Licensed Press HTTPS Image URL (Optional)"
                      className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={newsForm.summary}
                    onChange={(e) => setNewsForm((p) => ({ ...p, summary: e.target.value }))}
                    placeholder="Article summary *"
                    className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newsForm.isFeatured}
                        onChange={(e) =>
                          setNewsForm((p) => ({ ...p, isFeatured: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#EF3038]"
                      />
                      <span>Feature in News Centre</span>
                    </label>
                    <button
                      type="submit"
                      className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                    >
                      Save News Article
                    </button>
                  </div>
                </form>

                {newsList.length > 0 && (
                  <div className="space-y-2">
                    {newsList.map((art) => (
                      <div
                        key={art.id}
                        className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">
                            {art.title} <span className="text-[#EF3038]">({art.status})</span>
                          </p>
                          <p className="text-[11px] text-[#A7A9B8]">
                            {art.category} · {art.source} · {art.publishedAt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteAdminNewsArticle(admin, art.id);
                              notifySuccess(`Deleted news article ${art.title}.`);
                              void loadCatalogueModule();
                            } catch (err) {
                              notifyError(err);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg font-semibold bg-[#171923] border border-[#303342] hover:border-[#EF3038]"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MODULE D: WHERE TO WATCH */}
          {activeModule === 'streaming' && (
            <section className="space-y-6">
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1 className="font-display-space font-bold text-xl text-white">
                      Where to Watch — Verified Free Legal Directory Admin
                    </h1>
                    <p className="text-xs text-[#A7A9B8]">
                      Rules enforce HTTPS official domains ({APPROVED_STREAMING_DOMAINS.slice(0, 5).join(', ')}...),{' '}
                      <code className="font-mono">isFree=true</code>, and <code className="font-mono">isLegitimate=true</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadStreamingModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Add/Edit Provider */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveAdminStreamingProvider(admin, {
                        id: providerForm.id.trim(),
                        name: providerForm.name.trim(),
                        shortLabel: providerForm.shortLabel.trim(),
                        accentHex: providerForm.accentHex.trim(),
                        description: providerForm.description.trim(),
                        supportedCountries: providerForm.supportedCountriesCsv
                          .split(',')
                          .map((c) => c.trim().toUpperCase())
                          .filter(Boolean),
                        officialUrl: providerForm.officialUrl.trim(),
                        allowedDomains: providerForm.allowedDomainsCsv
                          .split(',')
                          .map((d) => d.trim().toLowerCase())
                          .filter(Boolean),
                        accessModel: providerForm.accessModel,
                        isFree: true,
                        isLegitimate: true,
                        verificationStatus: 'verified',
                        lastVerifiedAt: providerForm.lastVerifiedAt,
                      });
                      notifySuccess(`Saved free legal provider ${providerForm.name}.`);
                      void loadStreamingModule();
                    } catch (err) {
                      notifyError(err);
                    }
                  }}
                  className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3 text-xs"
                >
                  <p className="font-bold text-white">Add / Update Verified Free Provider</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={providerForm.id}
                      onChange={(e) => setProviderForm((p) => ({ ...p, id: e.target.value }))}
                      placeholder="Provider ID (e.g. gundaminfo)"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={providerForm.name}
                      onChange={(e) => setProviderForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Official Provider Name"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={providerForm.shortLabel}
                      onChange={(e) => setProviderForm((p) => ({ ...p, shortLabel: e.target.value }))}
                      placeholder="Short Label (e.g. GI)"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="url"
                      required
                      value={providerForm.officialUrl}
                      onChange={(e) => setProviderForm((p) => ({ ...p, officialUrl: e.target.value }))}
                      placeholder="Official HTTPS URL"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={providerForm.supportedCountriesCsv}
                      onChange={(e) =>
                        setProviderForm((p) => ({ ...p, supportedCountriesCsv: e.target.value }))
                      }
                      placeholder="ISO Countries (e.g. ZA, US, GB)"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={providerForm.allowedDomainsCsv}
                      onChange={(e) =>
                        setProviderForm((p) => ({ ...p, allowedDomainsCsv: e.target.value }))
                      }
                      placeholder="Approved Domains (e.g. www.youtube.com)"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={providerForm.description}
                    onChange={(e) => setProviderForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Verification description"
                    className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                    >
                      Save Provider
                    </button>
                  </div>
                </form>

                {/* Add/Update Anime Availability */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await saveAdminStreamingAvailability(
                        admin,
                        {
                          id: availForm.id.trim(),
                          animeId: Number(availForm.animeId),
                          animeTitle: availForm.animeTitle.trim(),
                          providerId: availForm.providerId.trim(),
                          providerName: availForm.providerName.trim(),
                          countryCode: availForm.countryCode,
                          isFree: true,
                          isLegitimate: true,
                          officialUrl: availForm.officialUrl.trim(),
                          accessModel: availForm.accessModel,
                          availabilityType: availForm.availabilityType,
                          verificationStatus: 'verified',
                          lastVerifiedAt: availForm.lastVerifiedAt,
                          source: availForm.source,
                          notes: availForm.notes,
                        },
                        providers
                      );
                      notifySuccess(`Saved availability for ${availForm.animeTitle}.`);
                      void loadStreamingModule();
                    } catch (err) {
                      notifyError(err);
                    }
                  }}
                  className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3 text-xs"
                >
                  <p className="font-bold text-white">Add / Update Anime Streaming Availability</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="number"
                      required
                      min={1}
                      value={availForm.animeId}
                      onChange={(e) => setAvailForm((p) => ({ ...p, animeId: e.target.value }))}
                      placeholder="AniList ID"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={availForm.animeTitle}
                      onChange={(e) => setAvailForm((p) => ({ ...p, animeTitle: e.target.value }))}
                      placeholder="Anime Title"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={availForm.providerId}
                      onChange={(e) => setAvailForm((p) => ({ ...p, providerId: e.target.value }))}
                      placeholder="Provider ID (e.g. gundaminfo)"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <select
                      value={availForm.countryCode}
                      onChange={(e) => setAvailForm((p) => ({ ...p, countryCode: e.target.value }))}
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    >
                      {COUNTRY_CATALOG.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={availForm.providerName}
                      onChange={(e) => setAvailForm((p) => ({ ...p, providerName: e.target.value }))}
                      placeholder="Provider Display Name"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="url"
                      required
                      value={availForm.officialUrl}
                      onChange={(e) => setAvailForm((p) => ({ ...p, officialUrl: e.target.value }))}
                      placeholder="Verified Official Stream HTTPS URL"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      required
                      value={availForm.source}
                      onChange={(e) => setAvailForm((p) => ({ ...p, source: e.target.value }))}
                      placeholder="Verification Source"
                      className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                    >
                      Save Availability Entry
                    </button>
                  </div>
                </form>

                {!isLoadingStreaming && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <h2 className="font-bold text-white">
                        Firestore Providers ({providers.length}) &amp; Availability ({availabilityList.length})
                      </h2>
                      {providers.map((prov) => (
                        <div
                          key={prov.id}
                          className="rounded-xl bg-[#090B14] border border-[#303342] p-3 flex items-center justify-between gap-2"
                        >
                          <span>
                            <strong className="text-white">{prov.name}</strong> ({prov.id})
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAdminStreamingProvider(admin, prov.id);
                              void loadStreamingModule();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#171923] border border-[#303342]"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {availabilityList.map((av) => (
                        <div
                          key={av.id}
                          className="rounded-xl bg-[#090B14] border border-[#303342] p-3 flex items-center justify-between gap-2"
                        >
                          <span>
                            <strong className="text-white">{av.animeTitle}</strong> · {av.providerName} ({av.countryCode})
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAdminStreamingAvailability(admin, av.id);
                              void loadStreamingModule();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#171923] border border-[#303342]"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h2 className="font-bold text-white">
                        User Availability Reports ({streamingReports.length})
                      </h2>
                      {streamingReports.map((sr) => (
                        <div
                          key={sr.id}
                          className="rounded-xl bg-[#090B14] border border-[#303342] p-3 flex items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-white">
                              {sr.animeTitle} ({sr.countryCode}) — {sr.status}
                            </p>
                            <p className="text-[#A7A9B8]">{sr.reason}: {sr.details}</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await markStreamingReportReviewed(
                                admin,
                                sr.id,
                                sr.status === 'reviewed' ? 'open' : 'reviewed'
                              );
                              void loadStreamingModule();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#171923] border border-[#303342] shrink-0"
                          >
                            {sr.status === 'reviewed' ? 'Reopen' : 'Mark Reviewed'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* MODULE E: ANNOUNCEMENTS */}
          {activeModule === 'announcements' && (
            <section className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
              <h1 className="font-display-space font-bold text-xl text-white">
                Platform Announcements &amp; System Notices
              </h1>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const uids = announceForm.targetUidsCsv
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean);
                    await publishOrUpdateAnnouncement(admin, {
                      id: announceForm.id || undefined,
                      title: announceForm.title,
                      body: announceForm.body,
                      kind: announceForm.kind,
                      audience: announceForm.audience,
                      targetUserIds: uids,
                      isActive: announceForm.isActive,
                      sendInAppNotification: announceForm.sendInAppNotification,
                    });
                    notifySuccess('Saved platform announcement.');
                    setAnnounceForm((p) => ({ ...p, id: '', title: '', body: '' }));
                    void loadAnnouncementsModule();
                  } catch (err) {
                    notifyError(err);
                  }
                }}
                className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={announceForm.title}
                    onChange={(e) => setAnnounceForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Announcement Title *"
                    className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                  />
                  <select
                    value={announceForm.kind}
                    onChange={(e) =>
                      setAnnounceForm((p) => ({
                        ...p,
                        kind: e.target.value as PlatformAnnouncement['kind'],
                      }))
                    }
                    className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                  >
                    <option value="general">General</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="safety">Safety Advisory</option>
                    <option value="feature">Platform Update</option>
                  </select>
                  <select
                    value={announceForm.audience}
                    onChange={(e) =>
                      setAnnounceForm((p) => ({
                        ...p,
                        audience: e.target.value as PlatformAnnouncement['audience'],
                      }))
                    }
                    className="min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                  >
                    <option value="all_users">All Users</option>
                    <option value="selected_users">Selected User UIDs</option>
                  </select>
                </div>

                {announceForm.audience === 'selected_users' && (
                  <input
                    type="text"
                    value={announceForm.targetUidsCsv}
                    onChange={(e) =>
                      setAnnounceForm((p) => ({ ...p, targetUidsCsv: e.target.value }))
                    }
                    placeholder="Comma-separated User UIDs"
                    className="w-full min-h-[42px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                  />
                )}

                <textarea
                  rows={3}
                  required
                  value={announceForm.body}
                  onChange={(e) => setAnnounceForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder="Announcement message *"
                  className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announceForm.isActive}
                        onChange={(e) =>
                          setAnnounceForm((p) => ({ ...p, isActive: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#EF3038]"
                      />
                      <span>Active Banner</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={announceForm.sendInAppNotification}
                        onChange={(e) =>
                          setAnnounceForm((p) => ({
                            ...p,
                            sendInAppNotification: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#EF3038]"
                      />
                      <span>Send In-App Notice (requires Functions)</span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                  >
                    Publish Notice
                  </button>
                </div>
              </form>

              {!isLoadingAnnouncements && (
                <div className="space-y-2.5 text-xs">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl bg-[#090B14] border border-[#303342] p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-white">
                          {a.title} ({a.kind}) — {a.isActive ? 'ACTIVE' : 'ARCHIVED'}
                        </p>
                        <p className="text-[#A7A9B8] mt-0.5">{a.body}</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await publishOrUpdateAnnouncement(admin, {
                              id: a.id,
                              title: a.title,
                              body: a.body,
                              kind: a.kind,
                              audience: a.audience,
                              targetUserIds: a.targetUserIds,
                              isActive: !a.isActive,
                              sendInAppNotification: false,
                            });
                            void loadAnnouncementsModule();
                          } catch (err) {
                            notifyError(err);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#171923] border border-[#303342]"
                      >
                        {a.isActive ? 'Archive' : 'Reactivate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* MODULE F: OPS, FEEDBACK, LEGAL, SECURITY INCIDENTS & SYSTEM HEALTH */}
          {activeModule === 'operations' && (
            <section className="space-y-6">
              {/* System Health */}
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="font-display-space font-bold text-xl text-white">
                    System Health, Legal Compliance &amp; User Feedback
                  </h1>
                  <button
                    type="button"
                    onClick={() => void loadOpsModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Run Diagnostics</span>
                  </button>
                </div>

                {!isLoadingOps && healthSnapshot && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5">
                      <p className="text-[#A7A9B8]">Named Firestore DB</p>
                      <p className="font-mono font-bold text-white mt-1 truncate">
                        {healthSnapshot.firestoreDatabaseId}
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        {healthSnapshot.firestoreConnected
                          ? `Connected (${healthSnapshot.firestoreLatencyMs ?? 0}ms)`
                          : 'Disconnected'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5">
                      <p className="text-[#A7A9B8]">AniList GraphQL API</p>
                      <p className="font-bold text-white mt-1">
                        {healthSnapshot.anilistReachable ? 'Reachable' : 'Unavailable'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5">
                      <p className="text-[#A7A9B8]">Firebase Storage</p>
                      <p className="font-bold text-white mt-1">
                        {healthSnapshot.storageConfigured ? 'Configured' : 'Unconfigured'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5">
                      <p className="text-[#A7A9B8]">Project Target</p>
                      <p className="font-mono font-bold text-white mt-1">
                        {healthSnapshot.projectId}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* User Feedback */}
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  <h2 className="font-display-space font-bold text-lg text-white">
                    User Feedback &amp; Accessibility Reports ({feedbackList.length})
                  </h2>
                </div>
                {feedbackList.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-white">
                        [{fb.category}] {fb.subject} — <span className="text-[#EF3038]">{fb.status}</span>
                      </p>
                      <p className="text-[#D4D7E2]">{fb.message}</p>
                      <p className="text-[11px] font-mono text-[#A7A9B8]">
                        Page: {fb.pageContext} · UID: {fb.userId}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateUserFeedbackStatus(admin, fb.id, 'reviewed', 'Reviewed.');
                          void loadOpsModule();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#171923] border border-[#303342]"
                      >
                        Reviewed
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateUserFeedbackStatus(admin, fb.id, 'resolved', 'Resolved.');
                          void loadOpsModule();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                      >
                        Resolved
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legal Document Overrides & Risk Register */}
              {hasAdminPermission(admin, 'legal_compliance') && (
                <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-5 text-xs">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                    <h2 className="font-display-space font-bold text-lg text-white">
                      Legal Documents Editor &amp; Risk Register
                    </h2>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await saveLegalDocumentOverride(admin, {
                          id: legalSlug,
                          title: legalForm.title,
                          customSummary: legalForm.customSummary,
                          guidelinesList: legalForm.guidelinesLines.split('\n'),
                          lastUpdatedLabel: legalForm.lastUpdatedLabel,
                        });
                        notifySuccess(`Saved live legal override for ${legalSlug}.`);
                        void loadOpsModule();
                      } catch (err) {
                        notifyError(err);
                      }
                    }}
                    className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={legalSlug}
                        onChange={(e) => setLegalSlug(e.target.value as LegalPageSlug)}
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      >
                        <option value="community-guidelines">Community Guidelines</option>
                        <option value="privacy-policy">Privacy Policy</option>
                        <option value="terms">Terms &amp; Conditions</option>
                        <option value="cookie-policy">Cookie &amp; Storage Policy</option>
                        <option value="refund-policy">Refund Policy</option>
                      </select>
                      <input
                        type="text"
                        required
                        value={legalForm.title}
                        onChange={(e) => setLegalForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Document Title"
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      />
                      <input
                        type="text"
                        required
                        value={legalForm.lastUpdatedLabel}
                        onChange={(e) =>
                          setLegalForm((p) => ({ ...p, lastUpdatedLabel: e.target.value }))
                        }
                        placeholder="Last Updated Date Label"
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={legalForm.customSummary}
                      onChange={(e) =>
                        setLegalForm((p) => ({ ...p, customSummary: e.target.value }))
                      }
                      placeholder="Published Administrator Notice (shown prominently above policy sections)..."
                      className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                    />
                    <textarea
                      rows={3}
                      value={legalForm.guidelinesLines}
                      onChange={(e) =>
                        setLegalForm((p) => ({ ...p, guidelinesLines: e.target.value }))
                      }
                      placeholder="Supplementary rules (one bullet per line)..."
                      className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                      >
                        Publish Legal Update
                      </button>
                    </div>
                  </form>

                  <div className="overflow-x-auto rounded-xl border border-[#303342]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#090B14] border-b border-[#303342] text-white">
                          <th className="p-3">Domain</th>
                          <th className="p-3">Statute</th>
                          <th className="p-3">Risk</th>
                          <th className="p-3">Control &amp; Owner Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#303342]">
                        {ATA_LEGAL_RISK_REGISTER.map((entry) => (
                          <tr key={entry.id}>
                            <td className="p-3 font-bold text-white">{entry.domain}</td>
                            <td className="p-3 text-[#A7A9B8]">{entry.statuteOrStandard}</td>
                            <td className="p-3 uppercase font-bold text-[#EF3038]">
                              {entry.riskLevel}
                            </td>
                            <td className="p-3 text-[#D4D7E2] space-y-1">
                              <p>{entry.currentControl}</p>
                              <p className="text-amber-300">Next: {entry.remainingOwnerAction}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Security Incidents */}
              {hasAdminPermission(admin, 'security_incidents') && (
                <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4 text-xs">
                  <h2 className="font-display-space font-bold text-lg text-white">
                    POPIA Section 22 Security Incident Log ({incidents.length})
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!requireFreshReauth()) return;
                      try {
                        await saveSecurityIncident(admin, incidentForm);
                        notifySuccess('Security incident recorded.');
                        setIncidentForm({
                          title: '',
                          severity: 'low',
                          status: 'investigating',
                          summary: '',
                          remediationSteps: '',
                          regulatorsNotified: false,
                        });
                        void loadOpsModule();
                      } catch (err) {
                        notifyError(err);
                      }
                    }}
                    className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        required
                        value={incidentForm.title}
                        onChange={(e) => setIncidentForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Incident Title *"
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      />
                      <select
                        value={incidentForm.severity}
                        onChange={(e) =>
                          setIncidentForm((p) => ({
                            ...p,
                            severity: e.target.value as SecurityIncidentRecord['severity'],
                          }))
                        }
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <select
                        value={incidentForm.status}
                        onChange={(e) =>
                          setIncidentForm((p) => ({
                            ...p,
                            status: e.target.value as SecurityIncidentRecord['status'],
                          }))
                        }
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      >
                        <option value="investigating">Investigating</option>
                        <option value="contained">Contained</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={incidentForm.summary}
                      onChange={(e) => setIncidentForm((p) => ({ ...p, summary: e.target.value }))}
                      placeholder="Incident summary *"
                      className="w-full rounded-xl bg-[#171923] border border-[#303342] p-3 text-white"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={incidentForm.regulatorsNotified}
                          onChange={(e) =>
                            setIncidentForm((p) => ({
                              ...p,
                              regulatorsNotified: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#EF3038]"
                        />
                        <span>Regulators Notified (POPIA s22)</span>
                      </label>
                      <button
                        type="submit"
                        className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                      >
                        Record Security Incident
                      </button>
                    </div>
                  </form>

                  {incidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-xl bg-[#090B14] border border-[#303342] p-3.5"
                    >
                      <p className="font-bold text-white">
                        [{inc.severity.toUpperCase()}] {inc.title} — {inc.status}
                      </p>
                      <p className="text-[#A7A9B8] mt-1">{inc.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* MODULE G: OWNER SEAT MANAGEMENT & AUDIT LOGS */}
          {activeModule === 'governance' && (
            <section className="space-y-6 text-xs">
              <div className="bg-[#171923] border border-[#303342] rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h1 className="font-display-space font-bold text-xl text-white">
                      Three-Administrator Governance &amp; Audit Logs
                    </h1>
                    <p className="text-[#A7A9B8] mt-0.5">
                      Strict 3-seat cap (Owner, Platform Admin, Content Admin). Owner seat cannot be restricted or removed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadGovernanceModule()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold bg-[#090B14] border border-[#303342]"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Refresh</span>
                  </button>
                </div>

                {!isLoadingGovernance && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {adminSeats.map((seat) => (
                      <div
                        key={seat.seatId}
                        className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">{seat.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              seat.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {seat.occupied ? seat.status : 'empty'}
                          </span>
                        </div>
                        <p className="text-[#A7A9B8]">{seat.description}</p>
                        <p className="font-mono text-[11px] text-white break-all">
                          UID: {seat.uid || 'Unassigned'}
                        </p>
                        <p className="text-[11px] text-[#A7A9B8]">
                          Permissions: {seat.permissions.length}
                        </p>
                        {hasAdminPermission(admin, 'admin_management') && (
                          <button
                            type="button"
                            onClick={() =>
                              setSeatForm({
                                seatId: seat.seatId,
                                targetUid: seat.uid,
                                displayLabel: seat.displayLabel,
                                status: seat.status === 'revoked' && !seat.occupied ? 'active' : seat.status,
                                permissions: seat.permissions,
                                restrictionReason: seat.restrictionReason || '',
                                transferOwnership: false,
                              })
                            }
                            className="w-full py-1.5 rounded-lg bg-[#171923] border border-[#303342] font-semibold hover:border-[#EF3038]"
                          >
                            Configure Seat
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {hasAdminPermission(admin, 'admin_management') && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!requireFreshReauth()) return;
                      try {
                        await manageAdminSeatViaCallable({
                          seatId: seatForm.seatId,
                          targetUid: seatForm.targetUid.trim(),
                          status: seatForm.status,
                          displayLabel: seatForm.displayLabel.trim(),
                          permissions: sanitizeAdminPermissions(
                            seatForm.seatId,
                            seatForm.permissions
                          ),
                          restrictionReason: seatForm.restrictionReason.trim(),
                          transferOwnership: seatForm.transferOwnership,
                        });
                        notifySuccess(`Updated administrator seat ${seatForm.seatId}.`);
                        void loadGovernanceModule();
                      } catch (err) {
                        notifyError(err);
                      }
                    }}
                    className="rounded-xl bg-[#090B14] border border-[#303342] p-4 space-y-4"
                  >
                    <div className="flex items-center gap-2 font-bold text-white">
                      <ShieldCheck className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                      <span>Assign / Customise Administrator Seat (Owner Reauth Required)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <select
                        value={seatForm.seatId}
                        onChange={(e) => {
                          const nextSeat = e.target.value as AdminSeatId;
                          setSeatForm((p) => ({
                            ...p,
                            seatId: nextSeat,
                            permissions: [...ADMIN_SEAT_METADATA[nextSeat].defaultPermissions],
                          }));
                        }}
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      >
                        <option value="owner">Seat 1 — Owner</option>
                        <option value="platform_admin">Seat 2 — Platform Admin</option>
                        <option value="content_admin">Seat 3 — Content Admin</option>
                      </select>

                      <input
                        type="text"
                        required
                        value={seatForm.targetUid}
                        onChange={(e) =>
                          setSeatForm((p) => ({ ...p, targetUid: e.target.value }))
                        }
                        placeholder="Firebase Auth UID *"
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      />

                      <input
                        type="text"
                        required
                        value={seatForm.displayLabel}
                        onChange={(e) =>
                          setSeatForm((p) => ({ ...p, displayLabel: e.target.value }))
                        }
                        placeholder="Seat Label"
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      />

                      <select
                        value={seatForm.status}
                        onChange={(e) =>
                          setSeatForm((p) => ({
                            ...p,
                            status: e.target.value as AdminSeatStatus,
                          }))
                        }
                        className="min-h-[40px] rounded-xl bg-[#171923] border border-[#303342] px-3 py-2 text-white"
                      >
                        <option value="active">Active</option>
                        <option value="restricted">Restricted</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </div>

                    {seatForm.seatId === 'owner' && (
                      <label className="inline-flex items-center gap-2 cursor-pointer text-amber-300">
                        <input
                          type="checkbox"
                          checked={seatForm.transferOwnership}
                          onChange={(e) =>
                            setSeatForm((p) => ({
                              ...p,
                              transferOwnership: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-[#EF3038]"
                        />
                        <span>Confirm explicit Owner Seat Transfer to target UID</span>
                      </label>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                      {ADMIN_PERMISSION_CATALOG.map((permMeta) => {
                        const checked =
                          seatForm.seatId === 'owner' ||
                          seatForm.permissions.includes(permMeta.id);
                        return (
                          <label
                            key={permMeta.id}
                            className="flex items-start gap-2 rounded-lg bg-[#171923] border border-[#303342] p-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              disabled={seatForm.seatId === 'owner'}
                              checked={checked}
                              onChange={(e) => {
                                setSeatForm((p) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...p.permissions, permMeta.id]))
                                    : p.permissions.filter((x) => x !== permMeta.id);
                                  return { ...p, permissions: next };
                                });
                              }}
                              className="mt-0.5 h-3.5 w-3.5 accent-[#EF3038]"
                            />
                            <span>
                              <span className="block font-semibold text-white">
                                {permMeta.label}
                              </span>
                              <span className="block text-[10px] text-[#A7A9B8]">
                                {permMeta.group}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 min-h-[40px] rounded-xl font-semibold text-white bg-[#EF3038] border border-[#B92335]"
                      >
                        Apply Seat Configuration
                      </button>
                    </div>
                  </form>
                )}

                {/* Audit Logs & Login Events */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h2 className="font-display-space font-bold text-base text-white">
                      Immutable Admin Audit Logs ({auditLogs.length})
                    </h2>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-lg bg-[#090B14] border border-[#303342] p-3"
                        >
                          <p className="font-bold text-white">
                            {log.actionType} ({log.actorRole})
                          </p>
                          <p className="text-[#D4D7E2] mt-0.5">{log.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="font-display-space font-bold text-base text-white">
                      Admin Security &amp; Login Events ({loginEvents.length})
                    </h2>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {loginEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-lg bg-[#090B14] border border-[#303342] p-3"
                        >
                          <p className="font-bold text-white">
                            {ev.outcome} · {ev.emailMasked} ({ev.seatId})
                          </p>
                          <p className="text-[#A7A9B8] mt-0.5">{ev.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Reauthentication Modal */}
      {isReauthModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ata-reauth-title"
          onClick={() => setIsReauthModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#171923] border border-[#303342] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[#EF3038]">
              <Lock className="h-5 w-5" aria-hidden="true" />
              <h2
                id="ata-reauth-title"
                className="font-display-space font-bold text-lg text-white"
              >
                Confirm Administrator Password
              </h2>
            </div>
            <p className="text-xs text-[#A7A9B8] leading-relaxed">
              High-sensitivity actions (permanent bans, account deletion completion, admin seat updates, and security incident reports) require password confirmation within the last 15 minutes.
            </p>
            {reauthError && (
              <div
                role="alert"
                className="rounded-xl bg-[#EF3038]/15 border border-[#EF3038] p-3 text-xs text-white"
              >
                {reauthError}
              </div>
            )}
            <form onSubmit={handleReauthSubmit} className="space-y-3">
              <input
                type="password"
                required
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Enter your administrator password"
                className="w-full min-h-[44px] rounded-xl bg-[#090B14] border border-[#303342] px-3.5 py-2.5 text-sm text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReauthModalOpen(false)}
                  className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-[#090B14] border border-[#303342]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReauthing || !reauthPassword}
                  className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] disabled:opacity-50"
                >
                  {isReauthing ? 'Verifying...' : 'Confirm Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
