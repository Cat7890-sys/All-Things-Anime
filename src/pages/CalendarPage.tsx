import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  List,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';
import type {
  AnimeChallenge,
  ChallengeParticipation,
  NavDestinationId,
  WatchParty,
  WatchPartyParticipant,
  WatchReminder,
} from '../types';
import type { NormalizedAnime } from '../services/catalogue/anilistTypes';
import {
  fetchPublicAndJoinedChallenges,
  fetchUserChallengeParticipations,
} from '../services/challenges/challengeService';
import {
  deriveChallengeLifecycleStatus,
  deriveWatchPartyLifecycleStatus,
  formatCountdownLabel,
} from '../services/challenges/gamificationRules';
import {
  fetchAiringSchedules,
  subscribeToUserReminders,
  upsertWatchReminder,
  deleteWatchReminder,
  type AiringScheduleItem,
} from '../services/companion/calendarService';
import { createAniListClient } from '../services/catalogue/anilistService';
import {
  fetchUserWatchPartyParticipations,
  fetchVisibleWatchParties,
} from '../services/watchParties/watchPartyService';

interface CalendarPageProps {
  currentUserId?: string;
  onOpenAuth: () => void;
  onNavigateDestination: (id: NavDestinationId) => void;
  onOpenChallenge?: (challengeId: string) => void;
  onOpenWatchParty?: (partyId: string) => void;
}

type CalendarTab = 'events' | 'schedule' | 'reminders' | 'seasonal';
type EventFilterType =
  | 'all'
  | 'challenges'
  | 'watch-parties'
  | 'community'
  | 'mine'
  | 'airing';

interface UnifiedCalendarEvent {
  id: string;
  kind: 'challenge_start' | 'challenge_end' | 'watch_party' | 'airing';
  title: string;
  subtitle: string;
  dateKey: string; // YYYY-MM-DD in local timezone
  timestampMs: number;
  timeLabel: string;
  statusLabel: string;
  statusTone: 'crimson' | 'emerald' | 'amber' | 'slate';
  isCommunityHosted: boolean;
  isMine: boolean;
  challengeId?: string;
  watchPartyId?: string;
  communityName?: string;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateOnlyLocalMs(dateOnly: string): number {
  const parts = dateOnly.split('-').map((n) => Number(n));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return Date.now();
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0).getTime();
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  currentUserId,
  onOpenAuth,
  onNavigateDestination,
  onOpenChallenge,
  onOpenWatchParty,
}) => {
  const [activeTab, setActiveTab] = useState<CalendarTab>('events');
  const [schedules, setSchedules] = useState<AiringScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [reminders, setReminders] = useState<WatchReminder[]>([]);
  const [seasonalAnime, setSeasonalAnime] = useState<NormalizedAnime[]>([]);
  const [isLoadingSeasonal, setIsLoadingSeasonal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Build 09 Community Events Calendar state
  const [challenges, setChallenges] = useState<AnimeChallenge[]>([]);
  const [watchParties, setWatchParties] = useState<WatchParty[]>([]);
  const [myChallengeParts, setMyChallengeParts] = useState<ChallengeParticipation[]>([]);
  const [myPartyParts, setMyPartyParts] = useState<WatchPartyParticipant[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [eventFilter, setEventFilter] = useState<EventFilterType>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() =>
    toLocalDateKey(new Date())
  );

  // Load airing schedules for the next 7 days
  useEffect(() => {
    let isMounted = true;
    async function loadSchedules() {
      setIsLoadingSchedules(true);
      const nowSec = Math.floor(Date.now() / 1000);
      const weekSec = nowSec + 7 * 24 * 60 * 60;
      const items = await fetchAiringSchedules(nowSec - 24 * 60 * 60, weekSec, 60);
      if (!isMounted) return;
      setSchedules(items);
      setIsLoadingSchedules(false);
    }
    void loadSchedules();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Build 09 Challenges & Watch Parties for the integrated calendar
  const loadCommunityEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const [challengeList, partyList, myCh, myWp] = await Promise.all([
        fetchPublicAndJoinedChallenges(currentUserId || undefined),
        fetchVisibleWatchParties(currentUserId || undefined),
        currentUserId
          ? fetchUserChallengeParticipations(currentUserId)
          : Promise.resolve([]),
        currentUserId
          ? fetchUserWatchPartyParticipations(currentUserId)
          : Promise.resolve([]),
      ]);
      setChallenges(challengeList);
      setWatchParties(partyList);
      setMyChallengeParts(myCh);
      setMyPartyParts(myWp);
    } catch {
      // keep existing UI usable even if a partial query fails
    } finally {
      setIsLoadingEvents(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    void loadCommunityEvents();
  }, [loadCommunityEvents]);

  // Subscribe to reminders if logged in
  useEffect(() => {
    if (!currentUserId) {
      setReminders([]);
      return;
    }
    const unsub = subscribeToUserReminders(currentUserId, (list) => {
      setReminders(list);
    });
    return () => {
      unsub();
    };
  }, [currentUserId]);

  // Load seasonal planner items
  useEffect(() => {
    let isMounted = true;
    async function loadSeasonal() {
      setIsLoadingSeasonal(true);
      try {
        const client = createAniListClient();
        const res = await client.getCategory('seasonal', { perPage: 24 });
        if (!isMounted) return;
        setSeasonalAnime(res.items);
      } catch {
        // fallback
      } finally {
        if (isMounted) setIsLoadingSeasonal(false);
      }
    }
    void loadSeasonal();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleReminder = async (
    anime: NormalizedAnime,
    episodeNum: number,
    airingAtSec: number
  ) => {
    if (!currentUserId) {
      onOpenAuth();
      return;
    }
    const reminderId = `${anime.id}_${episodeNum}`;
    const existing = reminders.find((r) => r.id === reminderId);
    if (existing) {
      await deleteWatchReminder(currentUserId, reminderId);
    } else {
      await upsertWatchReminder(currentUserId, {
        id: reminderId,
        animeId: String(anime.id),
        animeTitle: anime.title.display,
        animeCoverUrl: anime.coverImage.best || '',
        episodeNumber: episodeNum,
        airingAt: airingAtSec,
        offsetMinutes: 15,
        isNotified: false,
      });
    }
  };

  const myChallengeSet = useMemo(
    () => new Set(myChallengeParts.map((p) => p.challengeId)),
    [myChallengeParts]
  );
  const myPartyMap = useMemo(
    () => new Map(myPartyParts.map((p) => [p.partyId, p])),
    [myPartyParts]
  );

  // Build unified calendar events list
  const unifiedEvents = useMemo<UnifiedCalendarEvent[]>(() => {
    const events: UnifiedCalendarEvent[] = [];

    for (const ch of challenges) {
      if (ch.status === 'archived') continue;
      const lifecycle = deriveChallengeLifecycleStatus(
        ch.status,
        ch.startDate,
        ch.endDate
      );
      const joined = myChallengeSet.has(ch.id);
      const tone: UnifiedCalendarEvent['statusTone'] = joined
        ? 'emerald'
        : lifecycle === 'active'
          ? 'crimson'
          : lifecycle === 'upcoming'
            ? 'amber'
            : 'slate';

      if (ch.startDate) {
        events.push({
          id: `ch_start_${ch.id}`,
          kind: 'challenge_start',
          title: `Starts: ${ch.title}`,
          subtitle: `${ch.category} · ${ch.difficulty} · ${ch.participantCount} joined`,
          dateKey: ch.startDate,
          timestampMs: parseDateOnlyLocalMs(ch.startDate),
          timeLabel: 'All Day',
          statusLabel: joined ? 'Joined' : lifecycle,
          statusTone: tone,
          isCommunityHosted: Boolean(ch.communityId),
          isMine: joined || ch.creatorId === currentUserId,
          challengeId: ch.id,
          communityName: ch.communityName,
        });
      }

      if (ch.endDate && ch.endDate !== ch.startDate) {
        events.push({
          id: `ch_end_${ch.id}`,
          kind: 'challenge_end',
          title: `Deadline: ${ch.title}`,
          subtitle: `${ch.animeTargets.length} anime target${ch.animeTargets.length === 1 ? '' : 's'}`,
          dateKey: ch.endDate,
          timestampMs: parseDateOnlyLocalMs(ch.endDate),
          timeLabel: '23:59 Local',
          statusLabel: joined ? 'My Deadline' : 'Deadline',
          statusTone: tone,
          isCommunityHosted: Boolean(ch.communityId),
          isMine: joined || ch.creatorId === currentUserId,
          challengeId: ch.id,
          communityName: ch.communityName,
        });
      }
    }

    for (const wp of watchParties) {
      const lifecycle = deriveWatchPartyLifecycleStatus(
        wp.status,
        wp.scheduledStartAtMs,
        wp.estimatedDurationMinutes
      );
      const myPart = myPartyMap.get(wp.id);
      const isMine = Boolean(myPart) || wp.creatorId === currentUserId;
      const localDate = new Date(wp.scheduledStartAtMs || Date.now());
      const dateKey = toLocalDateKey(localDate);
      const timeLabel = localDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const countdown = formatCountdownLabel(
        wp.scheduledStartAtMs,
        wp.estimatedDurationMinutes,
        wp.status
      );

      const tone: UnifiedCalendarEvent['statusTone'] =
        lifecycle === 'cancelled'
          ? 'slate'
          : myPart
            ? 'emerald'
            : lifecycle === 'live'
              ? 'crimson'
              : 'amber';

      const statusLabel =
        lifecycle === 'cancelled'
          ? 'Cancelled'
          : lifecycle === 'completed'
            ? 'Completed'
            : myPart
              ? myPart.rsvpStatus === 'completed'
                ? 'Watched'
                : 'Attending'
              : lifecycle === 'live'
                ? 'Live Session'
                : countdown;

      events.push({
        id: `wp_${wp.id}`,
        kind: 'watch_party',
        title: wp.title,
        subtitle: `${wp.animeTitle}${wp.episodeNumber ? ` · Ep ${wp.episodeNumber}` : ''} · Independent watch`,
        dateKey,
        timestampMs: wp.scheduledStartAtMs || Date.now(),
        timeLabel,
        statusLabel,
        statusTone: tone,
        isCommunityHosted: Boolean(wp.communityId),
        isMine,
        watchPartyId: wp.id,
        communityName: wp.communityName,
      });
    }

    for (const item of schedules) {
      if (!item.media) continue;
      const dt = new Date(item.airingAt * 1000);
      const reminderId = `${item.media.id}_${item.episode}`;
      const hasReminder = reminders.some((r) => r.id === reminderId);

      events.push({
        id: `air_${item.id}`,
        kind: 'airing',
        title: `${item.media.title.display} — Ep ${item.episode}`,
        subtitle: item.media.genres.slice(0, 3).join(' · ') || 'AniList Airing',
        dateKey: toLocalDateKey(dt),
        timestampMs: item.airingAt * 1000,
        timeLabel: dt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        statusLabel: hasReminder ? 'Reminder Set' : 'Airing',
        statusTone: hasReminder ? 'emerald' : 'slate',
        isCommunityHosted: false,
        isMine: hasReminder,
      });
    }

    return events.sort((a, b) => a.timestampMs - b.timestampMs);
  }, [
    challenges,
    watchParties,
    schedules,
    reminders,
    myChallengeSet,
    myPartyMap,
    currentUserId,
  ]);

  const filteredUnifiedEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return unifiedEvents.filter((ev) => {
      if (
        eventFilter === 'challenges' &&
        ev.kind !== 'challenge_start' &&
        ev.kind !== 'challenge_end'
      ) {
        return false;
      }
      if (eventFilter === 'watch-parties' && ev.kind !== 'watch_party') {
        return false;
      }
      if (eventFilter === 'community' && !ev.isCommunityHosted) {
        return false;
      }
      if (eventFilter === 'mine' && !ev.isMine) {
        return false;
      }
      if (eventFilter === 'airing' && ev.kind !== 'airing') {
        return false;
      }
      if (!q) return true;
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.subtitle.toLowerCase().includes(q) ||
        (ev.communityName || '').toLowerCase().includes(q)
      );
    });
  }, [unifiedEvents, eventFilter, eventSearch]);

  const eventsByDayMap = useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    for (const ev of filteredUnifiedEvents) {
      const existing = map.get(ev.dateKey) || [];
      existing.push(ev);
      map.set(ev.dateKey, existing);
    }
    return map;
  }, [filteredUnifiedEvents]);

  // Month grid cells (Sunday-Saturday aligned)
  const monthGridCells = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startOffset = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{
      dateKey: string;
      dayNumber: number;
      inCurrentMonth: boolean;
    }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      cells.push({
        dateKey: toLocalDateKey(d),
        dayNumber: d.getDate(),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      cells.push({
        dateKey: toLocalDateKey(d),
        dayNumber: day,
        inCurrentMonth: true,
      });
    }

    while (cells.length % 7 !== 0) {
      const d = new Date(year, month, daysInMonth + (cells.length - startOffset - daysInMonth) + 1);
      cells.push({
        dateKey: toLocalDateKey(d),
        dayNumber: d.getDate(),
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [cursorMonth]);

  const selectedDayEvents = eventsByDayMap.get(selectedDayKey) || [];
  const todayKey = toLocalDateKey(new Date());
  const localTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time';
    } catch {
      return 'Local Time';
    }
  }, []);

  const filteredSchedules = schedules.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.media?.title.display.toLowerCase().includes(q) ||
      item.media?.genres.some((g: string) => g.toLowerCase().includes(q))
    );
  });

  const handleEventClick = (ev: UnifiedCalendarEvent) => {
    if (ev.challengeId) {
      if (onOpenChallenge) {
        onOpenChallenge(ev.challengeId);
      } else {
        onNavigateDestination('challenges');
      }
      return;
    }
    if (ev.watchPartyId) {
      if (onOpenWatchParty) {
        onOpenWatchParty(ev.watchPartyId);
      } else {
        onNavigateDestination('challenges');
      }
    }
  };

  const badgeToneClasses: Record<UnifiedCalendarEvent['statusTone'], string> = {
    crimson: 'bg-[#EF3038]/12 text-[#EF3038] border-[#EF3038]/30',
    emerald:
      'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    slate:
      'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342]',
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#171923] via-[#090B14] to-[#171923] border border-[#303342] p-6 sm:p-8">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EF3038]/15 text-[#EF3038] text-xs font-bold tracking-wide uppercase">
              <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ATA Companion &amp; Community Calendar</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Events, Watch Parties &amp; Release Schedules
            </h1>
            <p className="text-sm text-[#A7A9B8]">
              Track Challenge deadlines, independent Watch Parties, community events, and weekly AniList episode premieres in your local timezone ({localTz}).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateDestination('challenges')}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] transition-colors shrink-0 self-start lg:self-center"
          >
            <Trophy className="h-4 w-4" aria-hidden="true" />
            <span>Open Challenges &amp; Watch Parties</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'events'
              ? 'bg-[#EF3038] text-white shadow-sm'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
          }`}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>Community Events Calendar ({unifiedEvents.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'schedule'
              ? 'bg-[#EF3038] text-white shadow-sm'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
          }`}
        >
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>Weekly Airing Schedule ({schedules.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reminders')}
          className={`inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'reminders'
              ? 'bg-[#EF3038] text-white shadow-sm'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
          }`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span>My Reminders ({reminders.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seasonal')}
          className={`inline-flex items-center gap-2 px-4 py-2 min-h-[42px] text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'seasonal'
              ? 'bg-[#EF3038] text-white shadow-sm'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Seasonal Anime Planner</span>
        </button>
      </div>

      {/* Tab 0: Integrated ATA Community Events Calendar */}
      {activeTab === 'events' && (
        <div className="space-y-5">
          {/* Controls Row */}
          <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52576B] dark:text-[#A7A9B8]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  placeholder="Search challenges, watch parties, communities, or anime..."
                  className="w-full pl-10 pr-4 py-2 min-h-[42px] bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl text-xs sm:text-sm text-[#090B14] dark:text-white placeholder-[#52576B] focus:outline-none focus:border-[#EF3038]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-[#EF3038] text-white'
                        : 'text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Month Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      viewMode === 'list'
                        ? 'bg-[#EF3038] text-white'
                        : 'text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Agenda List</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category / Scope Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Events' },
                  { id: 'watch-parties', label: 'Watch Parties' },
                  { id: 'challenges', label: 'Challenges' },
                  { id: 'community', label: 'Community Hosted' },
                  { id: 'mine', label: 'My Joined / Attending' },
                  { id: 'airing', label: 'AniList Airing' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setEventFilter(chip.id)}
                  className={`px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-semibold border transition-colors ${
                    eventFilter === chip.id
                      ? 'bg-[#090B14] dark:bg-white text-white dark:text-[#090B14] border-transparent'
                      : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadingEvents && isLoadingSchedules ? (
            <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Loading challenges, watch parties, and airing schedules...
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
              {/* Month Grid */}
              <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                    {cursorMonth.toLocaleDateString([], {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCursorMonth(
                          (prev) =>
                            new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                        )
                      }
                      aria-label="Previous month"
                      className="p-2 min-h-[36px] min-w-[36px] rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038]"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        setSelectedDayKey(toLocalDateKey(now));
                      }}
                      className="px-3 py-1.5 min-h-[36px] rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038]"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCursorMonth(
                          (prev) =>
                            new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                      }
                      aria-label="Next month"
                      className="p-2 min-h-[36px] min-w-[36px] rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038]"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {monthGridCells.map((cell) => {
                    const dayEvents = eventsByDayMap.get(cell.dateKey) || [];
                    const isToday = cell.dateKey === todayKey;
                    const isSelected = cell.dateKey === selectedDayKey;
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => setSelectedDayKey(cell.dateKey)}
                        className={`min-h-[76px] sm:min-h-[88px] rounded-xl border p-1.5 text-left flex flex-col justify-between transition-colors ${
                          isSelected
                            ? 'border-[#EF3038] bg-[#EF3038]/8 dark:bg-[#EF3038]/12'
                            : isToday
                              ? 'border-[#090B14] dark:border-white/50 bg-[#F4F5F8] dark:bg-[#090B14]'
                              : 'border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8]/60 dark:bg-[#090B14]/70 hover:border-[#EF3038]/60'
                        } ${!cell.inCurrentMonth ? 'opacity-45' : ''}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`text-xs font-bold tabular-nums ${
                              isToday
                                ? 'text-[#EF3038]'
                                : 'text-[#090B14] dark:text-white'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {dayEvents.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 rounded bg-[#EF3038]/15 text-[#EF3038] tabular-nums">
                              {dayEvents.length}
                            </span>
                          )}
                        </div>

                        <div className="space-y-0.5 w-full overflow-hidden">
                          {dayEvents.slice(0, 2).map((ev) => (
                            <div
                              key={ev.id}
                              className={`text-[10px] font-semibold truncate px-1 py-0.5 rounded ${
                                ev.kind === 'watch_party'
                                  ? 'bg-[#EF3038]/15 text-[#EF3038]'
                                  : ev.kind === 'airing'
                                    ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {ev.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[9px] text-[#52576B] dark:text-[#A7A9B8] font-medium px-1">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Day Agenda Sidebar */}
              <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-2.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#EF3038]">
                      Selected Date
                    </p>
                    <h3 className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
                      {selectedDayKey}
                    </h3>
                  </div>
                  <span className="text-xs text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                    {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'}
                  </span>
                </div>

                {selectedDayEvents.length === 0 ? (
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-6 text-center">
                    No challenges, watch parties, or scheduled airings match your filters on this date.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {selectedDayEvents.map((ev) => {
                      const clickable = Boolean(ev.challengeId || ev.watchPartyId);
                      return (
                        <div
                          key={ev.id}
                          onClick={clickable ? () => handleEventClick(ev) : undefined}
                          role={clickable ? 'button' : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          onKeyDown={
                            clickable
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleEventClick(ev);
                                  }
                                }
                              : undefined
                          }
                          className={`rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3 space-y-1.5 ${
                            clickable
                              ? 'cursor-pointer hover:border-[#EF3038] transition-colors'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeToneClasses[ev.statusTone]}`}
                            >
                              {ev.statusLabel}
                            </span>
                            <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                              {ev.timeLabel}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-[#090B14] dark:text-white leading-snug">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                            {ev.subtitle}
                          </p>
                          {ev.communityName && (
                            <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#EF3038]">
                              <Users className="h-3 w-3" aria-hidden="true" />
                              <span>{ev.communityName}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* List / Agenda View */
            <div className="space-y-3">
              {filteredUnifiedEvents.length === 0 ? (
                <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl py-14 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  No calendar events match your current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUnifiedEvents.slice(0, 80).map((ev) => {
                    const clickable = Boolean(ev.challengeId || ev.watchPartyId);
                    return (
                      <div
                        key={ev.id}
                        className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[#EF3038] transition-colors"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${badgeToneClasses[ev.statusTone]}`}
                            >
                              {ev.kind === 'watch_party' ? (
                                <Tv className="h-3 w-3" aria-hidden="true" />
                              ) : ev.kind === 'airing' ? (
                                <Globe className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Trophy className="h-3 w-3" aria-hidden="true" />
                              )}
                              <span>{ev.statusLabel}</span>
                            </span>
                            <span className="text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                              {ev.dateKey} · {ev.timeLabel}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
                            {ev.title}
                          </h3>
                          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                            {ev.subtitle}
                          </p>
                          {ev.communityName && (
                            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#EF3038]">
                              <Users className="h-3 w-3" aria-hidden="true" />
                              <span>Community: {ev.communityName}</span>
                            </p>
                          )}
                        </div>

                        {clickable && (
                          <button
                            type="button"
                            onClick={() => handleEventClick(ev)}
                            className="w-full py-2 min-h-[38px] rounded-xl text-xs font-semibold bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
                          >
                            {ev.challengeId ? 'Open Challenge' : 'Open Watch Party'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Weekly Airing Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52576B] dark:text-[#A7A9B8]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search airing anime or genres..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-xl text-xs sm:text-sm text-[#090B14] dark:text-white placeholder-[#52576B] focus:outline-none focus:border-[#EF3038]"
              />
            </div>
          </div>

          {isLoadingSchedules ? (
            <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Loading live AniList airing schedules...
            </div>
          ) : filteredSchedules.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No airing schedule items found for this week.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchedules.map((item) => {
                if (!item.media) return null;
                const airingDate = new Date(item.airingAt * 1000);
                const timeString = airingDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const dateString = airingDate.toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const reminderId = `${item.media.id}_${item.episode}`;
                const hasReminder = reminders.some((r) => r.id === reminderId);

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 flex gap-4 items-start shadow-sm hover:border-[#EF3038] transition-colors"
                  >
                    <img
                      src={item.media.coverImage.best || ''}
                      alt={item.media.title.display}
                      className="w-20 h-28 object-cover rounded-xl shrink-0 bg-[#D4D7E2] dark:bg-[#303342]"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#EF3038]/10 text-[#EF3038] text-[10px] font-bold">
                          Episode {item.episode}
                        </span>
                        <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                          {dateString} · {timeString}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#090B14] dark:text-white truncate">
                        {item.media.title.display}
                      </h3>
                      <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-1">
                        {item.media.genres.join(' · ')}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleReminder(
                            item.media!,
                            item.episode,
                            item.airingAt
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          hasReminder
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#090B14] dark:bg-white text-white dark:text-[#090B14] hover:bg-[#EF3038] dark:hover:bg-[#EF3038] dark:hover:text-white'
                        }`}
                      >
                        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{hasReminder ? 'Reminder Set' : 'Set Reminder'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Reminders */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          {!currentUserId ? (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8">
              <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
                Sign in to sync and manage your personalized episode watch reminders and Watch Party alerts across devices.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 bg-[#EF3038] text-white text-xs font-semibold rounded-xl hover:bg-[#B92335] transition-colors"
              >
                Sign In to ATA
              </button>
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8">
              <Bell
                className="h-8 w-8 text-[#52576B] dark:text-[#A7A9B8] mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-[#090B14] dark:text-white">
                No reminders active
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Browse the weekly airing schedule or join a Watch Party to automatically track upcoming reminders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reminders.map((rem) => {
                const airingDate = new Date(rem.airingAt * 1000);
                const isWatchPartyReminder = rem.id.startsWith('wp_');
                return (
                  <div
                    key={rem.id}
                    className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 flex gap-4 items-start shadow-sm"
                  >
                    <img
                      src={rem.animeCoverUrl || ''}
                      alt={rem.animeTitle}
                      className="w-16 h-24 object-cover rounded-xl shrink-0 bg-[#D4D7E2] dark:bg-[#303342]"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-[#EF3038]/10 text-[#EF3038] text-[10px] font-bold">
                          {isWatchPartyReminder
                            ? 'Watch Party'
                            : `Episode ${rem.episodeNumber}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => void deleteWatchReminder(currentUserId, rem.id)}
                          aria-label="Delete reminder"
                          className="p-1 rounded-lg text-[#52576B] hover:text-[#EF3038] hover:bg-[#EF3038]/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <h3 className="text-sm font-bold text-[#090B14] dark:text-white truncate">
                        {rem.animeTitle}
                      </h3>
                      <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                        Starts:{' '}
                        {airingDate.toLocaleString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Seasonal Anime Planner */}
      {activeTab === 'seasonal' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#090B14] dark:text-white">
              Current Cour Seasonal Lineup
            </h2>
          </div>

          {isLoadingSeasonal ? (
            <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Loading seasonal catalogue...
            </div>
          ) : seasonalAnime.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No seasonal anime found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {seasonalAnime.map((anime) => (
                <div
                  key={anime.id}
                  className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm hover:border-[#EF3038] transition-colors flex flex-col"
                >
                  <img
                    src={anime.coverImage.best || ''}
                    alt={anime.title.display}
                    className="w-full h-48 object-cover bg-[#D4D7E2] dark:bg-[#303342]"
                  />
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                        <span>{anime.formatLabel}</span>
                        <span>⭐ {anime.averageScore ? `${anime.averageScore}%` : 'TBA'}</span>
                      </div>
                      <h3 className="text-xs font-bold text-[#090B14] dark:text-white line-clamp-2">
                        {anime.title.display}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateDestination('anime-tracker')}
                      className="w-full py-1.5 px-2 bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl text-[11px] font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors text-center"
                    >
                      Track in Watchlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

