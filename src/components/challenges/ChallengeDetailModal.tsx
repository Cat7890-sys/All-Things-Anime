import React, { useEffect, useState } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Edit3,
  Flag,
  Send,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  archiveAnimeChallenge,
  fetchChallengeParticipants,
  inviteUsersToChallenge,
  joinAnimeChallenge,
  leaveAnimeChallenge,
  updateChallengeTargetProgress,
} from '../../services/challenges/challengeService';
import { ATA_SCORING_RULES } from '../../services/challenges/gamificationRules';
import { searchPublicProfilesByUsernamePrefix } from '../../services/userService';
import type {
  AnimeChallenge,
  AtaPublicProfile,
  AtaUserAccount,
  ChallengeAnimeTarget,
  ChallengeParticipation,
  UserAnimeListItem,
} from '../../types';
import { ReportModal } from '../social/ReportModal';

interface ChallengeDetailModalProps {
  challenge: AnimeChallenge | null;
  currentProfile: AtaPublicProfile | AtaUserAccount | null;
  participation?: ChallengeParticipation;
  trackerItems?: UserAnimeListItem[];
  canManage?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onEditRequested?: (challenge: AnimeChallenge) => void;
  onOpenUserProfile?: (uid: string) => void;
}

export const ChallengeDetailModal: React.FC<ChallengeDetailModalProps> = ({
  challenge,
  currentProfile,
  participation: initialParticipation,
  trackerItems,
  canManage = false,
  onClose,
  onUpdated,
  onEditRequested,
  onOpenUserProfile,
}) => {
  const [participation, setParticipation] = useState<
    ChallengeParticipation | undefined
  >(initialParticipation);
  const [participants, setParticipants] = useState<ChallengeParticipation[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [syncToTracker, setSyncToTracker] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<AtaPublicProfile[]>([]);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setParticipation(initialParticipation);
  }, [initialParticipation, challenge?.id]);

  useEffect(() => {
    if (!challenge) return;
    let active = true;
    setIsLoadingParticipants(true);
    fetchChallengeParticipants(challenge.id)
      .then((list) => {
        if (active) setParticipants(list);
      })
      .finally(() => {
        if (active) setIsLoadingParticipants(false);
      });
    return () => {
      active = false;
    };
  }, [challenge?.id]);

  useEffect(() => {
    if (!showInviteBox || inviteQuery.trim().length < 2) {
      setInviteResults([]);
      return;
    }
    let active = true;
    const t = window.setTimeout(async () => {
      try {
        const res = await searchPublicProfilesByUsernamePrefix(
          inviteQuery.trim(),
          6
        );
        if (active) {
          setInviteResults(
            res.filter((u: AtaPublicProfile) => u.uid !== currentProfile?.uid)
          );
        }
      } catch {
        if (active) setInviteResults([]);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [showInviteBox, inviteQuery, currentProfile?.uid]);

  if (!challenge) return null;

  const isCreatorOrMod =
    canManage ||
    (Boolean(currentProfile?.uid) && challenge.creatorId === currentProfile?.uid);

  const handleJoin = async () => {
    if (!currentProfile) return;
    setError(null);
    setIsBusy(true);
    try {
      const joined = await joinAnimeChallenge(
        challenge,
        currentProfile,
        trackerItems
      );
      setParticipation(joined);
      setStatusMessage('Joined challenge! Existing tracker progress synced automatically.');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join challenge.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!currentProfile) return;
    setError(null);
    setIsBusy(true);
    try {
      await leaveAnimeChallenge(challenge, currentProfile.uid);
      setParticipation(undefined);
      setStatusMessage('You left this challenge.');
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave challenge.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleTarget = async (target: ChallengeAnimeTarget) => {
    if (!participation || isBusy) return;
    const isCompleted = participation.completedAnimeIds.includes(target.animeId);
    setError(null);
    setIsBusy(true);
    try {
      const updated = await updateChallengeTargetProgress({
        challenge,
        participation,
        animeTarget: target,
        markCompleted: !isCompleted,
        syncToTracker,
      });
      setParticipation(updated);
      setStatusMessage(
        updated.status === 'completed'
          ? 'Challenge completed! Points and eligibility updated.'
          : !isCompleted
            ? `Marked "${target.title}" completed.`
            : `Updated "${target.title}" progress.`
      );
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update challenge progress.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleInviteUser = async (target: AtaPublicProfile) => {
    setError(null);
    try {
      await inviteUsersToChallenge(challenge.id, [target.uid]);
      setStatusMessage(`Invitation sent to @${target.username}.`);
      setInviteQuery('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send challenge invite.'
      );
    }
  };

  const handleArchive = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await archiveAnimeChallenge(challenge.id);
      setStatusMessage('Challenge archived.');
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive challenge.');
    } finally {
      setIsBusy(false);
    }
  };

  const coverImage =
    challenge.coverImageUrl || challenge.animeTargets[0]?.coverImage || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-challenge-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-44 bg-[#090B14] overflow-hidden">
          {coverImage && (
            <img
              src={coverImage}
              alt={challenge.title}
              className="h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/45 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close challenge details"
            className="absolute top-3 right-3 h-9 w-9 rounded-lg bg-[#090B14]/80 border border-white/20 text-white flex items-center justify-center hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-4 left-5 right-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
              {challenge.category} · {challenge.difficulty} · {challenge.status}
              {challenge.communityName ? ` · ${challenge.communityName}` : ''}
            </p>
            <h2
              id="ata-challenge-detail-title"
              className="font-display-space font-bold text-xl sm:text-2xl text-white"
            >
              {challenge.title}
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#EF3038]/50 bg-[#EF3038]/10 px-3.5 py-2.5 text-xs text-[#EF3038]"
            >
              {error}
            </div>
          )}
          {statusMessage && (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300"
            >
              {statusMessage}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#52576B] dark:text-[#A7A9B8]">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#EF3038]" />
                {challenge.startDate} to {challenge.endDate}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#EF3038]" />
                {challenge.participantCount} participants
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-[#EF3038]" />
                +{ATA_SCORING_RULES.challengeJoinBase} join / +
                {ATA_SCORING_RULES.challengeFullCompletionBonus} completion bonus (x
                {ATA_SCORING_RULES.difficultyMultiplier[challenge.difficulty]})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentProfile && challenge.creatorId !== currentProfile.uid && (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] inline-flex items-center gap-1.5"
                >
                  <Flag className="h-3.5 w-3.5" />
                  Report
                </button>
              )}
              {isCreatorOrMod && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowInviteBox((prev) => !prev)}
                    className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Invite
                  </button>
                  {onEditRequested && (
                    <button
                      type="button"
                      onClick={() => onEditRequested(challenge)}
                      className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                  {challenge.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={isBusy}
                      className="min-h-[38px] px-3 rounded-lg border border-amber-500/40 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 inline-flex items-center gap-1.5"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {showInviteBox && (
            <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3.5 space-y-2.5">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white">
                Invite ATA Member by Username
              </label>
              <input
                type="search"
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                placeholder="Type at least 2 characters of username..."
                className="w-full rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-2 text-xs text-[#090B14] dark:text-white"
              />
              {inviteResults.length > 0 && (
                <div className="space-y-1.5">
                  {inviteResults.map((user) => (
                    <div
                      key={user.uid}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-2"
                    >
                      <span className="text-xs text-[#090B14] dark:text-white font-medium">
                        {user.displayName} (@{user.username})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleInviteUser(user)}
                        className="px-2.5 py-1 rounded-md bg-[#EF3038] text-white text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" />
                        Send Invite
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
                Challenge Overview
              </h3>
              <p className="text-sm text-[#090B14] dark:text-white whitespace-pre-line">
                {challenge.description}
              </p>
            </div>
            <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3.5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#EF3038]">
                Requirements
              </h3>
              <p className="text-xs text-[#090B14] dark:text-white leading-relaxed">
                {challenge.requirementsText}
              </p>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Hosted by @{challenge.creatorUsername}
              </p>
            </div>
          </div>

          {currentProfile && (
            <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {participation ? (
                <>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#090B14] dark:text-white">
                        {participation.status === 'completed'
                          ? 'Challenge Completed!'
                          : `Progress: ${participation.completedAnimeIds.length} / ${challenge.animeTargets.length} completed`}
                      </span>
                      <span className="text-[#EF3038]">
                        {participation.progressPercent}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white dark:bg-[#171923] overflow-hidden border border-[#D4D7E2] dark:border-[#303342]">
                      <div
                        className="h-full bg-[#EF3038] transition-all"
                        style={{ width: `${participation.progressPercent}%` }}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-[11px] text-[#52576B] dark:text-[#A7A9B8] pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncToTracker}
                        onChange={(e) => setSyncToTracker(e.target.checked)}
                        className="accent-[#EF3038]"
                      />
                      Sync completions directly to my Personal Anime Tracker
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleLeave}
                    disabled={isBusy}
                    className="min-h-[42px] px-4 rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] shrink-0"
                  >
                    Leave Challenge
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-[#090B14] dark:text-white">
                      Ready to participate?
                    </p>
                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                      Joining imports your completed series from your Anime Tracker automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={isBusy || challenge.status === 'archived'}
                    className="min-h-[44px] px-5 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold shrink-0 disabled:opacity-50"
                  >
                    {isBusy ? 'Joining...' : 'Join Challenge'}
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
              Challenge Anime Checklist ({challenge.animeTargets.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {challenge.animeTargets.map((target) => {
                const isDone = participation?.completedAnimeIds.includes(
                  target.animeId
                );
                return (
                  <div
                    key={target.animeId}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                      isDone
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14]'
                    }`}
                  >
                    {target.coverImage && (
                      <img
                        src={target.coverImage}
                        alt={target.title}
                        className="h-14 w-10 rounded object-cover shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#090B14] dark:text-white truncate">
                        {target.title}
                      </p>
                      <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                        {target.format || 'TV'} ·{' '}
                        {target.totalEpisodes
                          ? `${target.totalEpisodes} episodes`
                          : 'Ongoing'}
                      </p>
                    </div>
                    {participation && (
                      <button
                        type="button"
                        onClick={() => handleToggleTarget(target)}
                        disabled={isBusy}
                        className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : 'border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white hover:border-[#EF3038]'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isDone ? 'Completed' : 'Mark Done'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#D4D7E2] dark:border-[#303342]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
              Participant Standings ({participants.length})
            </h3>
            {isLoadingParticipants ? (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Loading participants...
              </p>
            ) : participants.length === 0 ? (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Be the first member to join this challenge.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {participants.slice(0, 12).map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenUserProfile?.(p.userId)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2 text-left hover:border-[#EF3038]"
                  >
                    <span className="text-xs font-semibold text-[#090B14] dark:text-white truncate">
                      #{idx + 1} {p.displayName} (@{p.username})
                    </span>
                    <span className="text-xs font-bold text-[#EF3038] shrink-0">
                      {p.progressPercent}%
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {currentProfile && (
        <ReportModal
          isOpen={reportOpen}
          targetType="challenge"
          targetId={challenge.id}
          postId={challenge.id}
          communityId={challenge.communityId || undefined}
          targetAuthorId={challenge.creatorId}
          targetAuthorUsername={challenge.creatorUsername}
          reporterId={currentProfile.uid}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
};
