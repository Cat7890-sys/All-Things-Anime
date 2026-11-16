import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Edit3,
  Flag,
  Reply,
  Trash2,
  X,
} from 'lucide-react';
import type { AtaMessage } from '../../types';
import {
  canEditMessageWithinWindow,
  MESSAGE_MAX_LENGTH,
} from '../../services/validation';
import { formatRelativeTimestamp } from '../../utils/time';
import { UserAvatar } from '../UserAvatar';

interface MessageBubbleProps {
  message: AtaMessage;
  isOwn: boolean;
  isGroup: boolean;
  isReadByPeer: boolean;
  isConversationActive: boolean;
  onReply: (message: AtaMessage) => void;
  onEdit: (message: AtaMessage, newText: string) => Promise<void>;
  onDelete: (message: AtaMessage) => Promise<void>;
  onReport: (message: AtaMessage) => void;
  onInspectSender?: (uid: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isGroup,
  isReadByPeer,
  isConversationActive,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onInspectSender,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (message.messageType === 'system') {
    return (
      <div className="py-2 px-3 flex items-center justify-center">
        <p className="text-[11px] font-medium text-[#52576B] dark:text-[#A7A9B8] text-center bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-lg px-3 py-1.5">
          {message.text}
        </p>
      </div>
    );
  }

  const isDeleted = Boolean(message.deletedAt);
  const canEdit =
    isOwn &&
    !isDeleted &&
    isConversationActive &&
    canEditMessageWithinWindow(message.createdAt);
  const canDelete = isOwn && !isDeleted && isConversationActive;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await onEdit(message, editDraft);
      setIsEditing(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to edit message.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (isSubmitting) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await onDelete(message);
      setConfirmDelete(false);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete message.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`group flex gap-2.5 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isOwn && isGroup && (
        <button
          type="button"
          onClick={() => onInspectSender?.(message.senderId)}
          aria-label={`View ${message.senderDisplayName}'s profile`}
          className="self-end shrink-0"
        >
          <UserAvatar
            displayName={message.senderDisplayName}
            avatarUrl={message.senderAvatarUrl}
            size="sm"
            className="h-8 w-8 text-[10px]"
          />
        </button>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[72%] flex flex-col ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {!isOwn && isGroup && (
          <button
            type="button"
            onClick={() => onInspectSender?.(message.senderId)}
            className="mb-1 text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8] hover:text-[#EF3038] transition-colors"
          >
            {message.senderDisplayName} · @{message.senderUsername}
          </button>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2.5 border text-sm leading-relaxed break-words ${
            isDeleted
              ? 'bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] italic'
              : isOwn
                ? 'bg-[#EF3038] border-[#B92335] text-white'
                : 'bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white'
          }`}
        >
          {message.replyToMessageId && !isDeleted && (
            <div
              className={`mb-2 rounded-lg px-2.5 py-1.5 text-xs border ${
                isOwn
                  ? 'bg-[#B92335]/60 border-white/25 text-white/95'
                  : 'bg-white dark:bg-[#171923] border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8]'
              }`}
            >
              <p className="font-semibold text-[11px]">
                Replying to {message.replyToSenderName || 'message'}
              </p>
              <p className="truncate">{message.replyToPreview}</p>
            </div>
          )}

          {isDeleted ? (
            <p className="text-xs">Message deleted</p>
          ) : isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-2 min-w-[220px]">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={3}
                maxLength={MESSAGE_MAX_LENGTH}
                className="w-full rounded-xl bg-white dark:bg-[#171923] text-[#090B14] dark:text-white border border-[#D4D7E2] dark:border-[#303342] px-2.5 py-2 text-xs focus:outline-none focus:border-[#090B14] dark:focus:border-white"
              />
              {actionError && (
                <p className="text-[11px] text-white bg-[#090B14]/70 rounded px-2 py-1">
                  {actionError}
                </p>
              )}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditDraft(message.text);
                    setActionError(null);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] text-[11px] font-semibold rounded-lg bg-[#090B14]/30 text-white hover:bg-[#090B14]/50"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editDraft.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] text-[11px] font-semibold rounded-lg bg-white text-[#090B14] disabled:opacity-60"
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>

        {/* Inline Delete Confirmation */}
        {confirmDelete && !isDeleted && (
          <div className="mt-1.5 rounded-xl bg-white dark:bg-[#171923] border border-[#EF3038] px-3 py-2 flex items-center gap-2 text-xs">
            <span className="text-[#090B14] dark:text-white">
              Delete this message?
            </span>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-[11px] font-semibold text-[#52576B] dark:text-[#A7A9B8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleConfirmDelete()}
              className="px-2.5 py-1 rounded-lg bg-[#EF3038] text-white text-[11px] font-semibold disabled:opacity-60"
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}

        {/* Timestamp, Read Receipt & Compact Actions */}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#52576B] dark:text-[#A7A9B8]">
          <span className="tabular-nums">
            {formatRelativeTimestamp(message.createdAt)}
            {message.editedAt ? ' · Edited' : ''}
          </span>

          {isOwn && !isDeleted && (
            <span
              aria-label={isReadByPeer ? 'Seen' : 'Delivered'}
              className="inline-flex items-center gap-0.5"
            >
              {isReadByPeer ? (
                <CheckCheck
                  className="h-3.5 w-3.5 text-[#EF3038]"
                  aria-hidden="true"
                />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{isReadByPeer ? 'Seen' : 'Sent'}</span>
            </span>
          )}

          {!isDeleted && !isEditing && (
            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {isConversationActive && (
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  aria-label="Reply to message"
                  className="p-1 rounded hover:text-[#090B14] dark:hover:text-white"
                >
                  <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDraft(message.text);
                    setIsEditing(true);
                    setConfirmDelete(false);
                  }}
                  aria-label="Edit message"
                  className="p-1 rounded hover:text-[#090B14] dark:hover:text-white"
                >
                  <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete((prev) => !prev)}
                  aria-label="Delete message"
                  className="p-1 rounded hover:text-[#EF3038]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              {!isOwn && (
                <button
                  type="button"
                  onClick={() => onReport(message)}
                  aria-label="Report message"
                  className="p-1 rounded hover:text-[#EF3038]"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
