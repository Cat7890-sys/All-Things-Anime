import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Filter,
  Flame,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Tv,
} from 'lucide-react';
import type { NavDestinationId, WatchReminder } from '../types';
import type { NormalizedAnime } from '../services/catalogue/anilistTypes';
import {
  fetchAiringSchedules,
  subscribeToUserReminders,
  upsertWatchReminder,
  deleteWatchReminder,
  type AiringScheduleItem,
} from '../services/companion/calendarService';
import {
  getCurrentAnimeSeason,
  createAniListClient,
} from '../services/catalogue/anilistService';
import { useAuth } from '../hooks/useAuth';

interface CalendarPageProps {
  currentUserId?: string;
  onOpenAuth: () => void;
  onNavigateDestination: (id: NavDestinationId) => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  currentUserId,
  onOpenAuth,
  onNavigateDestination,
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'reminders' | 'seasonal'>('schedule');
  const [schedules, setSchedules] = useState<AiringScheduleItem[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [reminders, setReminders] = useState<WatchReminder[]>([]);
  const [seasonalAnime, setSeasonalAnime] = useState<NormalizedAnime[]>([]);
  const [isLoadingSeasonal, setIsLoadingSeasonal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleToggleReminder = async (anime: NormalizedAnime, episodeNum: number, airingAtSec: number) => {
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

  const filteredSchedules = schedules.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.media?.title.display.toLowerCase().includes(q) || item.media?.genres.some((g: string) => g.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#171923] via-[#090B14] to-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 sm:p-8">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EF3038]/10 text-[#EF3038] text-xs font-bold tracking-wide uppercase">
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Companion Release Calendar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white">
            Airing Schedules & Watch Reminders
          </h1>
          <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Never miss an episode premiere. Track weekly countdowns in your local timezone, manage custom release alerts, and explore current seasonal lineups.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
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
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
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
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
            activeTab === 'seasonal'
              ? 'bg-[#EF3038] text-white shadow-sm'
              : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Seasonal Anime Planner</span>
        </button>
      </div>

      {/* Tab 1: Weekly Airing Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52576B] dark:text-[#A7A9B8]" aria-hidden="true" />
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
                const timeString = airingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateString = airingDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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
                        onClick={() => void handleToggleReminder(item.media!, item.episode, item.airingAt)}
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
                Sign in to sync and manage your personalized episode watch reminders across devices.
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
              <Bell className="h-8 w-8 text-[#52576B] dark:text-[#A7A9B8] mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#090B14] dark:text-white">No reminders active</p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Browse the weekly airing schedule and click "Set Reminder" on any episode you want to track.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reminders.map((rem) => {
                const airingDate = new Date(rem.airingAt * 1000);
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
                          Episode {rem.episodeNumber}
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
                        Airs: {airingDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
