import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AniListApiError,
  anilistService,
  DEFAULT_DISCOVERY_PER_PAGE,
  DISCOVERY_CATEGORIES_META,
  getCurrentAnimeSeason,
} from '../services/catalogue/anilistService';
import type {
  AniListDataSource,
  DiscoveryCategoryKey,
  NormalizedAnime,
  SeasonInfo,
} from '../services/catalogue/anilistTypes';
import { useOnlineStatus } from './useOnlineStatus';

export interface CategoryDiscoveryState {
  category: DiscoveryCategoryKey;
  items: NormalizedAnime[];
  seasonInfo?: SeasonInfo;
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  source: AniListDataSource | null;
  fetchedAt: number | null;
  warningMessage: string | null;
  errorMessage: string | null;
}

function createInitialCategoryState(
  category: DiscoveryCategoryKey
): CategoryDiscoveryState {
  return {
    category,
    items: [],
    seasonInfo: category === 'seasonal' ? getCurrentAnimeSeason() : undefined,
    isLoading: true,
    isRefreshing: false,
    isStale: false,
    source: null,
    fetchedAt: null,
    warningMessage: null,
    errorMessage: null,
  };
}

function toFriendlyErrorMessage(error: unknown): string {
  if (error instanceof AniListApiError) {
    return error.message;
  }
  return 'Unable to load anime discovery data right now. Please try again.';
}

export function useAniListCategory(
  category: DiscoveryCategoryKey,
  options: { perPage?: number; enabled?: boolean } = {}
) {
  const { perPage = DEFAULT_DISCOVERY_PER_PAGE, enabled = true } = options;
  const { isOnline, justReconnected } = useOnlineStatus();
  const [state, setState] = useState<CategoryDiscoveryState>(() =>
    createInitialCategoryState(category)
  );
  const requestSeqRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) return;

      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;
      const reqId = ++requestSeqRef.current;

      setState((prev) => ({
        ...prev,
        isLoading: prev.items.length === 0,
        isRefreshing: prev.items.length > 0 || forceRefresh,
        errorMessage: null,
      }));

      try {
        const result = await anilistService.getCategory(category, {
          perPage,
          forceRefresh,
          signal: controller.signal,
        });

        if (reqId !== requestSeqRef.current) return;

        setState({
          category,
          items: result.items,
          seasonInfo: result.seasonInfo,
          isLoading: false,
          isRefreshing: false,
          isStale: result.isStale,
          source: result.source,
          fetchedAt: result.fetchedAt,
          warningMessage: result.warningMessage ?? null,
          errorMessage: null,
        });
      } catch (error) {
        if (error instanceof AniListApiError && error.code === 'ABORTED') {
          return;
        }
        if (reqId !== requestSeqRef.current) return;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          errorMessage: toFriendlyErrorMessage(error),
        }));
      }
    },
    [category, enabled, perPage]
  );

  useEffect(() => {
    if (!enabled) return;
    void load(false);
    return () => {
      activeControllerRef.current?.abort();
    };
  }, [enabled, load]);

  useEffect(() => {
    if (
      enabled &&
      justReconnected &&
      (state.isStale || Boolean(state.errorMessage))
    ) {
      void load(true);
    }
  }, [enabled, justReconnected, load, state.errorMessage, state.isStale]);

  const refresh = useCallback(() => load(true), [load]);
  const retry = useCallback(() => load(false), [load]);

  return {
    ...state,
    isOnline,
    refresh,
    retry,
  };
}

export type DiscoverCategoryMap = Record<
  DiscoveryCategoryKey,
  CategoryDiscoveryState
>;

function createInitialDiscoverMap(): DiscoverCategoryMap {
  return {
    trending: createInitialCategoryState('trending'),
    seasonal: createInitialCategoryState('seasonal'),
    currently_airing: createInitialCategoryState('currently_airing'),
    upcoming: createInitialCategoryState('upcoming'),
    popular: createInitialCategoryState('popular'),
    top_rated: createInitialCategoryState('top_rated'),
  };
}

export function useAniListDiscoverCategories(
  perPage: number = DEFAULT_DISCOVERY_PER_PAGE
) {
  const { isOnline, justReconnected } = useOnlineStatus();
  const [categories, setCategories] = useState<DiscoverCategoryMap>(() =>
    createInitialDiscoverMap()
  );
  const controllersRef = useRef<
    Partial<Record<DiscoveryCategoryKey, AbortController>>
  >({});
  const seqRef = useRef<Record<DiscoveryCategoryKey, number>>({
    trending: 0,
    seasonal: 0,
    currently_airing: 0,
    upcoming: 0,
    popular: 0,
    top_rated: 0,
  });

  const loadCategory = useCallback(
    async (category: DiscoveryCategoryKey, forceRefresh = false) => {
      controllersRef.current[category]?.abort();
      const controller = new AbortController();
      controllersRef.current[category] = controller;
      const reqId = ++seqRef.current[category];

      setCategories((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          isLoading: prev[category].items.length === 0,
          isRefreshing: prev[category].items.length > 0 || forceRefresh,
          errorMessage: null,
        },
      }));

      try {
        const result = await anilistService.getCategory(category, {
          perPage,
          forceRefresh,
          signal: controller.signal,
        });

        if (reqId !== seqRef.current[category]) return;

        setCategories((prev) => ({
          ...prev,
          [category]: {
            category,
            items: result.items,
            seasonInfo: result.seasonInfo,
            isLoading: false,
            isRefreshing: false,
            isStale: result.isStale,
            source: result.source,
            fetchedAt: result.fetchedAt,
            warningMessage: result.warningMessage ?? null,
            errorMessage: null,
          },
        }));
      } catch (error) {
        if (error instanceof AniListApiError && error.code === 'ABORTED') {
          return;
        }
        if (reqId !== seqRef.current[category]) return;

        setCategories((prev) => ({
          ...prev,
          [category]: {
            ...prev[category],
            isLoading: false,
            isRefreshing: false,
            errorMessage: toFriendlyErrorMessage(error),
          },
        }));
      }
    },
    [perPage]
  );

  const loadAll = useCallback(
    async (forceRefresh = false) => {
      await Promise.all(
        DISCOVERY_CATEGORIES_META.map((meta) =>
          loadCategory(meta.id, forceRefresh)
        )
      );
    },
    [loadCategory]
  );

  useEffect(() => {
    void loadAll(false);
    const activeControllers = controllersRef.current;
    return () => {
      Object.values(activeControllers).forEach((ctrl) => ctrl?.abort());
    };
  }, [loadAll]);

  useEffect(() => {
    if (!justReconnected) return;
    DISCOVERY_CATEGORIES_META.forEach((meta) => {
      const catState = categories[meta.id];
      if (catState.isStale || catState.errorMessage) {
        void loadCategory(meta.id, true);
      }
    });
  }, [justReconnected, categories, loadCategory]);

  return {
    categories,
    isOnline,
    retryCategory: (category: DiscoveryCategoryKey) => loadCategory(category, false),
    refreshCategory: (category: DiscoveryCategoryKey) =>
      loadCategory(category, true),
    refreshAll: () => loadAll(true),
  };
}
