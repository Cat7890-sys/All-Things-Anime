import React, { useEffect, useState } from 'react';
import {
  Award,
  CheckCircle,
  Clock,
  Compass,
  Film,
  Flame,
  Footprints,
  Star,
  Trophy,
  Tv,
} from 'lucide-react';
import type { NavDestinationId, UserAnimeListItem, WatchJourneyMilestone } from '../types';
import { subscribeToUserAnimeList } from '../services/personalisation/animeTrackerService';
import { calculateWatchJourneyMilestones } from '../services/companion/watchJourneyService';
import { useAuth } from '../hooks/useAuth';

interface WatchJourneyPageProps {
  currentUserId?: string;
  onOpenAuth: () => void;
  onNavigateDestination: (id: NavDestinationId) => void;
}

export const WatchJourneyPage: React.FC<WatchJourneyPageProps> = ({
  currentUserId,
  onOpenAuth,
  onNavigateDestination,
}) => {
  const [items, setItems] = useState<UserAnimeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    const unsub = subscribeToUserAnimeList(
      currentUserId,
      (list) => {
        setItems(list);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );
    return () => {
      unsub();
    };
  }, [currentUserId]);

  const milestones: WatchJourneyMilestone[] = calculateWatchJourneyMilestones(items);
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const watchingCount = items.filter((i) => i.status === 'watching').length;
  const totalEpisodes = items.reduce((sum, i) => sum + (i.episodesWatched || 0), 0);
  const averageRating =
    items.filter((i) => typeof i.userRating === 'number' && i.userRating > 0).length > 0
      ? (
          items.reduce((sum, i) => sum + (i.userRating || 0), 0) /
          items.filter((i) => typeof i.userRating === 'number' && i.userRating > 0).length
        ).toFixed(1)
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#171923] via-[#090B14] to-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 sm:p-8">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EF3038]/10 text-[#EF3038] text-xs font-bold tracking-wide uppercase">
            <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Personal Watch Journey</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white">
            Milestones & Viewing Analytics
          </h1>
          <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Explore your anime viewing milestones, cumulative watch time, genre distribution, and tracker progress across the ATA universe.
          </p>
        </div>
      </div>

      {!currentUserId ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8">
          <p className="text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Sign in to track your personal anime watch journey, milestones, and viewing statistics.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-4 py-2 bg-[#EF3038] text-white text-xs font-semibold rounded-xl hover:bg-[#B92335] transition-colors"
          >
            Sign In to ATA
          </button>
        </div>
      ) : isLoading ? (
        <div className="py-16 text-center text-xs text-[#52576B] dark:text-[#A7A9B8]">
          Loading watch journey analytics...
        </div>
      ) : (
        <>
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-1 shadow-sm">
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">Series Tracked</span>
              <p className="text-2xl font-black text-[#090B14] dark:text-white">{items.length}</p>
            </div>
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-1 shadow-sm">
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">Completed Series</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{completedCount}</p>
            </div>
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-1 shadow-sm">
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">Episodes Watched</span>
              <p className="text-2xl font-black text-[#EF3038]">{totalEpisodes}</p>
            </div>
            <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-4 space-y-1 shadow-sm">
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8]">Average Score</span>
              <p className="text-2xl font-black text-amber-500">⭐ {averageRating}</p>
            </div>
          </div>

          {/* Milestones Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#090B14] dark:text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#EF3038]" aria-hidden="true" />
              <span>Watch Journey Milestones</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`bg-white dark:bg-[#171923] border rounded-2xl p-5 flex gap-4 items-start shadow-sm transition-colors ${
                    m.achieved
                      ? 'border-emerald-500/50 bg-emerald-500/[0.02]'
                      : 'border-[#D4D7E2] dark:border-[#303342]'
                  }`}
                >
                  <span className="text-3xl p-2 rounded-2xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] shrink-0">
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#090B14] dark:text-white truncate">
                        {m.title}
                      </h3>
                      {m.achieved && (
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                      {m.description}
                    </p>
                    <p className={`text-[11px] font-bold ${m.achieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#52576B] dark:text-[#A7A9B8]'}`}>
                      {m.progressText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Tracker Activity */}
          <div className="space-y-4 pt-2">
            <h2 className="text-lg font-bold text-[#090B14] dark:text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#EF3038]" aria-hidden="true" />
              <span>Recent Watchlist Activity</span>
            </h2>

            {items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#52576B] dark:text-[#A7A9B8] bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6">
                No watchlist activity recorded yet. Head over to the Watchlist or Discover tab to start adding series!
              </div>
            ) : (
              <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#D4D7E2] dark:divide-[#303342]">
                {items.slice(0, 5).map((item) => (
                  <div key={item.animeId} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.animeCoverUrl}
                        alt={item.animeTitle}
                        className="w-10 h-14 object-cover rounded-lg shrink-0 bg-[#D4D7E2] dark:bg-[#303342]"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                          {item.animeTitle}
                        </p>
                        <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] capitalize">
                          Status: {item.status.replace('_', ' ')} · Ep {item.episodesWatched} / {item.totalEpisodes ?? '?'}
                        </p>
                      </div>
                    </div>
                    {item.userRating && (
                      <span className="text-xs font-bold text-amber-500 shrink-0">
                        ⭐ {item.userRating}/10
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
