import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plus, Search, X } from 'lucide-react';
import { anilistService } from '../../services/catalogue/anilistService';
import type { NormalizedAnime } from '../../services/catalogue/anilistTypes';
import type { ChallengeAnimeTarget } from '../../types';

interface AnimeMultiPickerProps {
  selected: ChallengeAnimeTarget[];
  onChange: (next: ChallengeAnimeTarget[]) => void;
  maxSelection?: number;
  label?: string;
}

export const AnimeMultiPicker: React.FC<AnimeMultiPickerProps> = ({
  selected,
  onChange,
  maxSelection = 25,
  label = 'Select Anime from AniList',
}) => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<NormalizedAnime[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await anilistService.searchAnime(queryText, { perPage: 8 });
        if (active) {
          setResults(res.items);
        }
      } catch (err) {
        if (active) {
          setSearchError(
            err instanceof Error ? err.message : 'Unable to search AniList right now.'
          );
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [queryText]);

  const selectedIds = new Set(selected.map((item) => item.animeId));

  const toggleAnime = (anime: NormalizedAnime) => {
    if (selectedIds.has(anime.id)) {
      onChange(selected.filter((item) => item.animeId !== anime.id));
      return;
    }

    const nextTarget: ChallengeAnimeTarget = {
      animeId: anime.id,
      title: anime.title.display,
      coverImage: anime.coverImage.best || anime.coverImage.large || '',
      totalEpisodes: anime.episodes ?? null,
      format: anime.format || 'TV',
    };

    if (maxSelection === 1) {
      onChange([nextTarget]);
      return;
    }

    if (selected.length >= maxSelection) return;
    onChange([...selected, nextTarget]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#090B14] dark:text-white">
          {label}
        </span>
        <span className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8]">
          {selected.length} / {maxSelection} selected
        </span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <div
              key={item.animeId}
              className="flex items-center gap-2 rounded-lg border border-[#EF3038]/40 bg-[#EF3038]/10 px-2.5 py-1.5 text-xs text-[#090B14] dark:text-white"
            >
              {item.coverImage && (
                <img
                  src={item.coverImage}
                  alt=""
                  className="h-6 w-5 rounded object-cover shrink-0"
                />
              )}
              <span className="font-medium max-w-[180px] truncate">{item.title}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(selected.filter((s) => s.animeId !== item.animeId))
                }
                aria-label={`Remove ${item.title}`}
                className="text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search
          className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search AniList titles (e.g. Frieren, Jujutsu Kaisen, Evangelion)..."
          className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] pl-9 pr-9 py-2.5 text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8] focus:outline-none focus:border-[#EF3038]"
        />
        {isSearching && (
          <Loader2
            className="h-4 w-4 animate-spin text-[#EF3038] absolute right-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
        )}
      </div>

      {searchError && (
        <p className="text-xs text-[#EF3038]" role="alert">
          {searchError}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        {results.map((anime) => {
          const isSelected = selectedIds.has(anime.id);
          return (
            <button
              key={anime.id}
              type="button"
              onClick={() => toggleAnime(anime)}
              className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${
                isSelected
                  ? 'border-[#EF3038] bg-[#EF3038]/10'
                  : 'border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] hover:border-[#EF3038]/60'
              }`}
            >
              {anime.coverImage.best ? (
                <img
                  src={anime.coverImage.best}
                  alt={anime.title.display}
                  className="h-12 w-9 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-12 w-9 rounded bg-[#D4D7E2] dark:bg-[#303342] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#090B14] dark:text-white truncate">
                  {anime.title.display}
                </p>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                  {anime.format || 'TV'} ·{' '}
                  {anime.episodes ? `${anime.episodes} eps` : 'Ongoing/TBA'}
                </p>
              </div>
              <span
                className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-[#EF3038] text-white'
                    : 'border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8]'
                }`}
              >
                {isSelected ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
