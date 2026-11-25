import {
  collection,
  getDocs,
  limit,
  query,
  Timestamp,
} from 'firebase/firestore';
import type { CatalogueOverrideRecord } from '../../types';
import { db } from '../firebase';
import { getOrFetch } from '../memoryCache';
import type { NormalizedAnime } from './anilistTypes';

const CATALOGUE_OVERRIDES_CACHE_TTL_MS = 10 * 60_000;
const CATALOGUE_OVERRIDES_QUERY_LIMIT = 500;

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  return null;
}

export function mapCatalogueOverrideDoc(
  id: string,
  data: Record<string, unknown>
): CatalogueOverrideRecord {
  return {
    id,
    animeId: typeof data.animeId === 'number' ? data.animeId : Number(id) || 0,
    animeTitle: String(data.animeTitle || ''),
    overrideTitle:
      typeof data.overrideTitle === 'string' && data.overrideTitle.trim()
        ? data.overrideTitle.trim()
        : undefined,
    overrideSynopsis:
      typeof data.overrideSynopsis === 'string' && data.overrideSynopsis.trim()
        ? data.overrideSynopsis.trim()
        : undefined,
    editorialNote:
      typeof data.editorialNote === 'string' && data.editorialNote.trim()
        ? data.editorialNote.trim()
        : undefined,
    isFeatured: Boolean(data.isFeatured),
    isTrendingOverride: Boolean(data.isTrendingOverride),
    isSeasonalHighlight: Boolean(data.isSeasonalHighlight),
    recommendationPinned: Boolean(data.recommendationPinned),
    isHiddenFromCatalogue: Boolean(data.isHiddenFromCatalogue),
    metadataIssueFlag: Boolean(data.metadataIssueFlag),
    updatedByUid: String(data.updatedByUid || ''),
    updatedAt: toDateOrNull(data.updatedAt),
  };
}

export async function fetchCatalogueOverrides(): Promise<
  Record<number, CatalogueOverrideRecord>
> {
  return getOrFetch(
    'catalogueOverrides:all',
    async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'catalogueOverrides'),
            limit(CATALOGUE_OVERRIDES_QUERY_LIMIT)
          )
        );
        const byAnimeId: Record<number, CatalogueOverrideRecord> = {};
        snap.forEach((docSnap) => {
          const mapped = mapCatalogueOverrideDoc(docSnap.id, docSnap.data());
          if (mapped.animeId > 0) {
            byAnimeId[mapped.animeId] = mapped;
          }
        });
        return byAnimeId;
      } catch {
        return {};
      }
    },
    { ttlMs: CATALOGUE_OVERRIDES_CACHE_TTL_MS }
  );
}

export interface CatalogueItemWithOverride {
  anime: NormalizedAnime;
  override?: CatalogueOverrideRecord;
}

export function applyCatalogueOverrides(
  items: NormalizedAnime[],
  overrides: Record<number, CatalogueOverrideRecord>
): CatalogueItemWithOverride[] {
  const result: CatalogueItemWithOverride[] = [];
  for (const anime of items) {
    const override = overrides[anime.id];
    if (override?.isHiddenFromCatalogue) {
      continue;
    }
    if (!override) {
      result.push({ anime });
      continue;
    }
    const patched: NormalizedAnime = {
      ...anime,
      title: {
        ...anime.title,
        display: override.overrideTitle || anime.title.display,
      },
      description: override.overrideSynopsis || anime.description,
    };
    result.push({ anime: patched, override });
  }
  return result;
}
