import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Info, X } from 'lucide-react';
import { INDEPENDENT_WATCH_NOTICE } from '../../services/validation';
import { searchPublicProfilesByUsernamePrefix } from '../../services/userService';
import {
  createWatchParty,
  updateWatchParty,
} from '../../services/watchParties/watchPartyService';
import type {
  AtaCommunity,
  AtaPublicProfile,
  AtaUserAccount,
  ChallengeAnimeTarget,
  WatchParty,
  WatchPartyVisibility,
} from '../../types';
import { AnimeMultiPicker } from '../challenges/AnimeMultiPicker';

interface WatchPartyFormModalProps {
  isOpen: boolean;
  currentProfile: AtaPublicProfile | AtaUserAccount;
  existingParty?: WatchParty | null;
  lockedCommunity?: AtaCommunity | null;
  memberCommunities?: AtaCommunity[];
  onClose: () => void;
  onSaved: (party?: WatchParty) => void;
}

const COMMON_TIMEZONES = [
  'Africa/Johannesburg',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function defaultWatchDate(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

export const WatchPartyFormModal: React.FC<WatchPartyFormModalProps> = ({
  isOpen,
  currentProfile,
  existingParty,
  lockedCommunity,
  memberCommunities = [],
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(existingParty);
  const detectedTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAnime, setSelectedAnime] = useState<ChallengeAnimeTarget[]>([]);
  const [episodeNumberText, setEpisodeNumberText] = useState('1');
  const [scheduledDate, setScheduledDate] = useState(defaultWatchDate);
  const [startTime, setStartTime] = useState('20:00');
  const [timezone, setTimezone] = useState(detectedTz);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [participantLimitText, setParticipantLimitText] = useState('');
  const [visibility, setVisibility] = useState<WatchPartyVisibility>('public');
  const [communityId, setCommunityId] = useState('');
  const [discussionEnabled, setDiscussionEnabled] = useState(true);
  const [invitedUsers, setInvitedUsers] = useState<AtaPublicProfile[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteMatches, setInviteMatches] = useState<AtaPublicProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (existingParty) {
      setTitle(existingParty.title);
      setDescription(existingParty.description);
      setSelectedAnime([
        {
          animeId: existingParty.animeId,
          title: existingParty.animeTitle,
          coverImage: existingParty.animeCoverUrl,
          totalEpisodes: null,
        },
      ]);
      setEpisodeNumberText(
        existingParty.episodeNumber ? String(existingParty.episodeNumber) : ''
      );
      setScheduledDate(existingParty.scheduledDate);
      setStartTime(existingParty.startTime);
      setTimezone(existingParty.timezone);
      setDurationMinutes(String(existingParty.estimatedDurationMinutes));
      setParticipantLimitText(
        existingParty.participantLimit
          ? String(existingParty.participantLimit)
          : ''
      );
      setVisibility(existingParty.visibility);
      setCommunityId(existingParty.communityId);
      setDiscussionEnabled(existingParty.discussionEnabled);
    } else {
      setTitle('');
      setDescription('');
      setSelectedAnime([]);
      setEpisodeNumberText('1');
      setScheduledDate(defaultWatchDate());
      setStartTime('20:00');
      setTimezone(detectedTz);
      setDurationMinutes('30');
      setParticipantLimitText('');
      setDiscussionEnabled(true);
      setInvitedUsers([]);
      if (lockedCommunity) {
        setVisibility('community');
        setCommunityId(lockedCommunity.id);
      } else {
        setVisibility('public');
        setCommunityId(memberCommunities[0]?.id || '');
      }
    }
    setError(null);
  }, [isOpen, existingParty, lockedCommunity, memberCommunities, detectedTz]);

  useEffect(() => {
    if (visibility !== 'private' || inviteSearch.trim().length < 2) {
      setInviteMatches([]);
      return;
    }
    let active = true;
    const t = window.setTimeout(async () => {
      try {
        const res = await searchPublicProfilesByUsernamePrefix(
          inviteSearch.trim(),
          6
        );
        if (active) {
          setInviteMatches(res.filter((u: AtaPublicProfile) => u.uid !== currentProfile.uid));
        }
      } catch {
        if (active) setInviteMatches([]);
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [visibility, inviteSearch, currentProfile.uid]);

  if (!isOpen) return null;

  const selectedCommunity =
    lockedCommunity ||
    memberCommunities.find((c) => c.id === communityId) ||
    null;

  const timezoneOptions = Array.from(
    new Set([detectedTz, timezone, ...COMMON_TIMEZONES])
  ).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (selectedAnime.length === 0) {
      setError('Select an anime title from AniList for this watch party.');
      return;
    }

    const epNum = episodeNumberText.trim()
      ? Number(episodeNumberText.trim())
      : null;
    const parsedLimit = participantLimitText.trim()
      ? Number(participantLimitText.trim())
      : null;

    setIsSubmitting(true);
    try {
      if (existingParty) {
        await updateWatchParty(existingParty.id, {
          title,
          description,
          episodeNumber: epNum,
          scheduledDate,
          startTime,
          timezone,
          estimatedDurationMinutes: Number(durationMinutes) || 30,
          participantLimit: parsedLimit,
          discussionEnabled,
          registrationClosed: existingParty.registrationClosed,
        });
        onSaved();
      } else {
        const primary = selectedAnime[0];
        const created = await createWatchParty(currentProfile, {
          title,
          description,
          animeId: primary.animeId,
          animeTitle: primary.title,
          animeCoverUrl: primary.coverImage,
          episodeNumber: epNum,
          scheduledDate,
          startTime,
          timezone,
          estimatedDurationMinutes: Number(durationMinutes) || 30,
          participantLimit: parsedLimit,
          visibility,
          communityId:
            visibility === 'community' ? selectedCommunity?.id || '' : '',
          communityName:
            visibility === 'community' ? selectedCommunity?.name || '' : '',
          communityVisibility:
            visibility === 'community'
              ? selectedCommunity?.visibility || 'public'
              : 'none',
          invitedUserIds:
            visibility === 'private' ? invitedUsers.map((u) => u.uid) : [],
          discussionEnabled,
        });
        onSaved(created);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save watch party.'
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
      aria-labelledby="ata-wp-form-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] shadow-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D4D7E2] dark:border-[#303342] pb-4">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="h-5 w-5 text-[#EF3038]" />
            <div>
              <h2
                id="ata-wp-form-title"
                className="font-display-space font-bold text-lg text-[#090B14] dark:text-white"
              >
                {isEditing ? 'Edit Watch Party' : 'Schedule Watch Party'}
              </h2>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Coordinate a scheduled group watch session and live discussion.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close watch party form"
            className="h-9 w-9 rounded-lg border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
          <span>{INDEPENDENT_WATCH_NOTICE}</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#EF3038]/50 bg-[#EF3038]/10 p-3 text-xs text-[#EF3038]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isEditing && (
            <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] p-3.5">
              <AnimeMultiPicker
                selected={selectedAnime}
                onChange={setSelectedAnime}
                maxSelection={1}
                label="Select Anime Title *"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Watch Party Title *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Night Episode 12 Group Watch"
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Description & Discussion Focus *
              </label>
              <textarea
                required
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share watch instructions, spoiler expectations, and discussion prompts..."
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Episode Number (optional for films)
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={episodeNumberText}
                onChange={(e) => setEpisodeNumberText(e.target.value)}
                placeholder="e.g. 1"
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Estimated Duration (minutes) *
              </label>
              <input
                type="number"
                required
                min={10}
                max={480}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Scheduled Date *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Start Time (24h) *
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                Host Timezone *
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              >
                {timezoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
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
                max={2000}
                value={participantLimitText}
                onChange={(e) => setParticipantLimitText(e.target.value)}
                placeholder="Unlimited"
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
                      setVisibility(e.target.value as WatchPartyVisibility)
                    }
                    className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038] disabled:opacity-70"
                  >
                    <option value="public">Public Watch Party</option>
                    <option value="private">Private (Invite Only)</option>
                    {(lockedCommunity || memberCommunities.length > 0) && (
                      <option value="community">Community Watch Party</option>
                    )}
                  </select>
                </div>

                {visibility === 'community' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5">
                      Community *
                    </label>
                    <select
                      value={communityId}
                      disabled={Boolean(lockedCommunity)}
                      onChange={(e) => setCommunityId(e.target.value)}
                      className="w-full rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038] disabled:opacity-70"
                    >
                      {(lockedCommunity
                        ? [lockedCommunity]
                        : memberCommunities
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
          </div>

          {!isEditing && visibility === 'private' && (
            <div className="rounded-xl border border-[#D4D7E2] dark:border-[#303342] bg-[#F4F5F8] dark:bg-[#090B14] p-3.5 space-y-2.5">
              <label className="block text-xs font-semibold text-[#090B14] dark:text-white">
                Invite Specific Friends (Private Party)
              </label>
              {invitedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {invitedUsers.map((u) => (
                    <span
                      key={u.uid}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF3038]/15 border border-[#EF3038]/40 px-2.5 py-1 text-xs text-[#090B14] dark:text-white"
                    >
                      @{u.username}
                      <button
                        type="button"
                        onClick={() =>
                          setInvitedUsers((prev) =>
                            prev.filter((p) => p.uid !== u.uid)
                          )
                        }
                        className="text-[#EF3038]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="search"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search username to invite..."
                className="w-full rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-2 text-xs text-[#090B14] dark:text-white"
              />
              {inviteMatches.length > 0 && (
                <div className="space-y-1">
                  {inviteMatches.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => {
                        if (!invitedUsers.some((i) => i.uid === u.uid)) {
                          setInvitedUsers((prev) => [...prev, u]);
                        }
                        setInviteSearch('');
                      }}
                      className="w-full text-left rounded-lg border border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] px-3 py-1.5 text-xs text-[#090B14] dark:text-white hover:border-[#EF3038]"
                    >
                      + {u.displayName} (@{u.username})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 text-xs font-medium text-[#090B14] dark:text-white cursor-pointer">
            <input
              type="checkbox"
              checked={discussionEnabled}
              onChange={(e) => setDiscussionEnabled(e.target.checked)}
              className="accent-[#EF3038]"
            />
            Enable live episode discussion & reaction thread for participants
          </label>

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
              className="min-h-[44px] px-5 rounded-xl bg-[#EF3038] hover:bg-[#B92335] text-white text-xs font-semibold disabled:opacity-60"
            >
              {isSubmitting
                ? 'Saving Watch Party...'
                : isEditing
                  ? 'Save Schedule Updates'
                  : 'Create Watch Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
