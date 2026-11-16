import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  LogOut,
  Plus,
  Shield,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaUserAccount,
} from '../../types';
import {
  addGroupMember,
  deleteGroupConversation,
  leaveGroupConversation,
  removeGroupMember,
  setGroupMemberRole,
  setGroupStatus,
} from '../../services/messaging/groupConversationService';
import { lookupPublicProfileByUsername } from '../../services/messaging/messagingSettingsService';
import { GROUP_MAX_PARTICIPANTS } from '../../services/validation';
import { UserAvatar } from '../UserAvatar';

interface GroupMembersModalProps {
  isOpen: boolean;
  conversation: AtaConversation;
  members: AtaConversationMember[];
  currentUserAccount: AtaUserAccount;
  onClose: () => void;
  onEditDetails: () => void;
  onGroupRemovedOrLeft: () => void;
  onInspectProfile: (uid: string) => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  isOpen,
  conversation,
  members,
  currentUserAccount,
  onClose,
  onEditDetails,
  onGroupRemovedOrLeft,
  onInspectProfile,
}) => {
  const [newHandle, setNewHandle] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOwner = conversation.ownerId === currentUserAccount.uid;
  const isAdmin = conversation.adminIds.includes(currentUserAccount.uid);
  const isArchived = conversation.status === 'archived';

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy || !newHandle.trim()) return;
    setError(null);
    setIsBusy(true);
    try {
      const profile = await lookupPublicProfileByUsername(newHandle);
      if (!profile) {
        setError('No ATA member found with that @username.');
        return;
      }
      await addGroupMember(conversation, currentUserAccount, profile);
      setNewHandle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleRole = async (member: AtaConversationMember) => {
    if (isBusy || !isOwner) return;
    setError(null);
    setIsBusy(true);
    try {
      const nextRole = member.role === 'admin' ? 'member' : 'admin';
      await setGroupMemberRole(
        conversation,
        currentUserAccount.uid,
        member.userId,
        nextRole
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveMember = async (member: AtaConversationMember) => {
    if (isBusy) return;
    setError(null);
    setIsBusy(true);
    try {
      await removeGroupMember(conversation, currentUserAccount, member);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to remove member.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeave = async () => {
    if (isBusy || isOwner) return;
    setError(null);
    setIsBusy(true);
    try {
      await leaveGroupConversation(conversation, currentUserAccount);
      onGroupRemovedOrLeft();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave group.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleArchive = async () => {
    if (isBusy || !isOwner) return;
    setError(null);
    setIsBusy(true);
    try {
      await setGroupStatus(
        conversation.id,
        currentUserAccount.uid,
        isArchived ? 'active' : 'archived'
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update group status.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (isBusy || !isOwner) return;
    setError(null);
    setIsBusy(true);
    try {
      await deleteGroupConversation(conversation, currentUserAccount.uid);
      onGroupRemovedOrLeft();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete group.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-group-members-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              Group Roster &amp; Governance
            </p>
            <h2
              id="ata-group-members-title"
              className="font-display-space font-bold text-lg text-white truncate flex items-center gap-2"
            >
              <Users className="h-4 w-4 text-[#EF3038] shrink-0" aria-hidden="true" />
              <span className="truncate">{conversation.name}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close group settings"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          )}

          {conversation.description && (
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
              {conversation.description}
            </p>
          )}

          {isAdmin && !isArchived && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDetails();
                }}
                className="px-3.5 py-2 min-h-[38px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038]"
              >
                Edit Group Info
              </button>
              <span className="text-xs text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                {members.length} / {GROUP_MAX_PARTICIPANTS} members
              </span>
            </div>
          )}

          {isAdmin && !isArchived && members.length < GROUP_MAX_PARTICIPANTS && (
            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandleInputSafe(e.target.value, setNewHandle)}
                placeholder="Add member by @username"
                aria-label="Add group member by username"
                className="flex-1 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
              />
              <button
                type="submit"
                disabled={isBusy || !newHandle.trim()}
                className="inline-flex items-center gap-1 px-3.5 min-h-[40px] rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335] disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add</span>
              </button>
            </form>
          )}

          {/* Member List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#52576B] dark:text-[#A7A9B8]">
              Members ({members.length})
            </h3>
            <div className="space-y-2">
              {members.map((member) => {
                const isSelf = member.userId === currentUserAccount.uid;
                const canRemove =
                  !isArchived &&
                  !isSelf &&
                  member.role !== 'owner' &&
                  (isOwner || (isAdmin && member.role === 'member'));

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onInspectProfile(member.userId);
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <UserAvatar
                        displayName={member.displayName}
                        avatarUrl={member.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#090B14] dark:text-white truncate">
                          {member.displayName}
                          {isSelf ? ' (You)' : ''}
                        </p>
                        <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                          @{member.username} ·{' '}
                          <span className="font-semibold text-[#B92335] dark:text-[#EF3038] capitalize">
                            {member.role}
                          </span>
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner && !isSelf && member.role !== 'owner' && !isArchived && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleRole(member)}
                          title={
                            member.role === 'admin'
                              ? 'Demote to Member'
                              : 'Promote to Admin'
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[11px] font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038]"
                        >
                          <Shield className="h-3 w-3 text-[#EF3038]" aria-hidden="true" />
                          <span>
                            {member.role === 'admin' ? 'Demote' : 'Make Admin'}
                          </span>
                        </button>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleRemoveMember(member)}
                          aria-label={`Remove @${member.username}`}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]"
                        >
                          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave / Archive / Delete Actions */}
          <div className="border-t border-[#D4D7E2] dark:border-[#303342] pt-4 space-y-3">
            {!isOwner && (
              <>
                {confirmLeave ? (
                  <div className="rounded-xl border border-[#EF3038] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#090B14] dark:text-white">
                      Leave &ldquo;{conversation.name}&rdquo;? You will lose
                      access to future messages.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmLeave(false)}
                        className="px-3 py-1.5 font-semibold text-[#52576B] dark:text-[#A7A9B8]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleLeave()}
                        className="px-3 py-1.5 rounded-lg bg-[#EF3038] text-white font-semibold"
                      >
                        Leave Group
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(true)}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#EF3038] hover:border-[#EF3038]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Leave Group</span>
                  </button>
                )}
              </>
            )}

            {isOwner && (
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleToggleArchive()}
                  className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038]"
                >
                  <Archive className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
                  <span>
                    {isArchived
                      ? 'Restore Group to Active'
                      : 'Archive Group (Read-Only)'}
                  </span>
                </button>

                {confirmDelete ? (
                  <div className="rounded-xl border border-[#EF3038] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#090B14] dark:text-white">
                      Permanently delete this group for all participants?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 font-semibold text-[#52576B] dark:text-[#A7A9B8]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteGroup()}
                        className="px-3 py-1.5 rounded-lg bg-[#EF3038] text-white font-semibold"
                      >
                        {isBusy ? 'Deleting...' : 'Delete Permanently'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] text-xs font-semibold text-[#B92335] dark:text-[#EF3038] hover:bg-[#EF3038] hover:text-white transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Delete Group Permanently</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function setNewHandleInputSafe(
  val: string,
  setter: React.Dispatch<React.SetStateAction<string>>
) {
  setter(val);
}
