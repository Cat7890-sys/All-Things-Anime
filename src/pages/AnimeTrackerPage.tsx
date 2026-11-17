import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
  AlertCircle,
  ExternalLink,
  Edit2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { anilistService } from '../services/catalogue/anilistService';
import type { NormalizedAnime } from '../services/catalogue/anilistTypes';
import {
  getUserAnimeList,
  incrementWatchedEpisode,
  removeAnimeFromList,
  subscribeToUserAnimeList,
  updateAnimeStatus,
  upsertAnimeListItem,
} from '../services/personalisation/animeTrackerService';
import type {
  UserAnimeListItem,
  WatchlistStatus,
} from '../types';
import { AnimeDetailModal } from '../components/discovery/AnimeDetailModal';

interface AnimeTrackerPageProps {
  currentUserId?: string;
  onOpenAuth?: () => void;
}

type FilterTab = 'all' | WatchlistStatus;
type SortOption = 'updated' | 'rating' | 'title' | 'progress';

export const AnimeTrackerPage: React.FC<AnimeTrackerPageProps> = ({
  currentUserId,
  onOpenAuth,
}) => {
  const [items, setItems] = useState<UserAnimeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UserAnimeListItem | null>(null);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [catalogueResults, setCatalogueResults] = useState<NormalizedAnime[]>([]);
  const [selectedCatalogueAnime, setSelectedCatalogueAnime] =
    useState<NormalizedAnime | null>(null);

  // Detail Modal inspection
  const [selectedDetailAnime, setSelectedDetailAnime] = useState<NormalizedAnime | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formCover, setFormCover] = useState('');
  const [formEpisodesWatched, setFormEpisodesWatched] = useState(0);
  const [formTotalEpisodes, setFormTotalEpisodes] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<WatchlistStatus>('watching');
  const [formRating, setFormRating] = useState<number | null>(null);
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formCompletionDate, setFormCompletionDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deletingAnimeId, setDeletingAnimeId] = useState<string | null>(null);

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

  // Search live AniList when modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const controller = new AbortController();
    void anilistService
      .searchAnime(catalogueQuery, { perPage: 8, signal: controller.signal })
      .then((res) => setCatalogueResults(res.items))
      .catch(() => {});

    return () => {
      controller.abort();
    };
  }, [catalogueQuery, isModalOpen]);

  const handleOpenAddModal = (anime?: NormalizedAnime) => {
    setEditingItem(null);
    setFormError(null);
    if (anime) {
      setSelectedCatalogueAnime(anime);
      setFormTitle(anime.title.display);
      setFormCover(anime.coverImage.best || '');
      setFormTotalEpisodes(anime.episodes);
      setFormEpisodesWatched(0);
      setFormStatus('planning');
      setFormStartDate('');
      setFormCompletionDate('');
    } else {
      setSelectedCatalogueAnime(null);
      setFormTitle('');
      setFormCover('');
      setFormTotalEpisodes(null);
      setFormEpisodesWatched(0);
      setFormStatus('watching');
      setFormStartDate(new Date().toISOString().split('T')[0]);
      setFormCompletionDate('');
    }
    setFormRating(null);
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: UserAnimeListItem) => {
    setEditingItem(item);
    setFormError(null);
    setSelectedCatalogueAnime(null);
    setFormTitle(item.animeTitle);
    setFormCover(item.animeCoverUrl);
    setFormTotalEpisodes(item.totalEpisodes);
    setFormEpisodesWatched(item.episodesWatched);
    setFormStatus(item.status);
    setFormRating(item.userRating);
    setFormStartDate(item.startDate || '');
    setFormCompletionDate(item.completionDate || '');
    setFormNotes(item.personalNotes);
    setIsModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!currentUserId) return;
    if (!formTitle.trim()) {
      setFormError('Anime title is required.');
      return;
    }

    if (
      formTotalEpisodes !== null &&
      formTotalEpisodes > 0 &&
      formEpisodesWatched > formTotalEpisodes
    ) {
      setFormError(`Episodes watched cannot exceed total confirmed episodes (${formTotalEpisodes}).`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const generatedSlug = formTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      const animeId =
        editingItem?.animeId ||
        (selectedCatalogueAnime ? String(selectedCatalogueAnime.id) : '') ||
        generatedSlug ||
        `custom-${Date.now()}`;

      await upsertAnimeListItem(currentUserId, {
        animeId,
        animeTitle: formTitle.trim(),
        animeCoverUrl: formCover || selectedCatalogueAnime?.coverImage.best || '',
        genres: selectedCatalogueAnime?.genres || editingItem?.genres || [],
        studios: selectedCatalogueAnime?.studios || editingItem?.studios || [],
        format: selectedCatalogueAnime?.formatLabel || editingItem?.format || 'TV Series',
        seasonYear: selectedCatalogueAnime?.seasonYear || editingItem?.seasonYear || null,
        totalEpisodes: formTotalEpisodes,
        episodesWatched: formEpisodesWatched,
        status: formStatus,
        userRating: formRating,
        startDate: formStartDate || null,
        completionDate: formCompletionDate || null,
        personalNotes: formNotes.trim(),
      });

      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save anime entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIncrement = async (e: React.MouseEvent, item: UserAnimeListItem) => {
    e.stopPropagation();
    if (!currentUserId) return;
    await incrementWatchedEpisode(currentUserId, item.animeId);
  };

  const handleConfirmDelete = async () => {
    if (!currentUserId || !deletingAnimeId) return;
    await removeAnimeFromList(currentUserId, deletingAnimeId);
    setDeletingAnimeId(null);
  };

  // Status counts
  const counts = useMemo(() => {
    const res = {
      all: items.length,
      watching: 0,
      planning: 0,
      completed: 0,
      on_hold: 0,
      dropped: 0,
    };
    for (const it of items) {
      if (res[it.status] !== undefined) {
        res[it.status]++;
      }
    }
    return res;
  }, [items]);

  // Filter & Sort
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      if (activeTab !== 'all' && item.status !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.animeTitle.toLowerCase().includes(q) ||
          item.genres.some((g) => g.toLowerCase().includes(q))
        );
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.userRating || 0) - (a.userRating || 0);
      }
      if (sortBy === 'title') {
        return a.animeTitle.localeCompare(b.animeTitle);
      }
      if (sortBy === 'progress') {
        const progA = a.totalEpisodes ? a.episodesWatched / a.totalEpisodes : 0;
        const progB = b.totalEpisodes ? b.episodesWatched / b.totalEpisodes : 0;
        return progB - progA;
      }
      const timeA = a.updatedAt ? a.updatedAt.getTime() : 0;
      const timeB = b.updatedAt ? b.updatedAt.getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [items, activeTab, searchQuery, sortBy]);

  if (!currentUserId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Bookmark className="h-12 w-12 text-[#EF3038] mx-auto" />
        <h2 className="text-2xl font-bold text-[#090B14] dark:text-white">
          Anime Tracker & Watchlist
        </h2>
        <p className="text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
          Sign in to organize your anime watchlist, log episode progress, rate series, and view personal activity insights.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] shadow-md"
        >
          Sign In to Track Anime
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-[#D4D7E2] dark:border-[#303342] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-accent-orbitron text-xs font-bold tracking-widest text-[#EF3038] uppercase">
              Personal Tracking
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#090B14] dark:text-white tracking-tight mt-1">
            Anime Watchlist
          </h1>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8]">
            Track episodes, log viewing status, rate shows, and save personal notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors shadow-md"
        >
          <Plus className="h-4 w-4" />
          <span>Add Anime</span>
        </button>
      </div>

      {/* Overview Status Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: 'all', label: 'All', count: counts.all, color: 'text-white' },
          { id: 'watching', label: 'Watching', count: counts.watching, color: 'text-[#EF3038]' },
          { id: 'planning', label: 'Plan to Watch', count: counts.planning, color: 'text-sky-400' },
          { id: 'completed', label: 'Completed', count: counts.completed, color: 'text-emerald-400' },
          { id: 'on_hold', label: 'On Hold', count: counts.on_hold, color: 'text-amber-400' },
          { id: 'dropped', label: 'Dropped', count: counts.dropped, color: 'text-red-400' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as FilterTab)}
              className={`p-3 rounded-2xl border text-center transition-all ${
                active
                  ? 'bg-[#090B14] dark:bg-[#171923] border-[#EF3038] ring-1 ring-[#EF3038] text-white shadow-md'
                  : 'bg-white dark:bg-[#171923] border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block">
                {tab.label}
              </span>
              <span className={`text-base font-black tabular-nums mt-0.5 ${tab.color}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52576B] dark:text-[#A7A9B8]" />
          <input
            type="text"
            placeholder="Search your watchlist by title or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#52576B] dark:text-[#A7A9B8] shrink-0 font-medium">
            Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
          >
            <option value="updated">Recently Updated</option>
            <option value="rating">User Rating</option>
            <option value="title">Title (A-Z)</option>
            <option value="progress">Progress</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#EF3038]" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 px-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
          <Bookmark className="h-10 w-10 text-[#52576B] dark:text-[#A7A9B8] mx-auto" />
          <p className="text-sm font-bold text-[#090B14] dark:text-white">
            No anime found in this view
          </p>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] max-w-sm mx-auto">
            {activeTab === 'all'
              ? 'Your watchlist is empty. Add your favourite series to track episodes and progress.'
              : `No series marked as "${activeTab}".`}
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="mt-2 px-4 py-2 text-xs font-bold text-white bg-[#EF3038] rounded-xl hover:bg-[#B92335]"
          >
            Browse & Add Anime
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const hasConfirmedTotal = item.totalEpisodes !== null && item.totalEpisodes > 0;
            const percentage = hasConfirmedTotal
              ? Math.min(100, Math.round((item.episodesWatched / item.totalEpisodes!) * 100))
              : null;

            return (
              <div
                key={item.id}
                onClick={() => handleOpenEditModal(item)}
                className="p-4 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] hover:border-[#090B14] dark:hover:border-white/50 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4 group"
              >
                {/* Cover Image */}
                <div className="h-20 w-16 sm:h-24 sm:w-18 rounded-xl overflow-hidden shrink-0 bg-black/20 relative">
                  {item.animeCoverUrl ? (
                    <img
                      src={item.animeCoverUrl}
                      alt={item.animeTitle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#A7A9B8]">
                      ATA
                    </div>
                  )}
                  {item.status === 'completed' && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors truncate">
                      {item.animeTitle}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : item.status === 'watching'
                          ? 'bg-[#EF3038]/10 text-[#EF3038] border border-[#EF3038]/20'
                          : 'bg-white dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342]'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                    {item.format} {item.genres.length > 0 && `· ${item.genres.slice(0, 3).join(', ')}`}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1 max-w-md pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                      <span className="text-[#090B14] dark:text-white">
                        {item.episodesWatched} / {hasConfirmedTotal ? item.totalEpisodes : '??'} eps
                      </span>
                      {percentage !== null && (
                        <span className="text-[#52576B] dark:text-[#A7A9B8]">
                          {percentage}%
                        </span>
                      )}
                    </div>
                    {percentage !== null ? (
                      <div className="h-2 w-full bg-[#D4D7E2] dark:bg-[#303342] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#EF3038] rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    ) : (
                      <div className="h-1.5 w-full bg-[#D4D7E2] dark:bg-[#303342] rounded-full opacity-50" />
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D4D7E2] dark:border-[#303342]">
                  {item.userRating ? (
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span>{item.userRating}/10</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                      Unrated
                    </span>
                  )}

                  {item.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={(e) => void handleIncrement(e, item)}
                      title="Quick +1 watched episode"
                      className="px-3 py-1 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+1 Ep</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Resolve normalized anime for detail inspection
                        setSelectedDetailAnime({
                          id: Number(item.animeId) || 1,
                          title: {
                            english: item.animeTitle,
                            romaji: item.animeTitle,
                            native: null,
                            display: item.animeTitle,
                          },
                          coverImage: {
                            extraLarge: item.animeCoverUrl,
                            large: item.animeCoverUrl,
                            best: item.animeCoverUrl,
                            color: null,
                          },
                          bannerImage: null,
                          averageScore: item.userRating ? item.userRating * 10 : null,
                          popularity: null,
                          trending: null,
                          trendingRank: null,
                          episodes: item.totalEpisodes,
                          status: item.status === 'completed' ? 'FINISHED' : 'RELEASING',
                          statusLabel: item.status,
                          season: null,
                          seasonYear: item.seasonYear,
                          seasonLabel: item.seasonYear ? String(item.seasonYear) : null,
                          startDate: { year: null, month: null, day: null, formatted: item.startDate },
                          format: 'TV',
                          formatLabel: item.format,
                          genres: item.genres,
                          description: item.personalNotes || null,
                          nextAiringEpisode: null,
                          studios: item.studios,
                          siteUrl: `https://anilist.co/search/anime?search=${encodeURIComponent(item.animeTitle)}`,
                          isAdult: false,
                        });
                      }}
                      title="View anime details"
                      className="p-1 rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAnimeId(item.animeId);
                      }}
                      title="Remove from tracker"
                      className="p-1 rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#090B14] border-b border-[#303342] flex items-center justify-between text-white">
              <h2 className="text-sm font-bold">
                {editingItem ? 'Edit Tracker Entry' : 'Add Anime to Watchlist'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#A7A9B8] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-[#EF3038]/10 border border-[#EF3038]/30 text-xs text-[#EF3038] font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* AniList Catalogue Search (if adding new) */}
              {!editingItem && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#090B14] dark:text-white block">
                    Search AniList Catalogue
                  </label>
                  <input
                    type="text"
                    placeholder="Search verified series e.g. Frieren, Cowboy Bebop..."
                    value={catalogueQuery}
                    onChange={(e) => setCatalogueQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                  />
                  {catalogueResults.length > 0 && !selectedCatalogueAnime && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#D4D7E2] dark:divide-[#303342] border border-[#D4D7E2] dark:border-[#303342] rounded-xl bg-white dark:bg-[#090B14]">
                      {catalogueResults.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCatalogueAnime(cat);
                            setFormTitle(cat.title.display);
                            setFormCover(cat.coverImage.best || '');
                            setFormTotalEpisodes(cat.episodes);
                          }}
                          className="w-full text-left p-2.5 hover:bg-[#EF3038]/10 flex items-center gap-2.5 text-xs font-bold text-[#090B14] dark:text-white"
                        >
                          <img
                            src={cat.coverImage.best || ''}
                            alt={cat.title.display}
                            className="h-10 w-8 object-cover rounded"
                          />
                          <div>
                            <p>{cat.title.display}</p>
                            <span className="text-[10px] text-[#52576B] dark:text-[#A7A9B8]">
                              {cat.formatLabel} · {cat.episodes ? `${cat.episodes} eps` : 'Ongoing'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Anime Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white font-bold"
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Viewing Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as WatchlistStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white font-bold"
                >
                  <option value="watching">Watching</option>
                  <option value="planning">Plan to Watch</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>

              {/* Episodes Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                    Episodes Watched
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formTotalEpisodes || 9999}
                    value={formEpisodesWatched}
                    onChange={(e) => setFormEpisodesWatched(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                    Total Confirmed Eps
                  </label>
                  <input
                    type="number"
                    placeholder="Unknown"
                    value={formTotalEpisodes === null ? '' : formTotalEpisodes}
                    onChange={(e) =>
                      setFormTotalEpisodes(
                        e.target.value ? parseInt(e.target.value, 10) : null
                      )
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* Dates Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                    Start Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                    Completion Date
                  </label>
                  <input
                    type="date"
                    value={formCompletionDate}
                    onChange={(e) => setFormCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                  />
                </div>
              </div>

              {/* Rating 1-10 */}
              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Your Rating (1 - 10)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormRating(formRating === num ? null : num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formRating === num
                          ? 'bg-amber-400 text-black shadow'
                          : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#52576B] dark:text-[#A7A9B8] border border-[#D4D7E2] dark:border-[#303342]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-[#090B14] dark:text-white block mb-1">
                  Personal Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Your personal review, episode bookmarks, or thoughts..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F4F5F8] dark:bg-[#090B14] border-t border-[#D4D7E2] dark:border-[#303342] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleSaveItem()}
                className="px-5 py-2 text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] rounded-xl flex items-center gap-1.5 shadow-md"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save to Tracker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletingAnimeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[#090B14] dark:text-white">
              Remove from Tracker?
            </h3>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Are you sure you want to remove this anime from your personal tracking list? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAnimeId(null)}
                className="px-4 py-2 text-xs font-bold text-[#52576B] dark:text-[#A7A9B8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-xl hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedDetailAnime && (
        <AnimeDetailModal
          anime={selectedDetailAnime}
          onClose={() => setSelectedDetailAnime(null)}
          onSelectAnime={(anim) => setSelectedDetailAnime(anim)}
        />
      )}
    </div>
  );
};
