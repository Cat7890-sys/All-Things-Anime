import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Crown,
  Shield,
  ShieldOff,
  UserMinus,
  Users,
} from 'lucide-react';
import type { CommunityMembership } from '../../types';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';

interface CommunityMembersTabProps {
  members: CommunityMembership[];
  isLoading: boolean;
  error: string | null;
  currentUserId?: string;
  isOwner: boolean;
  isModerator: boolean;
  onOpenProfile: (uid: string) => void;
  onChangeRole: (
    member: CommunityMembership,
    nextRole: 'member' | 'moderator'
  ) => Promise<void>;
  onRemoveMember: (member: CommunityMembership) => Promise<void>;
}

const ROLE_ORDER: Record<CommunityMembership['role'], number> = {
  owner: 0,
  moderator: 1,
  member: 2,
};

export const CommunityMembersTab: React.FC<CommunityMembersTabProps> = ({
  members,
  isLoading,
  error,
  currentUserId,
  isOwner,
  isModerator,
  onOpenProfile,
  onChangeRole,
  onRemoveMember,
}) => {
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const rankDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      if (rankDiff !== 0) return rankDiff;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [members]);

  const handleRoleToggle = async (member: CommunityMembership) => {
    if (busyMemberId) return;
    setActionError(null);
    setBusyMemberId(member.userId);
    try {
      const nextRole = member.role === 'moderator' ? 'member' : 'moderator';
      await onChangeRole(member, nextRole);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update member role.'
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (member: CommunityMembership) => {
    if (busyMemberId) return;
    setActionError(null);
    setBusyMemberId(member.userId);
    try {
      await onRemoveMember(member);
      setConfirmRemoveUid(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to remove member.'
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
        <AtaLoadingSpinner size="md" label="Loading members" />
        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
          Loading community roster...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-5 flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white"
      >
        <AlertCircle
          className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <span>{error}</span>
      </div>
    );
  }

  if (sortedMembers.length === 0) {
    return (
      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-8 text-center">
        <Users className="h-6 w-6 text-[#EF3038] mx-auto" aria-hidden="true" />
        <p className="mt-2 font-display-space font-bold text-base text-[#090B14] dark:text-white">
          No Members Found
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
        >
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{actionError}</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl divide-y divide-[#D4D7E2]/70 dark:divide-[#303342]">
        {sortedMembers.map((member) => {
          const isSelf = currentUserId === member.userId;
          const canManageRole = isOwner && !isSelf && member.role !== 'owner';
          const canRemove =
            !isSelf &&
            member.role !== 'owner' &&
            (isOwner || (isModerator && member.role === 'member'));
          const isBusy = busyMemberId === member.userId;

          return (
            <div key={member.id} className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onOpenProfile(member.userId)}
                  className="flex items-center gap-3 text-left group min-w-0"
                >
                  <UserAvatar
                    displayName={member.displayName}
                    avatarUrl={member.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-display-space font-bold text-sm sm:text-base text-[#090B14] dark:text-white group-hover:text-[#EF3038] transition-colors truncate">
                        {member.displayName}
                      </span>
                      <span className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                        @{member.username}
                      </span>
                      {isSelf && (
                        <span className="text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8]">
                          · You
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] font-semibold flex items-center gap-1.5">
                      {member.role === 'owner' ? (
                        <span className="inline-flex items-center gap-1 text-[#EF3038]">
                          <Crown className="h-3 w-3" aria-hidden="true" />
                          <span>Owner</span>
                        </span>
                      ) : member.role === 'moderator' ? (
                        <span className="inline-flex items-center gap-1 text-[#B92335] dark:text-[#EF3038]">
                          <Shield className="h-3 w-3" aria-hidden="true" />
                          <span>Moderator</span>
                        </span>
                      ) : (
                        <span className="text-[#52576B] dark:text-[#A7A9B8]">
                          Member
                        </span>
                      )}
                      {member.joinedAt && (
                        <span className="font-normal text-[#52576B] dark:text-[#A7A9B8]">
                          · Joined{' '}
                          {member.joinedAt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </button>

                {(canManageRole || canRemove) && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canManageRole && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRoleToggle(member)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50 transition-colors"
                      >
                        {member.role === 'moderator' ? (
                          <>
                            <ShieldOff
                              className="h-3.5 w-3.5 text-[#EF3038]"
                              aria-hidden="true"
                            />
                            <span>
                              {isBusy ? 'Updating...' : 'Demote Mod'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Shield
                              className="h-3.5 w-3.5 text-[#EF3038]"
                              aria-hidden="true"
                            />
                            <span>
                              {isBusy ? 'Updating...' : 'Promote to Mod'}
                            </span>
                          </>
                        )}
                      </button>
                    )}

                    {canRemove && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setConfirmRemoveUid((prev) =>
                            prev === member.userId ? null : member.userId
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-[#B92335] dark:text-[#EF3038] bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038] disabled:opacity-50 transition-colors"
                      >
                        <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {confirmRemoveUid === member.userId && (
                <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium text-[#090B14] dark:text-white">
                    Remove @{member.username} from this community?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmRemoveUid(null)}
                      className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white bg-white dark:bg-[#171923]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleRemove(member)}
                      className="px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] disabled:opacity-50"
                    >
                      {isBusy ? 'Removing...' : 'Confirm Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
