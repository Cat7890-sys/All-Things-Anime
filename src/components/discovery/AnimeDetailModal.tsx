import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Film,
  Plus,
  Star,
  TrendingUp,
  X,
  Check,
  Bookmark,
} from 'lucide-react';
import {
  anilistService,
  formatAnimeEpisodes,
  formatTimeUntilAiring,
} from '../../services/catalogue/anilistService';
import type { NormalizedAnime } from '../../services/catalogue/anilistTypes';
import { MangaImage } from '../MangaImage';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserAnimeList,
  incrementWatchedEpisode,
  upsertAnimeListItem,
} from '../../services/personalisation/animeTrackerService';
import { getSimilarAnimeForDetail } from '../../services/personalisation/recommendationService';
import type { AnimeRecommendation, WatchlistStatus } from '../../types';

interface AnimeDetailModalProps {
  anime: NormalizedAnime | null;
  onClose: () => void;
  onSelectAnime?: (anime: NormalizedAnime) => void;
}

export const AnimeDetailModal: React.FC<AnimeDetailModalProps> = ({
  anime,
  onClose,
  onSelectAnime,
}) => {
  const { firebaseUser } = useAuth();
  const [resolvedAnime, setResolvedAnime] = useState<NormalizedAnime | null>(
    anime
  );
  const [userTrackStatus, setUserTrackStatus] = useState<WatchlistStatus | null>(null);
  const [userEpisodesWatched, setUserEpisodesWatched] = useState<number>(0);
  const [similarAnimeList, setSimilarAnimeList] = useState<AnimeRecommendation[]>([]);
  const [isUpdatingTracker, setIsUpdatingTracker] = useState(false);
  const [trackerMessage, setTrackerMessage] = useState<string | null>(null);

  useEffect(() => {
    setResolvedAnime(anime);
    setUserTrackStatus(null);
    setUserEpisodesWatched(0);
    setTrackerMessage(null);
    if (!anime) return;

    const controller = new AbortController();
    void anilistService
      .getAnimeById(anime.id, { signal: controller.signal })
      .then((res) => {
        if (res.anime) {
          setResolvedAnime((prev) =>
            prev && prev.id === res.anime!.id
              ? {
                  ...res.anime!,
                  trendingRank: res.anime!.trendingRank ?? prev.trendingRank,
                }
              : res.anime
          );
        }
      })
      .catch(() => {});

    if (firebaseUser) {
      void getUserAnimeList(firebaseUser.uid).then((list) => {
        const found = list.find(
          (it) => String(it.animeId) === String(anime.id)
        );
        if (found) {
          setUserTrackStatus(found.status);
          setUserEpisodesWatched(found.episodesWatched);
        }
      });
    }

    void getSimilarAnimeForDetail(anime, [], {}).then(setSimilarAnimeList);

    return () => {
      controller.abort();
    };
  }, [anime, firebaseUser]);

  useEffect(() => {
    if (!anime) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [anime, onClose]);

  if (!anime || !resolvedAnime) return null;

  const handleQuickTrack = async (status: WatchlistStatus) => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    setIsUpdatingTracker(true);
    try {
      const isCompleted = status === 'completed';
      const episodesWatched = isCompleted
        ? resolvedAnime.episodes || userEpisodesWatched
        : userEpisodesWatched;

      await upsertAnimeListItem(firebaseUser.uid, {
        animeId: String(resolvedAnime.id),
        animeTitle: resolvedAnime.title.display,
        animeCoverUrl: resolvedAnime.coverImage.best || '',
        genres: resolvedAnime.genres,
        studios: resolvedAnime.studios,
        format: resolvedAnime.formatLabel,
        seasonYear: resolvedAnime.seasonYear,
        totalEpisodes: resolvedAnime.episodes,
        episodesWatched,
        status,
        userRating: null,
      });

      setUserTrackStatus(status);
      setUserEpisodesWatched(episodesWatched);
      setTrackerMessage(`Updated watchlist status to ${status.replace('_', ' ')}.`);
      setTimeout(() => setTrackerMessage(null), 3000);
    } catch (err) {
      setTrackerMessage(err instanceof Error ? err.message : 'Failed to update tracker.');
    } finally {
      setIsUpdatingTracker(false);
    }
  };

  const handleQuickIncrement = async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    setIsUpdatingTracker(true);
    try {
      const next = await incrementWatchedEpisode(firebaseUser.uid, String(resolvedAnime.id));
      setUserEpisodesWatched(next);
      setUserTrackStatus('watching');
      setTrackerMessage(`Incremented watched episode to ${next}.`);
      setTimeout(() => setTrackerMessage(null), 3000);
    } catch (err) {
      setTrackerMessage(err instanceof Error ? err.message : 'Failed to increment episode.');
    } finally {
      setIsUpdatingTracker(false);
    }
  };

  const altTitles: string[] = [];
  if (
    resolvedAnime.title.romaji &&
    resolvedAnime.title.romaji !== resolvedAnime.title.display
  ) {
    altTitles.push(resolvedAnime.title.romaji);
  }
  if (
    resolvedAnime.title.native &&
    resolvedAnime.title.native !== resolvedAnime.title.display &&
    resolvedAnime.title.native !== resolvedAnime.title.romaji
  ) {
    altTitles.push(resolvedAnime.title.native);
  }

  const descriptionParagraphs = resolvedAnime.description
    ? resolvedAnime.description.split(/\n{2,}/).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anilist-detail-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-5">
            <div className="sm:col-span-2 border-b sm:border-b-0 sm:border-r border-[#D4D7E2] dark:border-[#303342] bg-[#EAECEF] dark:bg-[#090B14]">
              <MangaImage
                src={resolvedAnime.coverImage.best || ''}
                alt={`${resolvedAnime.title.display} cover artwork`}
                aspectClassName="aspect-[3/4] sm:h-full"
                fallbackTitle={resolvedAnime.title.display}
              />
            </div>

            <div className="sm:col-span-3 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                {/* Modal Top Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-accent-orbitron text-[11px] font-semibold tracking-wider text-[#B92335] dark:text-[#EF3038] uppercase">
                        {resolvedAnime.formatLabel}
                      </span>
                      <span aria-hidden="true" className="text-[#52576B]">
                        ·
                      </span>
                      <span className="text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8]">
                        {resolvedAnime.statusLabel}
                      </span>
                    </div>

                    <h2
                      id="anilist-detail-modal-title"
                      className="mt-1 font-display-space font-bold text-xl sm:text-2xl leading-tight text-[#090B14] dark:text-white"
                    >
                      {resolvedAnime.title.display}
                    </h2>

                    {altTitles.length > 0 && (
                      <p className="mt-1 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                        {altTitles.join(' · ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close anime details"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Quick Watchlist Bar */}
                {firebaseUser && firebaseUser.emailVerified && (
                  <div className="p-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#090B14] dark:text-white">
                      <span className="flex items-center gap-1.5">
                        <Bookmark className="h-3.5 w-3.5 text-[#EF3038]" />
                        <span>Watchlist: {userTrackStatus ? userTrackStatus.replace('_', ' ') : 'Not Tracked'}</span>
                      </span>
                      {userTrackStatus && (
                        <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                          Ep {userEpisodesWatched}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isUpdatingTracker}
                        onClick={() => void handleQuickTrack('watching')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          userTrackStatus === 'watching'
                            ? 'bg-[#EF3038] text-white border-[#B92335]'
                            : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-white border-[#D4D7E2] dark:border-[#303342]'
                        }`}
                      >
                        Watching
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingTracker}
                        onClick={() => void handleQuickTrack('planning')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          userTrackStatus === 'planning'
                            ? 'bg-[#EF3038] text-white border-[#B92335]'
                            : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-white border-[#D4D7E2] dark:border-[#303342]'
                        }`}
                      >
                        Plan to Watch
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingTracker}
                        onClick={() => void handleQuickTrack('completed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          userTrackStatus === 'completed'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-white dark:bg-[#171923] text-[#090B14] dark:text-white border-[#D4D7E2] dark:border-[#303342]'
                        }`}
                      >
                        Completed
                      </button>

                      {userTrackStatus && (
                        <button
                          type="button"
                          disabled={isUpdatingTracker}
                          onClick={() => void handleQuickIncrement()}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="h-3 w-3" />
                          <span>+1 Ep</span>
                        </button>
                      )}
                    </div>

                    {trackerMessage && (
                      <p className="text-[11px] font-semibold text-emerald-500">
                        {trackerMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* Key Score / Rank Highlight Strip */}
                {(resolvedAnime.averageScore !== null ||
                  resolvedAnime.trendingRank !== null ||
                  resolvedAnime.nextAiringEpisode) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {resolvedAnime.averageScore !== null && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-display-space font-bold text-[#090B14] dark:text-white tabular-nums">
                        <Star
                          className="h-3.5 w-3.5 text-[#EF3038] fill-[#EF3038]"
                          aria-hidden="true"
                        />
                        {resolvedAnime.averageScore}% Score
                      </span>
                    )}

                    {resolvedAnime.trendingRank !== null && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EF3038]/10 border border-[#EF3038]/30 text-xs font-display-space font-bold text-[#B92335] dark:text-[#EF3038] tabular-nums">
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                        Trending #{resolvedAnime.trendingRank}
                      </span>
                    )}

                    {resolvedAnime.nextAiringEpisode && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white">
                        <Clock
                          className="h-3.5 w-3.5 text-[#EF3038]"
                          aria-hidden="true"
                        />
                        Ep {resolvedAnime.nextAiringEpisode.episode} in{' '}
                        {formatTimeUntilAiring(
                          resolvedAnime.nextAiringEpisode.timeUntilAiring
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Metadata Grid */}
                <dl className="grid grid-cols-2 gap-3 border-y border-[#D4D7E2] dark:border-[#303342] py-3 text-xs">
                  <div>
                    <dt className="text-[#52576B] dark:text-[#A7A9B8] flex items-center gap-1">
                      <Film className="h-3 w-3" aria-hidden="true" />
                      <span>Episodes</span>
                    </dt>
                    <dd className="font-display-space font-semibold text-[#090B14] dark:text-white tabular-nums mt-0.5">
                      {formatAnimeEpisodes(
                        resolvedAnime.episodes,
                        resolvedAnime.status
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[#52576B] dark:text-[#A7A9B8] flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      <span>Season</span>
                    </dt>
                    <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5">
                      {resolvedAnime.seasonLabel || 'TBA'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[#52576B] dark:text-[#A7A9B8]">
                      Start Date
                    </dt>
                    <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5">
                      {resolvedAnime.startDate.formatted || 'TBA'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[#52576B] dark:text-[#A7A9B8]">
                      Studio
                    </dt>
                    <dd className="font-semibold text-[#090B14] dark:text-white mt-0.5 truncate">
                      {resolvedAnime.studios.length > 0
                        ? resolvedAnime.studios.slice(0, 2).join(', ')
                        : 'Not listed'}
                    </dd>
                  </div>
                </dl>

                {/* Genres */}
                {resolvedAnime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedAnime.genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Sanitized Synopsis */}
                <div className="space-y-2">
                  <h3 className="font-accent-orbitron text-[10px] font-semibold tracking-wider text-[#52576B] dark:text-[#A7A9B8] uppercase">
                    Synopsis
                  </h3>
                  {descriptionParagraphs.length > 0 ? (
                    <div className="space-y-2 text-sm leading-relaxed text-[#090B14] dark:text-white/90">
                      {descriptionParagraphs.map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#52576B] dark:text-[#A7A9B8] italic">
                      No synopsis is currently available on AniList for this title.
                    </p>
                  )}
                </div>

                {/* Similar Anime Suggestions Section */}
                {similarAnimeList.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-[#D4D7E2] dark:border-[#303342]">
                    <h3 className="font-accent-orbitron text-[10px] font-semibold tracking-wider text-[#52576B] dark:text-[#A7A9B8] uppercase">
                      Similar & Related Anime
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {similarAnimeList.slice(0, 4).map((rec) => (
                        <button
                          key={rec.anime.id}
                          type="button"
                          onClick={() => {
                            setResolvedAnime(rec.anime);
                            onSelectAnime?.(rec.anime);
                          }}
                          className="p-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-left hover:border-[#EF3038] transition-all group"
                        >
                          <div className="aspect-[3/4] w-full rounded-lg overflow-hidden mb-1.5 bg-black/20">
                            <img
                              src={rec.anime.coverImage.best || ''}
                              alt={rec.anime.title.display}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <p className="text-[11px] font-bold text-[#090B14] dark:text-white truncate">
                            {rec.anime.title.display}
                          </p>
                          <p className="text-[9px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                            {rec.reasonCategory}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Attribution & External Link */}
              <div className="pt-3 border-t border-[#D4D7E2] dark:border-[#303342] flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  Catalogue metadata via AniList
                </span>

                <a
                  href={resolvedAnime.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
                >
                  <span>View on AniList</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

