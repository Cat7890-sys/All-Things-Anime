import React, { useEffect, useState } from 'react';
import { AlertCircle, Trophy, X } from 'lucide-react';
import {
  createAnimeChallenge,
  updateAnimeChallenge,
} from '../../services/challenges/challengeService';
import {
  CHALLENGE_CATEGORIES,
  CHALLENGE_DIFFICULTIES,
  CHALLENGE_DURATIONS,
} from '../../services/validation';
import type {
  AnimeChallenge,
  AtaCommunity,
  AtaPublicProfile,
  AtaUserAccount,
  ChallengeAnimeTarget,
  ChallengeCategory,
  ChallengeDifficulty,
  ChallengeDurationType,
  ChallengeVisibility,
} from '../../types';
import { AnimeMultiPicker } from './AnimeMultiPicker';

interface ChallengeFormModalProps {
  isOpen: boolean;
  currentProfile: AtaPublicProfile | AtaUserAccount;
  existingChallenge?: AnimeChallenge | null;
  lockedCommunity?: AtaCommunity | null;
  moderatedCommunities?: AtaCommunity[];
  onClose: () => void;
  onSaved: (challenge?: AnimeChallenge) => void;
}

function defaultDateOffset(days: number): string {
  const dt = new Date(Date.now() + days * 86400000);
  return dt.toISOString().slice(0, 10);
}

export const ChallengeFormModal: React.FC<ChallengeFormModalProps> = ({
  isOpen,
  currentProfile,
  existingChallenge,
  lockedCommunity,
  moderatedCommunities = [],
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(existingChallenge);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('Seasonal Watch');
  const [difficulty, setDifficulty] = useState<ChallengeDifficulty>('standard');
  const [durationType, setDurationType] =
    useState<ChallengeDurationType>('monthly');
  const [startDate, setStartDate] = useState(() => defaultDateOffset(0));
  const [endDate, setEndDate] = useState(() => defaultDateOffset(30));
  const [animeTargets, setAnimeTargets] = useState<ChallengeAnimeTarget[]>([]);
  const [requirementsText, setRequirementsText] = useState(
    'Complete all selected anime titles within the challenge dates and sync progress in your ATA tracker.'
  );
  const [participantLimitText, setParticipantLimitText] = useState('');
  const [visibility, setVisibility] = useState<ChallengeVisibility>('public');
  const [communityId, setCommunityId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (existingChallenge) {
      setTitle(existingChallenge.title);
      setDescription(existingChallenge.description);
      setCoverImageUrl(existingChallenge.coverImageUrl || '');
      setCategory(existingChallenge.category);
      setDifficulty(existingChallenge.difficulty);
      setDurationType(existingChallenge.durationType);
      setStartDate(existingChallenge.startDate);
      setEndDate(existingChallenge.endDate);
      setAnimeTargets(existingChallenge.animeTargets);
      setRequirementsText(existingChallenge.requirementsText);
      setParticipantLimitText(
        existingChallenge.participantLimit
          ? String(existingChallenge.participantLimit)
          : ''
      );
      setVisibility(existingChallenge.visibility);
      setCommunityId(existingChallenge.communityId);
    } else {
      setTitle('');
      setDescription('');
      setCoverImageUrl('');
      setCategory('Seasonal Watch');
      setDifficulty('standard');
      setDurationType('monthly');
      setStartDate(defaultDateOffset(0));
      setEndDate(defaultDateOffset(30));
      setAnimeTargets([]);
      setRequirementsText(
        'Complete all selected anime titles within the challenge dates and update your watch progress.'
      );
      setParticipantLimitText('');
      if (lockedCommunity) {
        setVisibility('community');
        setCommunityId(lockedCommunity.id);
      } else {
        setVisibility('public');
        setCommunityId(moderatedCommunities[0]?.id || '');
      }
    }
    setError(null);
  }, [isOpen, existingChallenge, lockedCommunity, moderatedCommunities]);

  if (!isOpen) return null;

  const selectedCommunity =
    lockedCommunity ||
    moderatedCommunities.find((c) => c.id === communityId) ||
    null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    const parsedLimit = participantLimitText.trim()
      ? Number(participantLimitText.trim())
      : null;

    setIsSubmitting(true);
    try {
      if (existingChallenge) {
        await updateAnimeChallenge(existingChallenge.id, {
          title,
          description,
          coverImageUrl,
          category,
          difficulty,
          durationType,
          startDate,
          endDate,
          animeTargets,
          requirementsText,
          participantLimit: parsedLimit,
          status: existingChallenge.status,
        });
        onSaved();
      } else {
        const created = await createAnimeChallenge(currentProfile, {
          title,
          description,
          coverImageUrl,
          category,
          difficulty,
          durationType,
          startDate,
          endDate,
          animeTargets,
          requirementsText,
          participantLimit: parsedLimit,
          visibility,
          communityId: visibility === 'community' ? selectedCommunity?.id || '' : '',
          communityName:
            visibility === 'community' ? selectedCommunity?.name || '' : '',
          communityVisibility:
            visibility === 'community'
              ? selectedCommunity?.visibility || 'public'
              : 'none',
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save challenge.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-challenge-form-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] shadow-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-[#EF3038]" />
            <div>
              <h2
                id="ata-challenge-form-title"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                {isEditing ? 'Edit Anime Challenge' : 'Create Anime Challenge'}
              </h2>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Design a curated watchlist goal for ATA members or your community.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close challenge modal"
            className="h-9 w-9 rounded-lg border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#EF3038]/50 bg-[#EF3038]/10 p-3 text-xs text-[#EF3038]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Challenge Title *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Autumn Sakuga Showcase 2026"
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Description *
              </label>
              <textarea
                required
                rows={3}
                maxLength={1200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the theme, milestones, and why fans should join..."
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              >
                {CHALLENGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Difficulty *
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as ChallengeDifficulty)
                }
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              >
                {CHALLENGE_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)} (
                    {d === 'casual' ? '1.0x pts' : d === 'standard' ? '1.25x pts' : '1.5x pts'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Duration Cadence
              </label>
              <select
                value={durationType}
                onChange={(e) =>
                  setDurationType(e.target.value as ChallengeDurationType)
                }
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              >
                {CHALLENGE_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Participant Limit (optional)
              </label>
              <input
                type="number"
                min={2}
                max={5000}
                value={participantLimitText}
                onChange={(e) => setParticipantLimitText(e.target.value)}
                placeholder="Leave blank for unlimited"
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                End Date *
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            {!isEditing && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                    Visibility *
                  </label>
                  <select
                    value={visibility}
                    disabled={Boolean(lockedCommunity)}
                    onChange={(e) =>
                      setVisibility(e.target.value as ChallengeVisibility)
                    }
                    className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038] disabled:opacity-70"
                  >
                    <option value="public">Public (All ATA Members)</option>
                    {(lockedCommunity || moderatedCommunities.length > 0) && (
                      <option value="community">Community-Only Challenge</option>
                    )}
                  </select>
                </div>

                {visibility === 'community' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                      Host Community *
                    </label>
                    <select
                      value={communityId}
                      disabled={Boolean(lockedCommunity)}
                      onChange={(e) => setCommunityId(e.target.value)}
                      className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038] disabled:opacity-70"
                    >
                      {(lockedCommunity
                        ? [lockedCommunity]
                        : moderatedCommunities
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Custom Cover Image URL (optional HTTPS)
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="Defaults to first selected anime cover image if empty"
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Participation Requirements *
              </label>
              <textarea
                required
                rows={2}
                maxLength={600}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
            <AnimeMultiPicker
              selected={animeTargets}
              onChange={setAnimeTargets}
              maxSelection={25}
              label="Challenge Anime Lineup (minimum 1) *"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-[#D4D7E2] dark:border-[#303342]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold transition-colors disabled:opacity-60"
            >
              {isSubmitting
                ? 'Saving Challenge...'
                : isEditing
                  ? 'Save Changes'
                  : 'Publish Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
