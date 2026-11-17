import React from 'react';
import {
  BarChart3,
  Bookmark,
  CheckCircle2,
  Film,
  Layers,
  Star,
  Tv,
} from 'lucide-react';
import type { PersonalAnimeInsights, WatchlistStatus } from '../../types';

interface ActivityInsightsPanelProps {
  insights: PersonalAnimeInsights;
  onNavigateTracker?: () => void;
}

const STATUS_META: Array<{
  key: WatchlistStatus;
  label: string;
  colorHex: string;
  dotClass: string;
}> = [
  { key: 'watching', label: 'Watching', colorHex: '#EF3038', dotClass: 'bg-[#EF3038]' },
  { key: 'completed', label: 'Completed', colorHex: '#10B981', dotClass: 'bg-emerald-500' },
  { key: 'planning', label: 'Plan to Watch', colorHex: '#38BDF8', dotClass: 'bg-sky-400' },
  { key: 'on_hold', label: 'On Hold', colorHex: '#F59E0B', dotClass: 'bg-amber-400' },
  { key: 'dropped', label: 'Dropped', colorHex: '#64748B', dotClass: 'bg-slate-500' },
];

const FORMAT_PALETTE = [
  '#EF3038',
  '#38BDF8',
  '#10B981',
  '#F59E0B',
  '#9D4EDD',
  '#64748B',
];

export const ActivityInsightsPanel: React.FC<ActivityInsightsPanelProps> = ({
  insights,
  onNavigateTracker,
}) => {
  const topGenres = Object.entries(insights.genreDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const maxGenreCount = Math.max(1, ...topGenres.map(([, c]) => c));

  const topStudios = Object.entries(insights.studioDistribution || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  const maxStudioCount = Math.max(1, ...topStudios.map(([, c]) => c));

  const formatEntries = Object.entries(insights.formatDistribution || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const totalFormatItems = Math.max(
    1,
    formatEntries.reduce((acc, [, count]) => acc + count, 0)
  );

  // SVG Donut math (radius 36, circumference ~ 226.19)
  const donutRadius = 36;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let runningOffset = 0;
  const donutSegments = formatEntries.map(([label, count], idx) => {
    const fraction = count / totalFormatItems;
    const strokeLength = fraction * donutCircumference;
    const dashOffset = -runningOffset;
    runningOffset += strokeLength;
    return {
      label,
      count,
      pct: Math.round(fraction * 100),
      color: FORMAT_PALETTE[idx % FORMAT_PALETTE.length],
      strokeLength,
      dashOffset,
    };
  });

  const ratingMax = Math.max(
    1,
    ...Object.values(insights.ratingDistribution || {})
  );

  const monthlyPoints = insights.monthlyActivity || [];
  const monthlyMax = Math.max(
    1,
    ...monthlyPoints.map((pt) => Math.max(pt.updatedCount, pt.completedCount))
  );

  if (insights.totalTracked === 0) {
    return (
      <section className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <h2 className="text-base font-display-space font-bold text-[#090B14] dark:text-white">
              Personal Anime Insights
            </h2>
          </div>
          {insights.totalCollections > 0 && (
            <span className="text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
              {insights.totalCollections} saved{' '}
              {insights.totalCollections === 1 ? 'collection' : 'collections'}
            </span>
          )}
        </div>

        <div className="p-6 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-center space-y-3">
          <Bookmark className="h-8 w-8 text-[#EF3038] mx-auto" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#090B14] dark:text-white">
              No Watchlist Analytics Yet
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] max-w-md mx-auto">
              Every statistic here is calculated directly from your personal watchlist
              records. Add series to your tracker to view your genres, formats,
              ratings, studios, and monthly activity.
            </p>
          </div>
          {onNavigateTracker && (
            <button
              type="button"
              onClick={onNavigateTracker}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#EF3038] hover:bg-[#B92335] transition-colors"
            >
              Open Anime Tracker
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="p-6 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            <h2 className="text-base font-display-space font-bold text-[#090B14] dark:text-white">
              Personal Anime Insights
            </h2>
          </div>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
            Calculated directly from your {insights.totalTracked} tracked{' '}
            {insights.totalTracked === 1 ? 'series' : 'series'} and{' '}
            {insights.totalCollections}{' '}
            {insights.totalCollections === 1 ? 'collection' : 'collections'}.
          </p>
        </div>

        {onNavigateTracker && (
          <button
            type="button"
            onClick={onNavigateTracker}
            className="text-xs font-semibold text-[#EF3038] hover:underline self-start sm:self-auto"
          >
            Manage Watchlist →
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Total Tracked
          </p>
          <p className="text-xl font-black text-[#090B14] dark:text-white tabular-nums mt-1">
            {insights.totalTracked}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Completion
          </p>
          <p className="text-xl font-black text-emerald-500 tabular-nums mt-1">
            {insights.completionRate}%
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Episodes
          </p>
          <p className="text-xl font-black text-[#090B14] dark:text-white tabular-nums mt-1">
            {insights.totalEpisodesWatched}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Mean Score
          </p>
          <p className="text-xl font-black text-amber-400 tabular-nums mt-1">
            {insights.averageRating ? `${insights.averageRating}/10` : '—'}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Watching
          </p>
          <p className="text-xl font-black text-[#EF3038] tabular-nums mt-1">
            {insights.totalWatching}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342]">
          <p className="text-[10px] font-bold text-[#52576B] dark:text-[#A7A9B8] uppercase tracking-wider">
            Collections
          </p>
          <p className="text-xl font-black text-violet-400 tabular-nums mt-1">
            {insights.totalCollections}
          </p>
        </div>
      </div>

      {/* Status Distribution Segmented Bar */}
      <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Watchlist Status Breakdown</span>
          </h3>
          <span className="text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
            {insights.totalTracked} total
          </span>
        </div>

        <div
          className="h-3 w-full rounded-full overflow-hidden flex bg-[#D4D7E2] dark:bg-[#303342]"
          role="img"
          aria-label="Watchlist status proportions"
        >
          {STATUS_META.map((st) => {
            const count = insights.statusDistribution?.[st.key] ?? 0;
            if (count <= 0) return null;
            const widthPct = (count / insights.totalTracked) * 100;
            return (
              <div
                key={st.key}
                style={{ width: `${widthPct}%`, backgroundColor: st.colorHex }}
                title={`${st.label}: ${count}`}
                className="h-full transition-all duration-300"
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
          {STATUS_META.map((st) => {
            const count = insights.statusDistribution?.[st.key] ?? 0;
            const pct = Math.round((count / insights.totalTracked) * 100);
            return (
              <div key={st.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${st.dotClass}`} />
                <span className="font-semibold text-[#090B14] dark:text-white">
                  {st.label}
                </span>
                <span className="text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Genres Horizontal Bar */}
        <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
          <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Top Tracked Genres</span>
          </h3>

          {topGenres.length === 0 ? (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Genre breakdown populates as you track AniList titles with genre metadata.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topGenres.map(([genre, count]) => {
                const pct = Math.round((count / maxGenreCount) * 100);
                return (
                  <div key={genre} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-[#090B14] dark:text-white truncate">
                        {genre}
                      </span>
                      <span className="text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                        {count} {count === 1 ? 'title' : 'titles'}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#D4D7E2] dark:bg-[#303342] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#EF3038] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Format Breakdown SVG Donut */}
        <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
          <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Tv className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Format Distribution</span>
          </h3>

          {formatEntries.length === 0 ? (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No format distribution data yet.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r={donutRadius}
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-[#D4D7E2] dark:text-[#303342]"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.label}
                      cx="50"
                      cy="50"
                      r={donutRadius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="12"
                      strokeDasharray={`${seg.strokeLength} ${donutCircumference}`}
                      strokeDashoffset={seg.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-base font-black text-[#090B14] dark:text-white tabular-nums leading-none">
                    {insights.totalTracked}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                    Formats
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-1.5">
                {donutSegments.map((seg) => (
                  <div
                    key={seg.label}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-semibold text-[#090B14] dark:text-white truncate">
                        {seg.label}
                      </span>
                    </div>
                    <span className="text-[#52576B] dark:text-[#A7A9B8] font-semibold tabular-nums">
                      {seg.count} ({seg.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ratings 1-10 Histogram */}
        <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span>Your Ratings Curve (1–10)</span>
            </h3>
            {insights.averageRating && (
              <span className="text-[11px] font-bold text-amber-400 tabular-nums">
                Avg {insights.averageRating}
              </span>
            )}
          </div>

          {Object.keys(insights.ratingDistribution).length === 0 ? (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-4">
              Rate tracked series from 1 to 10 to visualize your scoring spread.
            </p>
          ) : (
            <div className="flex items-end gap-1.5 h-32 pt-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => {
                const count = insights.ratingDistribution[score] || 0;
                const heightPct = count > 0 ? Math.round((count / ratingMax) * 100) : 0;
                return (
                  <div
                    key={score}
                    className="flex-1 flex flex-col items-center justify-end h-full gap-1"
                    title={`Rating ${score}: ${count} ${count === 1 ? 'anime' : 'anime'}`}
                  >
                    <span className="text-[9px] font-bold text-[#52576B] dark:text-[#A7A9B8] tabular-nums h-3">
                      {count > 0 ? count : ''}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        count > 0
                          ? 'bg-[#EF3038]'
                          : 'bg-[#D4D7E2]/50 dark:bg-[#303342]/60'
                      }`}
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                    />
                    <span className="text-[10px] font-bold text-[#090B14] dark:text-white tabular-nums">
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Tracked Studios */}
        <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
          <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Top Tracked Studios</span>
          </h3>

          {topStudios.length === 0 ? (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-4">
              Add or update series from AniList search to populate studio analytics.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topStudios.map(([studio, count]) => {
                const pct = Math.round((count / maxStudioCount) * 100);
                return (
                  <div key={studio} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="text-[#090B14] dark:text-white truncate">
                        {studio}
                      </span>
                      <span className="text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                        {count} {count === 1 ? 'series' : 'series'}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#D4D7E2] dark:bg-[#303342] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 6-Month Activity Timeline */}
      {monthlyPoints.length > 0 && (
        <div className="p-4 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-[#090B14] dark:text-white uppercase tracking-wider">
              6-Month Watchlist Activity
            </h3>
            <div className="flex items-center gap-4 text-[10px] font-semibold text-[#52576B] dark:text-[#A7A9B8]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#EF3038]" />
                Updated Entries
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                Completed
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2 items-end h-32 pt-3">
            {monthlyPoints.map((pt) => {
              const updatedHeight =
                pt.updatedCount > 0
                  ? Math.round((pt.updatedCount / monthlyMax) * 100)
                  : 0;
              const completedHeight =
                pt.completedCount > 0
                  ? Math.round((pt.completedCount / monthlyMax) * 100)
                  : 0;

              return (
                <div
                  key={pt.monthKey}
                  className="flex flex-col items-center justify-end h-full gap-1"
                  title={`${pt.label}: ${pt.updatedCount} updated, ${pt.completedCount} completed`}
                >
                  <div className="flex items-end justify-center gap-1 w-full flex-1">
                    <div
                      className={`w-3 rounded-t transition-all duration-300 ${
                        pt.updatedCount > 0
                          ? 'bg-[#EF3038]'
                          : 'bg-[#D4D7E2]/50 dark:bg-[#303342]/60'
                      }`}
                      style={{ height: `${Math.max(4, updatedHeight)}%` }}
                    />
                    <div
                      className={`w-3 rounded-t transition-all duration-300 ${
                        pt.completedCount > 0
                          ? 'bg-emerald-500'
                          : 'bg-[#D4D7E2]/50 dark:bg-[#303342]/60'
                      }`}
                      style={{ height: `${Math.max(4, completedHeight)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-[#090B14] dark:text-white">
                    {pt.label}
                  </span>
                  <span className="text-[9px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                    {pt.updatedCount}/{pt.completedCount}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
