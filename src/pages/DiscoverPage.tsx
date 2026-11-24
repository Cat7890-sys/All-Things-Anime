import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Compass,
  RefreshCw,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../components/AtaLoadingSpinner';
import { AnimeCard } from '../components/discovery/AnimeCard';
import { AnimeDetailModal } from '../components/discovery/AnimeDetailModal';
import {
  CategoryDiscoveryState,
  useAniListDiscoverCategories,
} from '../hooks/useAniListDiscovery';
import {
  DISCOVERY_CATEGORIES_META,
  getCurrentAnimeSeason,
} from '../services/catalogue/anilistService';
import type {
  DiscoveryCategoryKey,
  DiscoveryCategoryMeta,
  NormalizedAnime,
} from '../services/catalogue/anilistTypes';
import {
  applyCatalogueOverrides,
  fetchCatalogueOverrides,
} from '../services/catalogue/catalogueOverrideService';
import type { CatalogueOverrideRecord } from '../types';

type FilterCategoryTab = 'all' | DiscoveryCategoryKey;

function formatLastUpdated(timestampMs: number | null): string | null {
  if (!timestampMs) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestampMs));
  } catch {
    return null;
  }
}

interface CategorySectionProps {
  meta: DiscoveryCategoryMeta;
  state: CategoryDiscoveryState;
  catalogueOverrides: Record<number, CatalogueOverrideRecord>;
  filterQuery: string;
  isExpanded: boolean;
  isSingleTabView: boolean;
  onToggleExpand: () => void;
  onSelectAnime: (anime: NormalizedAnime) => void;
  onRetry: () => void;
  onRefresh: () => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  meta,
  state,
  catalogueOverrides,
  filterQuery,
  isExpanded,
  isSingleTabView,
  onToggleExpand,
  onSelectAnime,
  onRetry,
  onRefresh,
}) => {
  const normalizedQuery = filterQuery.trim().toLowerCase();

  const overriddenItems = useMemo(
    () => applyCatalogueOverrides(state.items, catalogueOverrides),
    [state.items, catalogueOverrides]
  );

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return overriddenItems;
    return overriddenItems.filter(({ anime: item }) => {
      const matchesTitle =
        item.title.display.toLowerCase().includes(normalizedQuery) ||
        (item.title.english || '').toLowerCase().includes(normalizedQuery) ||
        (item.title.romaji || '').toLowerCase().includes(normalizedQuery) ||
        (item.title.native || '').toLowerCase().includes(normalizedQuery);
      const matchesGenre = item.genres.some((g) =>
        g.toLowerCase().includes(normalizedQuery)
      );
      const matchesStudio = item.studios.some((s) =>
        s.toLowerCase().includes(normalizedQuery)
      );
      return matchesTitle || matchesGenre || matchesStudio;
    });
  }, [normalizedQuery, overriddenItems]);

  const showAll = isSingleTabView || isExpanded || Boolean(normalizedQuery);
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 8);
  const hasMoreToExpand =
    !isSingleTabView && !normalizedQuery && filteredItems.length > 8;

  const headingTitle =
    meta.id === 'seasonal' && state.seasonInfo
      ? `${state.seasonInfo.label} Anime`
      : meta.label;

  const eyebrowLabel =
    meta.id === 'seasonal' && state.seasonInfo
      ? `Current Season · ${state.seasonInfo.label}`
      : meta.eyebrow;

  const updatedLabel = formatLastUpdated(state.fetchedAt);

  return (
    <section
      id={`discover-section-${meta.id}`}
      aria-labelledby={`discover-heading-${meta.id}`}
      className="space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-3.5">
        <div>
          <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
            {eyebrowLabel}
          </p>
          <h2
            id={`discover-heading-${meta.id}`}
            className="font-display-space font-bold text-xl sm:text-2xl text-[#090B14] dark:text-white mt-1"
          >
            {headingTitle}
          </h2>
          <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
            {meta.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {updatedLabel && !state.isLoading && (
            <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
              {state.isStale ? 'Cached' : 'Updated'} {updatedLabel}
            </span>
          )}

          {hasMoreToExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] transition-colors"
            >
              {isExpanded ? 'Show Less' : `View All (${filteredItems.length})`}
            </button>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={state.isLoading || state.isRefreshing}
            aria-label={`Refresh ${headingTitle}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-[#090B14] dark:text-white bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-lg hover:border-[#EF3038] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#EF3038] ${
                state.isRefreshing ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stale Cache / Offline Notice for Category */}
      {state.isStale && state.warningMessage && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8]"
        >
          <span>{state.warningMessage}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="font-semibold text-[#B92335] dark:text-[#EF3038] hover:underline"
          >
            Try live refresh
          </button>
        </div>
      )}

      {/* Content States */}
      {state.isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
            <AtaLoadingSpinner size="sm" label={`Loading ${headingTitle}`} />
            <span>Loading {headingTitle.toLowerCase()} from AniList...</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: isSingleTabView ? 8 : 4 }).map((_, idx) => (
              <div
                key={idx}
                aria-hidden="true"
                className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] overflow-hidden animate-pulse"
              >
                <div className="aspect-[3/4] bg-[#EAECEF] dark:bg-[#090B14]" />
                <div className="p-3.5 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                  <div className="h-4 w-full rounded bg-[#EAECEF] dark:bg-[#303342]" />
                  <div className="h-3 w-1/2 rounded bg-[#EAECEF] dark:bg-[#303342]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : state.errorMessage && state.items.length === 0 ? (
        <div
          role="alert"
          className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 text-center space-y-3"
        >
          <AlertCircle
            className="h-7 w-7 text-[#EF3038] mx-auto"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h3 className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
              Unable to load {headingTitle}
            </h3>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              {state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-6 text-center space-y-1.5">
          <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
            {normalizedQuery
              ? `No titles in ${headingTitle} match "${filterQuery.trim()}".`
              : `No anime entries are currently available for ${headingTitle}.`}
          </p>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            {normalizedQuery
              ? 'Try clearing or broadening your search filter.'
              : 'Try refreshing this category shortly.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleItems.map((entry) => (
            <AnimeCard
              key={entry.anime.id}
              anime={entry.anime}
              editorialOverride={entry.override}
              showTrendingRank={meta.id === 'trending'}
              onSelect={onSelectAnime}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export const DiscoverPage: React.FC = () => {
  const {
    categories,
    isOnline,
    retryCategory,
    refreshCategory,
    refreshAll,
  } = useAniListDiscoverCategories(15);

  const [activeTab, setActiveTab] = useState<FilterCategoryTab>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<
    Partial<Record<DiscoveryCategoryKey, boolean>>
  >({});
  const [selectedAnime, setSelectedAnime] = useState<NormalizedAnime | null>(
    null
  );
  const [catalogueOverrides, setCatalogueOverrides] = useState<
    Record<number, CatalogueOverrideRecord>
  >({});

  useEffect(() => {
    let active = true;
    void fetchCatalogueOverrides().then((res) => {
      if (active) setCatalogueOverrides(res);
    });
    return () => {
      active = false;
    };
  }, []);

  const currentSeason =
    categories.seasonal.seasonInfo ?? getCurrentAnimeSeason();

  const isAnyRefreshing = DISCOVERY_CATEGORIES_META.some(
    (m) => categories[m.id].isRefreshing
  );

  const visibleCategoryMetas = useMemo(() => {
    if (activeTab === 'all') return DISCOVERY_CATEGORIES_META;
    return DISCOVERY_CATEGORIES_META.filter((m) => m.id === activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Page Hero / Control Header */}
      <header className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-5 sm:p-6 cosmic-backdrop-grid space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Compass
                className="h-4 w-4 text-[#EF3038]"
                aria-hidden="true"
              />
              <span className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#B92335] dark:text-[#EF3038] uppercase">
                Live Discovery · AniList Catalogue
              </span>
            </div>

            <h1 className="font-display-space font-bold text-2xl sm:text-3xl text-[#090B14] dark:text-white tracking-tight">
              Discover Anime
            </h1>

            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] max-w-2xl">
              Explore trending series, the {currentSeason.label} broadcast slate,
              currently airing episodes, upcoming premieres, popular favourites,
              and top-rated classics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white">
              <Calendar
                className="h-3.5 w-3.5 text-[#EF3038]"
                aria-hidden="true"
              />
              <span>{currentSeason.label}</span>
            </span>

            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={isAnyRefreshing || !isOnline}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] hover:bg-[#B92335] disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  isAnyRefreshing ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
              <span>Refresh All</span>
            </button>
          </div>
        </div>

        {/* Global Offline Banner */}
        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038]/50 px-4 py-3 text-xs text-[#090B14] dark:text-white"
          >
            <WifiOff
              className="h-4 w-4 text-[#EF3038] shrink-0"
              aria-hidden="true"
            />
            <span>
              You are currently offline. Cached AniList categories remain
              browsable below, and live updates will resume when connectivity
              returns.
            </span>
          </div>
        )}

        {/* Filter Bar: Category Tabs + Loaded Search Filter */}
        <div className="space-y-3 pt-1">
          <div className="relative">
            <Search
              className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter loaded titles, genres, or studios..."
              aria-label="Filter loaded anime titles, genres, or studios"
              className="w-full min-h-[42px] pl-10 pr-10 py-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8] focus:border-[#EF3038] focus:outline-none"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Discovery categories"
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors ${
                activeTab === 'all'
                  ? 'bg-[#EF3038] text-white border-[#B92335]'
                  : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
              }`}
            >
              All Categories
            </button>

            {DISCOVERY_CATEGORIES_META.map((meta) => {
              const isSelected = activeTab === meta.id;
              const label =
                meta.id === 'seasonal'
                  ? `Seasonal (${currentSeason.label})`
                  : meta.label;
              return (
                <button
                  key={meta.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveTab(meta.id)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-[#EF3038] text-white border-[#B92335]'
                      : 'bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-[#A7A9B8] border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Discovery Category Sections */}
      <div className="space-y-10">
        {visibleCategoryMetas.map((meta) => (
          <CategorySection
            key={meta.id}
            meta={meta}
            state={categories[meta.id]}
            catalogueOverrides={catalogueOverrides}
            filterQuery={filterQuery}
            isExpanded={Boolean(expandedCategories[meta.id])}
            isSingleTabView={activeTab !== 'all'}
            onToggleExpand={() =>
              setExpandedCategories((prev) => ({
                ...prev,
                [meta.id]: !prev[meta.id],
              }))
            }
            onSelectAnime={setSelectedAnime}
            onRetry={() => void retryCategory(meta.id)}
            onRefresh={() => void refreshCategory(meta.id)}
          />
        ))}
      </div>

      {/* Attribution Footer */}
      <footer className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-5 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#52576B] dark:text-[#A7A9B8]">
        <span>
          Public anime catalogue data sourced automatically from{' '}
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#090B14] dark:text-white hover:text-[#EF3038] underline underline-offset-2"
          >
            AniList
          </a>
          .
        </span>
        <span className="font-accent-orbitron text-[10px] tracking-[0.12em] uppercase">
          SFW Filter Active
        </span>
      </footer>

      <AnimeDetailModal
        anime={selectedAnime}
        onClose={() => setSelectedAnime(null)}
        onSelectAnime={setSelectedAnime}
      />
    </div>
  );
};
