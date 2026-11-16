import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Image as ImageIcon,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AtaConversation,
  AtaPublicProfile,
  AtaUserAccount,
} from '../../types';
import {
  createGroupConversation,
  updateGroupConversationDetails,
} from '../../services/messaging/groupConversationService';
import { lookupPublicProfileByUsername } from '../../services/messaging/messagingSettingsService';
import { checkBlockBetween } from '../../services/socialGraphService';
import {
  GROUP_DESC_MAX_LENGTH,
  GROUP_MAX_PARTICIPANTS,
  GROUP_NAME_MAX_LENGTH,
} from '../../services/validation';
import { UserAvatar } from '../UserAvatar';

interface GroupConversationModalProps {
  isOpen: boolean;
  currentUserAccount: AtaUserAccount;
  editingGroup?: AtaConversation | null;
  onClose: () => void;
  onCreated?: (conversation: AtaConversation) => void;
  onUpdated?: () => void;
}

export const GroupConversationModal: React.FC<GroupConversationModalProps> = ({
  isOpen,
  currentUserAccount,
  editingGroup = null,
  onClose,
  onCreated,
  onUpdated,
}) => {
  const isEditing = Boolean(editingGroup);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [memberHandleInput, setMemberHandleInput] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<AtaPublicProfile[]>(
    []
  );
  const [isLookingUpMember, setIsLookingUpMember] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setMemberHandleInput('');
    setSelectedMembers([]);
    setAvatarFile(null);
    setRemoveAvatar(false);

    if (editingGroup) {
      setName(editingGroup.name);
      setDescription(editingGroup.description);
      setAvatarUrl(editingGroup.avatarUrl);
    } else {
      setName('');
      setDescription('');
      setAvatarUrl('');
    }
  }, [isOpen, editingGroup]);

  if (!isOpen) return null;

  const handleAddParticipant = async () => {
    if (isLookingUpMember || !memberHandleInput.trim()) return;
    setError(null);

    if (selectedMembers.length + 1 >= GROUP_MAX_PARTICIPANTS) {
      setError(
        `Groups support up to ${GROUP_MAX_PARTICIPANTS} participants total.`
      );
      return;
    }

    setIsLookingUpMember(true);
    try {
      const profile = await lookupPublicProfileByUsername(memberHandleInput);
      if (!profile) {
        setError('No ATA member found with that @username.');
        return;
      }
      if (profile.uid === currentUserAccount.uid) {
        setError('You are automatically included as the group owner.');
        return;
      }
      if (selectedMembers.some((m) => m.uid === profile.uid)) {
        setError(`@${profile.username} is already added.`);
        return;
      }
      const blockState = await checkBlockBetween(
        currentUserAccount.uid,
        profile.uid
      );
      if (blockState.blockedByMe || blockState.blockedByThem) {
        setError(
          `Cannot invite @${profile.username} due to an active account block.`
        );
        return;
      }
      setSelectedMembers((prev) => [...prev, profile]);
      setMemberHandleInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setIsLookingUpMember(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (editingGroup) {
        await updateGroupConversationDetails(
          editingGroup,
          currentUserAccount.uid,
          {
            name,
            description,
            avatarUrl,
            avatarFile,
            removeAvatar,
          }
        );
        onUpdated?.();
      } else {
        const created = await createGroupConversation(
          currentUserAccount,
          {
            name,
            description,
            participantIds: selectedMembers.map((m) => m.uid),
            avatarUrl,
            avatarFile,
          },
          selectedMembers
        );
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save group conversation.'
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
      aria-labelledby="ata-group-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              Private Group Chat
            </p>
            <h2
              id="ata-group-modal-title"
              className="font-display-space font-bold text-lg text-white flex items-center gap-2"
            >
              <Users className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              <span>{isEditing ? 'Edit Group Details' : 'Create Group'}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close group modal"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
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

          <div>
            <label
              htmlFor="ata-group-name"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Group Name
            </label>
            <input
              id="ata-group-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={GROUP_NAME_MAX_LENGTH}
              placeholder="e.g. Friday Mecha Watch Circle"
              className="w-full min-h-[42px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
            />
          </div>

          <div>
            <label
              htmlFor="ata-group-desc"
              className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
            >
              Topic / Description (optional)
            </label>
            <textarea
              id="ata-group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={GROUP_DESC_MAX_LENGTH}
              placeholder="Episode schedules, spoiler etiquette, or group focus..."
              className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
            />
          </div>

          {/* Group Avatar */}
          <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 space-y-2.5">
            <p className="text-xs font-semibold text-[#090B14] dark:text-white flex items-center gap-1.5">
              <ImageIcon
                className="h-3.5 w-3.5 text-[#EF3038]"
                aria-hidden="true"
              />
              <span>Group Icon (optional)</span>
            </p>
            <input
              type="url"
              value={removeAvatar ? '' : avatarUrl}
              disabled={Boolean(avatarFile)}
              onChange={(e) => {
                setRemoveAvatar(false);
                setAvatarUrl(e.target.value);
              }}
              placeholder="https://... (optional HTTPS image URL)"
              aria-label="Group icon HTTPS URL"
              className="w-full min-h-[38px] rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-3 py-1.5 text-xs text-[#090B14] dark:text-white disabled:opacity-50 focus:outline-none focus:border-[#EF3038]"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white cursor-pointer hover:border-[#EF3038]">
                <span>{avatarFile ? avatarFile.name : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAvatarFile(file);
                    setRemoveAvatar(false);
                  }}
                />
              </label>

              {(avatarFile || avatarUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setAvatarFile(null);
                    setAvatarUrl('');
                    setRemoveAvatar(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#EF3038]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove icon</span>
                </button>
              )}
            </div>
          </div>

          {/* Initial Participants (Create mode) */}
          {!isEditing && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ata-group-member-add"
                  className="text-xs font-semibold text-[#090B14] dark:text-white"
                >
                  Invite Members by @username
                </label>
                <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
                  {selectedMembers.length + 1} / {GROUP_MAX_PARTICIPANTS}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  id="ata-group-member-add"
                  type="text"
                  value={memberHandleInput}
                  onChange={(e) => setMemberHandleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddParticipant();
                    }
                  }}
                  placeholder="Enter exact @username"
                  className="flex-1 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                />
                <button
                  type="button"
                  disabled={isLookingUpMember || !memberHandleInput.trim()}
                  onClick={() => void handleAddParticipant()}
                  className="inline-flex items-center gap-1 px-3.5 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                  <span>{isLookingUpMember ? 'Adding...' : 'Add'}</span>
                </button>
              </div>

              {selectedMembers.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.uid}
                      className="flex items-center justify-between gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          displayName={member.displayName}
                          avatarUrl={member.avatarUrl}
                          size="sm"
                          className="h-7 w-7 text-[10px]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#090B14] dark:text-white truncate">
                            {member.displayName}
                          </p>
                          <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                            @{member.username}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMembers((prev) =>
                            prev.filter((m) => m.uid !== member.uid)
                          )
                        }
                        aria-label={`Remove @${member.username}`}
                        className="p-1.5 rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038]"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 min-h-[42px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 min-h-[42px] rounded-xl bg-[#EF3038] border border-[#B92335] text-xs font-semibold text-white hover:bg-[#B92335] disabled:opacity-60"
            >
              {isSubmitting
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
