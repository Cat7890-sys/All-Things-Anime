import React from 'react';
import { Archive, BellOff, Users } from 'lucide-react';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaPublicProfile,
} from '../../types';
import { formatRelativeTimestamp } from '../../utils/time';
import { UserAvatar } from '../UserAvatar';

interface ConversationListItemProps {
  conversation: AtaConversation;
  currentUid: string;
  memberState?: AtaConversationMember;
  peerProfile?: AtaPublicProfile | null;
  isSelected: boolean;
  onSelect: () => void;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  currentUid,
  memberState,
  peerProfile,
  isSelected,
  onSelect,
}) => {
  const isGroup = conversation.type === 'group';
  const title = isGroup
    ? conversation.name || 'Group Conversation'
    : peerProfile?.displayName || 'ATA Member';
  const subtitleHandle = isGroup
    ? `${conversation.participantIds.length} members`
    : peerProfile?.username
      ? `@${peerProfile.username}`
      : 'Direct Message';
  const avatarUrl = isGroup
    ? conversation.avatarUrl
    : peerProfile?.avatarUrl || '';

  const unreadCount = memberState?.unreadCount ?? 0;
  const isMuted = Boolean(memberState?.muted);
  const isArchived =
    Boolean(memberState?.archived) || conversation.status === 'archived';

  const previewPrefix =
    conversation.lastMessageType === 'text' &&
    conversation.lastMessageSenderId === currentUid
      ? 'You: '
      : '';
  const previewText = conversation.lastMessageText
    ? `${previewPrefix}${conversation.lastMessageText}`
    : 'No messages yet';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full text-left px-3.5 py-3 min-h-[64px] flex items-center gap-3 border-b border-[#D4D7E2]/70 dark:border-[#303342]/70 transition-colors ${
        isSelected
          ? 'bg-[#EF3038]/10 dark:bg-[#EF3038]/15'
          : 'hover:bg-[#F4F5F8] dark:hover:bg-[#090B14]/70'
      }`}
    >
      <div className="relative shrink-0">
        {isGroup && !avatarUrl ? (
          <div className="h-10 w-10 rounded-full border-2 border-[#EF3038] bg-[#090B14] text-white flex items-center justify-center">
            <Users className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
          </div>
        ) : (
          <UserAvatar displayName={title} avatarUrl={avatarUrl} size="sm" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white truncate">
            {title}
          </p>
          <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] shrink-0 tabular-nums">
            {formatRelativeTimestamp(conversation.lastMessageAt)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`text-xs truncate ${
              unreadCount > 0
                ? 'font-semibold text-[#090B14] dark:text-white'
                : 'text-[#52576B] dark:text-[#A7A9B8]'
            }`}
          >
            {previewText}
          </p>

          <div className="flex items-center gap-1.5 shrink-0">
            {isMuted && (
              <BellOff
                className="h-3.5 w-3.5 text-[#52576B] dark:text-[#A7A9B8]"
                aria-label="Muted"
              />
            )}
            {isArchived && (
              <Archive
                className="h-3.5 w-3.5 text-[#52576B] dark:text-[#A7A9B8]"
                aria-label="Archived"
              />
            )}
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread messages`}
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-[#EF3038] text-white text-[11px] font-display-space font-bold tabular-nums"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        <p className="mt-0.5 text-[11px] text-[#52576B] dark:text-[#A7A9B8]/80 truncate">
          {subtitleHandle}
        </p>
      </div>
    </button>
  );
};
