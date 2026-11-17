import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Flame,
  Heart,
  Layers,
  LayoutDashboard,
  Loader2,
  Play,
  Plus,
  Sliders,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import {
  calculatePersonalInsights,
  incrementWatchedEpisode,
  subscribeToUserAnimeList,
} from '../services/personalisation/animeTrackerService';
import {
  getUserCollections,
  subscribeToUserCollections,
} from '../services/personalisation/collectionService';
import {
  generateAnimeRecommendations,
  getUserRecommendationFeedback,
  recordRecommendationFeedback,
} from '../services/personalisation/recommendationService';
import type {
  AnimeRecommendation,
  NavDestinationId,
  PersonalAnimeInsights,
  RecommendationFeedbackType,
  UserAnimeListItem,
  UserCollection,
} from '../types';

interface MyAnimeDashboardPageProps {
  currentUserId?: string;
  onOpenAuth?: () => void;
  onNavigateDestination?: (id: NavDestinationId) => void;
}

export const MyAnimeDashboardPage: React.FC<MyAnimeDashboardPageProps> = ({
  currentUserId,
  onOpenAuth,
  onNavigateDestination,
}) => {
  const { preferences, updatePreferences } = usePreferences();
  const [watchlistItems, setWatchlistItems] = useState<UserAnimeListItem[]>([]);
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [recommendations, setRecommendations] = useState<AnimeRecommendation[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, RecommendationFeedbackType>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to watchlist and collections
  useEffect(() => {
    if (!currentUserId) {
      setWatchlistItems([]);
      setCollections([]);
      setIsLoading(false);
      return;
    }

    const unsubList = subscribeToUserAnimeList(
      currentUserId,
      (list) => {
        setWatchlistItems(list);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    const unsubCols = subscribeToUserCollections(
      currentUserId,
      (cols) => {
        setCollections(cols);
      },
      () => {}
    );

    getUserRecommendationFeedback(currentUserId).then(setFeedbackMap);

    return () => {
      unsubList();
      unsubCols();
    };
  }, [currentUserId]);

  // Compute recommendations
  useEffect(() => {
    generateAnimeRecommendations(preferences, watchlistItems, feedbackMap)
      .then(setRecommendations)
      .catch(() => {});
  }, [preferences, watchlistItems, feedbackMap]);

  // Insights calculation
  const insights: PersonalAnimeInsights = useMemo(() => {
    return calculatePersonalInsights(watchlistItems, collections.length);
  }, [watchlistItems, collections.length]);

  const currentlyWatching = useMemo(() => {
    return watchlistItems.filter((it) => it.status === 'watching');
  }, [watchlistItems]);

  const handleIncrement = async (e: React.MouseEvent, animeId: string) => {
    e.stopPropagation();
    if (!currentUserId) return;
    await incrementWatchedEpisode(currentUserId, animeId);
  };

  const handleFeedback = async (
    animeId: string,
    type: RecommendationFeedbackType
  ) => {
    if (!currentUserId) return;
    setFeedbackMap((prev) => ({ ...prev, [animeId]: type }));
    await recordRecommendationFeedback(currentUserId, animeId, type);
  };

  const isWidgetEnabled = (id: string) => {
    const w = (preferences.dashboardWidgets || []).find((widget) => widget.id === id);
    return w ? w.enabled : true;
  };

  if (!currentUserId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <LayoutDashboard className="h-12 w-12 text-[#EF3038] mx-auto" />
        <h2 className="text-2xl font-bold text-[#090B14] dark:text-white">
          Personal Anime Dashboard
        </h2>
        <p className="text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
          Sign in to view your anime progress, custom recommendations, watchlist widgets, and transparent activity statistics.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] shadow-md"
        >
          Sign In to Open Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#D4D7E2] dark:border-[#303342] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-accent-orbitron text-xs font-bold tracking-widest text-[#EF3038] uppercase">
              Command Deck
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white tracking-tight mt-1">
            My Anime
          </h1>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Your personal anime activity hub, continue-watching queue, and recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateDestination?.('anime-tracker')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
          >
            Tracker
          </button>
          <button
            type="button"
            onClick={() => onNavigateDestination?.('personalisation')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors shadow-sm"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Watching
          </p>
          <p className="text-2xl font-black text-[#EF3038] tabular-nums mt-1">
            {insights.totalWatching}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Completed
          </p>
          <p className="text-2xl font-black text-emerald-500 tabular-nums mt-1">
            {insights.totalCompleted}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Plan to Watch
          </p>
          <p className="text-2xl font-black text-sky-400 tabular-nums mt-1">
            {insights.totalPlanning}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Eps Logged
          </p>
          <p className="text-2xl font-black text-white tabular-nums mt-1">
            {insights.totalEpisodesWatched}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Mean Rating
          </p>
          <p className="text-2xl font-black text-amber-400 tabular-nums mt-1">
            {insights.averageRating ? `${insights.averageRating}★` : '—'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Collections
          </p>
          <p className="text-2xl font-black text-violet-400 tabular-nums mt-1">
            {insights.totalCollections}
          </p>
        </div>
      </div>

      {/* Widget 1: Continue Watching Queue */}
      {isWidgetEnabled('continue_watching') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-[#EF3038]" />
              <h2 className="text-base font-bold text-[#090B14] dark:text-white">
                Continue Watching
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateDestination?.('anime-tracker')}
              className="text-xs font-semibold text-[#EF3038] hover:underline"
            >
              Open Tracker →
            </button>
          </div>

          {currentlyWatching.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-2">
              <p className="text-xs font-bold text-[#090B14] dark:text-white">
                No series currently marked as watching
              </p>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Add anime to your watchlist to track episodes and resume anytime.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentlyWatching.slice(0, 6).map((item) => {
                const hasTotal = item.totalEpisodes !== null && item.totalEpisodes > 0;
                const pct = hasTotal
                  ? Math.round((item.episodesWatched / item.totalEpisodes!) * 100)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] flex items-center gap-3.5"
                  >
                    <img
                      src={item.animeCoverUrl}
                      alt={item.animeTitle}
                      className="h-16 w-12 rounded-xl object-cover shrink-0 bg-black/20"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                        {item.animeTitle}
                      </p>
                      <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums font-medium">
                        Ep {item.episodesWatched} of {hasTotal ? item.totalEpisodes : '??'} {pct !== null && `(${pct}%)`}
                      </p>
                      {pct !== null && (
                        <div className="h-1.5 w-full bg-[#D4D7E2] dark:bg-[#303342] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#EF3038] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => void handleIncrement(e, item.animeId)}
                      title="Mark next episode watched"
                      className="h-9 w-9 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Widget 2: Recommended For You */}
      {isWidgetEnabled('recommendations') && preferences.recommendationsEnabled && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#EF3038]" />
              <h2 className="text-base font-bold text-[#090B14] dark:text-white">
                Recommended For You
              </h2>
            </div>
            <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Transparent signals based on your preferences
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec) => {
              const animeIdStr = String(rec.anime.id);
              return (
                <div
                  key={rec.anime.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="aspect-[16/9] w-full rounded-xl overflow-hidden bg-black/20 relative">
                      <img
                        src={rec.anime.coverImage.large || rec.anime.coverImage.extraLarge || ''}
                        alt={rec.anime.title.display}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-md bg-black/70 text-white">
                        {rec.reasonCategory}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                        {rec.anime.title.display}
                      </h3>
                      <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] line-clamp-2 mt-0.5">
                        {rec.reasonDetail}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between text-xs">
                    <span className="text-[10px] font-semibold text-[#52576B] dark:text-[#A7A9B8]">
                      Score: {rec.anime.averageScore ? `${rec.anime.averageScore}%` : '—'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Like recommendation"
                        onClick={() => void handleFeedback(animeIdStr, 'like')}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          feedbackMap[animeIdStr] === 'like'
                            ? 'border-[#EF3038] text-[#EF3038] bg-[#EF3038]/10'
                            : 'border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8]'
                        }`}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Not interested"
                        onClick={() => void handleFeedback(animeIdStr, 'not_interested')}
                        className="p-1.5 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Widget 3: Personal Anime Insights & Visual Stats */}
      {isWidgetEnabled('personal_stats') && (
        <section className="p-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#090B14] dark:text-white">
              Personal Anime Insights
            </h2>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Ground-truth analytics from your own logged watchlist entries. No competitive pressure or streak mechanics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Genre breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider">
                Top Logged Genres
              </h3>
              {Object.keys(insights.genreDistribution).length === 0 ? (
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Track series in your watchlist to see your genre breakdown.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(insights.genreDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([genre, count]) => {
                      const maxCount = Math.max(...Object.values(insights.genreDistribution));
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={genre} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[#090B14] dark:text-white">{genre}</span>
                            <span className="text-[#52576B] dark:text-[#A7A9B8] tabular-nums">{count} anime</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#D4D7E2] dark:bg-[#303342] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#EF3038] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Ratings distribution histogram */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider">
                Your Ratings Distribution
              </h3>
              {Object.keys(insights.ratingDistribution).length === 0 ? (
                <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Rate series in your tracker (1-10) to visualize your rating curve.
                </p>
              ) : (
                <div className="flex items-end gap-1 h-28 pt-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => {
                    const count = insights.ratingDistribution[star] || 0;
                    const maxVal = Math.max(1, ...Object.values(insights.ratingDistribution));
                    const heightPct = Math.round((count / maxVal) * 100);

                    return (
                      <div key={star} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[9px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums font-bold">
                          {count > 0 ? count : ''}
                        </span>
                        <div
                          className="w-full bg-[#EF3038] rounded-t transition-all duration-300"
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                        />
                        <span className="text-[10px] font-bold text-[#090B14] dark:text-white">
                          {star}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Widget 4: My Collections Preview */}
      {isWidgetEnabled('recent_collections') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#EF3038]" />
              <h2 className="text-base font-bold text-[#090B14] dark:text-white">
                My Collections
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateDestination?.('collections')}
              className="text-xs font-semibold text-[#EF3038] hover:underline"
            >
              All Collections →
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-2">
              <p className="text-xs font-bold text-[#090B14] dark:text-white">
                No custom lists created yet
              </p>
              <button
                type="button"
                onClick={() => onNavigateDestination?.('collections')}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335]"
              >
                Create a Collection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {collections.slice(0, 3).map((col) => (
                <div
                  key={col.id}
                  onClick={() => onNavigateDestination?.('collections')}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] cursor-pointer hover:border-[#EF3038] transition-colors space-y-2"
                >
                  <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                    {col.title}
                  </p>
                  <p className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                    {col.itemCount} anime · {col.visibility}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
