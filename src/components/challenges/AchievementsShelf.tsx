import React from 'react';
import { Award, CheckCircle2, Lock } from 'lucide-react';
import { ACHIEVEMENT_CATALOG } from '../../services/challenges/gamificationRules';
import type { LeaderboardProfile, UserAchievement } from '../../types';

interface AchievementsShelfProps {
  achievements: UserAchievement[];
  stats?: LeaderboardProfile | null;
  compact?: boolean;
}

export const AchievementsShelf: React.FC<AchievementsShelfProps> = ({
  achievements,
  stats,
  compact = false,
}) => {
  const unlockedById = new Map(
    achievements.map((a) => [a.achievementId, a])
  );

  return (
    <div className="space-y-3">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3">
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Event Points
            </p>
            <p className="text-lg font-display-space font-bold text-[#EF3038]">
              {stats.totalPoints}
            </p>
          </div>
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3">
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Challenges Done
            </p>
            <p className="text-lg font-display-space font-bold text-[#090B14] dark:text-white">
              {stats.challengesCompleted}
            </p>
          </div>
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3">
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Watch Parties
            </p>
            <p className="text-lg font-display-space font-bold text-[#090B14] dark:text-white">
              {stats.watchPartiesAttended}
            </p>
          </div>
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3">
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Badges Unlocked
            </p>
            <p className="text-lg font-display-space font-bold text-[#090B14] dark:text-white">
              {unlockedById.size} / {ACHIEVEMENT_CATALOG.length}
            </p>
          </div>
        </div>
      )}

      <div
        className={`grid gap-2.5 ${
          compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {ACHIEVEMENT_CATALOG.map((def) => {
          const unlocked = unlockedById.get(def.id);
          return (
            <div
              key={def.id}
              className={`rounded-xl border p-3 flex items-start gap-2.5 ${
                unlocked
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] opacity-75'
              }`}
            >
              <div
                className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                  unlocked
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8]'
                }`}
              >
                {unlocked ? (
                  <Award className="h-4 w-4" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                    {def.title}
                  </p>
                  {unlocked && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mt-0.5">
                  {unlocked ? def.description : def.criteriaLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
