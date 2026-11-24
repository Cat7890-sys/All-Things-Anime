import React, { useEffect, useState } from 'react';
import {
  Ban,
  Bell,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  Flag,
  Info,
  Lock,
  MessageSquare,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { formatCountdownLabel } from '../../services/challenges/gamificationRules';
import { searchPublicProfilesByUsernamePrefix } from '../../services/userService';
import {
  cancelWatchParty,
  deleteWatchPartyMessage,
  fetchWatchPartyParticipants,
  inviteUsersToWatchParty,
  joinWatchParty,
  leaveWatchParty,
  markWatchPartyCompletedByHost,
  removeWatchPartyParticipantByHost,
  sendWatchPartyMessage,
  subscribeToWatchPartyMessages,
  toggleWatchPartyRegistration,
  updateWatchPartyRsvpStatus,
} from '../../services/watchParties/watchPartyService';
import type {
  AtaPublicProfile,
  AtaUserAccount,
  WatchParty,
  WatchPartyMessage,
  WatchPartyParticipant,
} from '../../types';
import { ReportModal } from '../social/ReportModal';

interface WatchPartyDetailModalProps {
  party: WatchParty | null;
  currentProfile: AtaPublicProfile | AtaUserAccount | null;
  participation?: WatchPartyParticipant;
  blockedUserIds?: Set<string>;
  canManage?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onEditRequested?: (party: WatchParty) => void;
  onOpenUserProfile?: (uid: string) => void;
}

export const WatchPartyDetailModal: React.FC<WatchPartyDetailModalProps> = ({
  party,
  currentProfile,
  participation: initialParticipation,
  blockedUserIds,
  canManage = false,
  onClose,
  onUpdated,
  onEditRequested,
  onOpenUserProfile,
}) => {
  const [participation, setParticipation] = useState<
    WatchPartyParticipant | undefined
  >(initialParticipation);
  const [participants, setParticipants] = useState<WatchPartyParticipant[]>([]);
  const [messages, setMessages] = useState<WatchPartyMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(
    () => new Set()
  );
  const [setReminderOnJoin, setSetReminderOnJoin] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteMatches, setInviteMatches] = useState<AtaPublicProfile[]>([]);
  const [reportTarget, setReportTarget] = useState<{
    type: 'watch_party' | 'watch_party_message';
    id: string;
    authorId: string;
    authorUsername: string;
  } | null>(null);

  useEffect(() => {
    setParticipation(initialParticipation);
  }, [initialParticipation, party?.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!party) return;
    let active = true;
    fetchWatchPartyParticipants(party.id).then((list) => {
      if (active) setParticipants(list);
    });
    const unsub = subscribeToWatchPartyMessages(
      party.id,
      (list) => setMessages(list),
      (msg) => setError(msg)
    );
    return () => {
      active = false;
      unsub();
    };
  }, [party?.id]);

  useEffect(() => {
    if (!showInviteBox || inviteQuery.trim().length < 2) {
      setInviteMatches([]);
      return;
    }
    let active = true;
    const t = window.setTimeout(async () => {
      try {
        const list = await searchPublicProfilesByUsernamePrefix(
          inviteQuery.trim(),
          6
        );
        if (active) {
          setInviteMatches(list.filter((u: AtaPublicProfile) => u.uid !== currentProfile?.uid));
        }
      } catch {
        if (active) setInviteMatches([]);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [showInviteBox, inviteQuery, currentProfile?.uid]);

  if (!party) return null;

  const isHostOrMod =
    canManage ||
    (Boolean(currentProfile?.uid) && party.creatorId === currentProfile?.uid);

  const countdown = formatCountdownLabel(
    party.scheduledStartAtMs,
    party.estimatedDurationMinutes,
    party.status,
    nowMs
  );

  const localDateTime = party.scheduledStartAtMs
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(party.scheduledStartAtMs))
    : `${party.scheduledDate} ${party.startTime} ${party.timezone}`;

  const visibleMessages = messages.filter(
    (m) => !blockedUserIds || !blockedUserIds.has(m.authorId)
  );

  const handleJoin = async () => {
    if (!currentProfile) return;
    setError(null);
    setIsBusy(true);
    try {
      const joined = await joinWatchParty(
        party,
        currentProfile,
        setReminderOnJoin
      );
      setParticipation(joined);
      setStatusMessage(
        setReminderOnJoin
          ? 'Joined watch party & added reminder to your ATA Calendar.'
          : 'Joined watch party!'
      );
      const refreshed = await fetchWatchPartyParticipants(party.id);
      setParticipants(refreshed);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join watch party.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!currentProfile) return;
    setError(null);
    setIsBusy(true);
    try {
      await leaveWatchParty(party, currentProfile.uid);
      setParticipation(undefined);
      setStatusMessage('Left watch party.');
      const refreshed = await fetchWatchPartyParticipants(party.id);
      setParticipants(refreshed);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave watch party.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRsvpChange = async (nextRsvp: 'attending' | 'completed') => {
    if (!participation) return;
    setError(null);
    setIsBusy(true);
    try {
      const updated = await updateWatchPartyRsvpStatus({
        party,
        participant: participation,
        rsvpStatus: nextRsvp,
      });
      setParticipation(updated);
      setStatusMessage(
        nextRsvp === 'completed'
          ? 'Marked episode watched & completed!'
          : 'Checked in as attending!'
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update RSVP.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || isBusy || !messageInput.trim()) return;
    setError(null);
    setIsBusy(true);
    try {
      await sendWatchPartyMessage(
        party.id,
        currentProfile,
        messageInput,
        hasSpoiler
      );
      setMessageInput('');
      setHasSpoiler(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post message.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleHostAction = async (
    action: 'cancel' | 'toggle_reg' | 'complete_party'
  ) => {
    setError(null);
    setIsBusy(true);
    try {
      if (action === 'cancel') {
        await cancelWatchParty(party.id);
        setStatusMessage('Watch party cancelled.');
      } else if (action === 'toggle_reg') {
        await toggleWatchPartyRegistration(party.id, !party.registrationClosed);
        setStatusMessage(
          party.registrationClosed
            ? 'Registration reopened.'
            : 'Registration closed.'
        );
      } else if (action === 'complete_party') {
        await markWatchPartyCompletedByHost(party.id);
        setStatusMessage('Watch party marked completed.');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update party.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveParticipant = async (targetUid: string) => {
    setError(null);
    setIsBusy(true);
    try {
      await removeWatchPartyParticipantByHost(party, targetUid);
      setParticipants((prev) => prev.filter((p) => p.userId !== targetUid));
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to remove participant.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleInvite = async (u: AtaPublicProfile) => {
    setError(null);
    try {
      await inviteUsersToWatchParty(party.id, [u.uid]);
      setStatusMessage(`Invitation sent to @${u.username}.`);
      setInviteQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send invite.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-wp-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] shadow-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
          <div className="flex gap-3.5 min-w-0">
            {party.animeCoverUrl && (
              <img
                src={party.animeCoverUrl}
                alt={party.animeTitle}
                className="h-20 w-14 rounded-xl object-cover shrink-0 border border-[#D4D7E2] dark:border-[#303342]"
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#EF3038]">
                {party.status} · {countdown}
                {party.communityName ? ` · ${party.communityName}` : ''}
              </p>
              <h2
                id="ata-wp-detail-title"
                className="font-display-space font-bold text-xl text-[#090B14] dark:text-white"
              >
                {party.title}
              </h2>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                {party.animeTitle}
                {party.episodeNumber ? ` · Episode ${party.episodeNumber}` : ''} ·
                Host @{party.creatorUsername}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close watch party modal"
            className="h-9 w-9 rounded-lg border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
          <div>
            <p className="font-semibold">Independent Watching Event</p>
            <p>{party.independentWatchNotice}</p>
          </div>
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-4 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-[#090B14] dark:text-white inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-[#EF3038]" />
              Your Local Schedule
            </p>
            <p className="text-[#52576B] dark:text-[#A7A9B8]">{localDateTime}</p>
            <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
              Host schedule: {party.scheduledDate} {party.startTime} ({party.timezone}) ·{' '}
              {party.estimatedDurationMinutes} mins
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-[#090B14] dark:text-white inline-flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#EF3038]" />
              Attendance
            </p>
            <p className="text-[#52576B] dark:text-[#A7A9B8]">
              {party.participantCount} joined · {party.attendingCount} attending ·{' '}
              {party.completedCount} completed
            </p>
            {party.registrationClosed && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Registration currently closed by host
              </p>
            )}
          </div>
        </div>

        <p className="text-sm text-[#090B14] dark:text-white whitespace-pre-line">
          {party.description}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {currentProfile && party.creatorId !== currentProfile.uid && (
              <button
                type="button"
                onClick={() =>
                  setReportTarget({
                    type: 'watch_party',
                    id: party.id,
                    authorId: party.creatorId,
                    authorUsername: party.creatorUsername,
                  })
                }
                className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-medium text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] inline-flex items-center gap-1.5"
              >
                <Flag className="h-3.5 w-3.5" />
                Report Party
              </button>
            )}
          </div>

          {isHostOrMod && party.status !== 'cancelled' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInviteBox((p) => !p)}
                className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] inline-flex items-center gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </button>
              {onEditRequested && (
                <button
                  type="button"
                  onClick={() => onEditRequested(party)}
                  className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] inline-flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => handleHostAction('toggle_reg')}
                disabled={isBusy}
                className="min-h-[38px] px-3 rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] inline-flex items-center gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                {party.registrationClosed ? 'Reopen Reg' : 'Close Reg'}
              </button>
              {party.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => handleHostAction('complete_party')}
                  disabled={isBusy}
                  className="min-h-[38px] px-3 rounded-lg border border-emerald-500/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Party Done
                </button>
              )}
              <button
                type="button"
                onClick={() => handleHostAction('cancel')}
                disabled={isBusy}
                className="min-h-[38px] px-3 rounded-lg border border-[#EF3038]/50 text-xs font-semibold text-[#EF3038] hover:bg-[#EF3038]/10 inline-flex items-center gap-1.5"
              >
                <Ban className="h-3.5 w-3.5" />
                Cancel Event
              </button>
            </div>
          )}
        </div>

        {showInviteBox && (
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3.5 space-y-2">
            <label className="block text-xs font-semibold text-[#090B14] dark:text-white">
              Invite Member to Watch Party
            </label>
            <input
              type="search"
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              placeholder="Search by username..."
              className="w-full rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-2 text-xs text-[#090B14] dark:text-white"
            />
            {inviteMatches.map((u) => (
              <div
                key={u.uid}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-2"
              >
                <span className="text-xs text-[#090B14] dark:text-white">
                  {u.displayName} (@{u.username})
                </span>
                <button
                  type="button"
                  onClick={() => handleInvite(u)}
                  className="px-2.5 py-1 rounded-md bg-[#EF3038] text-white text-[11px] font-semibold"
                >
                  Send Invite
                </button>
              </div>
            ))}
          </div>
        )}

        {currentProfile && party.status !== 'cancelled' && (
          <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {participation ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRsvpChange('attending')}
                    disabled={isBusy}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                      participation.rsvpStatus === 'attending'
                        ? 'bg-[#EF3038] text-white'
                        : 'border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white hover:border-[#EF3038]'
                    }`}
                  >
                    {participation.rsvpStatus === 'attending'
                      ? 'Checked In: Attending'
                      : 'Mark Attending'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRsvpChange('completed')}
                    disabled={isBusy}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-colors ${
                      participation.rsvpStatus === 'completed'
                        ? 'bg-emerald-600 text-white'
                        : 'border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] text-[#090B14] dark:text-white hover:border-emerald-500'
                    }`}
                  >
                    {participation.rsvpStatus === 'completed'
                      ? 'Watched & Completed'
                      : 'Mark Episode Watched'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={isBusy}
                  className="min-h-[40px] px-3.5 rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
                >
                  Leave Watch Party
                </button>
              </>
            ) : (
              <>
                <label className="inline-flex items-center gap-2 text-xs text-[#090B14] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setReminderOnJoin}
                    onChange={(e) => setSetReminderOnJoin(e.target.checked)}
                    className="accent-[#EF3038]"
                  />
                  <Bell className="h-3.5 w-3.5 text-[#EF3038]" />
                  Add watch reminder to my Release Calendar
                </label>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={isBusy || party.registrationClosed}
                  className="min-h-[44px] px-5 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {isBusy ? 'Joining...' : 'Join Watch Party'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Participants List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
            Participants ({participants.length})
          </h3>
          {participants.length === 0 ? (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              No participants have RSVP&apos;d yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onOpenUserProfile?.(p.userId)}
                    className="font-semibold text-[#090B14] dark:text-white hover:text-[#EF3038]"
                  >
                    @{p.username}
                  </button>
                  <span className="text-[10px] uppercase font-semibold text-[#52576B] dark:text-[#A7A9B8]">
                    {p.rsvpStatus}
                  </span>
                  {isHostOrMod && p.userId !== party.creatorId && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.userId)}
                      title="Remove participant"
                      className="text-[#EF3038] hover:opacity-80"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Discussion Board */}
        <div className="space-y-3 pt-3 border-t border-[#D4D7E2] dark:border-[#303342]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8] inline-flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-[#EF3038]" />
              Watch Party Discussion ({visibleMessages.length})
            </h3>
            {!party.discussionEnabled && (
              <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
                Discussion disabled by host
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {visibleMessages.length === 0 ? (
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] py-2">
                No comments yet. Share your reactions while watching independently!
              </p>
            ) : (
              visibleMessages.map((msg) => {
                const isSpoilerHidden =
                  msg.hasSpoiler && !revealedSpoilers.has(msg.id);
                const canDeleteMsg =
                  isHostOrMod || msg.authorId === currentProfile?.uid;

                return (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenUserProfile?.(msg.authorId)}
                        className="font-semibold text-[#090B14] dark:text-white hover:text-[#EF3038]"
                      >
                        {msg.authorDisplayName} (@{msg.authorUsername})
                      </button>
                      <div className="flex items-center gap-2">
                        {msg.hasSpoiler && (
                          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                            Spoiler
                          </span>
                        )}
                        {currentProfile && msg.authorId !== currentProfile.uid && (
                          <button
                            type="button"
                            onClick={() =>
                              setReportTarget({
                                type: 'watch_party_message',
                                id: msg.id,
                                authorId: msg.authorId,
                                authorUsername: msg.authorUsername,
                              })
                            }
                            aria-label="Report message"
                            className="text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteMsg && (
                          <button
                            type="button"
                            onClick={() =>
                              deleteWatchPartyMessage(party.id, msg.id)
                            }
                            aria-label="Delete message"
                            className="text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isSpoilerHidden ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedSpoilers((prev) =>
                            new Set(prev).add(msg.id)
                          )
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#EF3038] hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Spoiler hidden — click to reveal
                      </button>
                    ) : (
                      <p className="text-xs text-[#090B14] dark:text-white whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {currentProfile && party.discussionEnabled && party.status !== 'cancelled' && (
            <form onSubmit={handleSendMessage} className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={600}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Share live episode thoughts or reactions..."
                  className="flex-1 rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                />
                <button
                  type="submit"
                  disabled={isBusy || !messageInput.trim()}
                  className="min-h-[42px] px-4 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Post
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-[11px] text-[#52576B] dark:text-[#A7A9B8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasSpoiler}
                  onChange={(e) => setHasSpoiler(e.target.checked)}
                  className="accent-[#EF3038]"
                />
                Mark comment as spoiler
              </label>
            </form>
          )}
        </div>
      </div>

      {currentProfile && reportTarget && (
        <ReportModal
          isOpen
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          postId={party.id}
          communityId={party.communityId || undefined}
          targetAuthorId={reportTarget.authorId}
          targetAuthorUsername={reportTarget.authorUsername}
          reporterId={currentProfile.uid}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
};
