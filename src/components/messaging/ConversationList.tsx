import React, { useMemo, useState } from 'react';
import { Archive, Inbox, Search } from 'lucide-react';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaPublicProfile,
} from '../../types';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { ConversationListItem } from './ConversationListItem';

interface ConversationListProps {
  conversations: AtaConversation[];
  currentUid: string;
  memberStates: Record<string, AtaConversationMember>;
  peerProfiles: Record<string, AtaPublicProfile>;
  selectedConversationId: string | null;
  filterMode: 'all' | 'direct' | 'groups';
  isLoading: boolean;
  onSelectConversation: (conversationId: string) => void;
  onStartNewDirect: () => void;
  onStartNewGroup: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentUid,
  memberStates,
  peerProfiles,
  selectedConversationId,
  filterMode,
  isLoading,
  onSelectConversation,
  onStartNewDirect,
  onStartNewGroup,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (filterMode === 'direct' && conv.type !== 'direct') return false;
      if (filterMode === 'groups' && conv.type !== 'group') return false;

      const memberState = memberStates[conv.id];
      const isUserArchived =
        Boolean(memberState?.archived) || conv.status === 'archived';
      if (showArchived ? !isUserArchived : isUserArchived) return false;

      if (!query) return true;
      if (conv.type === 'group') {
        return (
          conv.name.toLowerCase().includes(query) ||
          conv.lastMessageText.toLowerCase().includes(query)
        );
      }
      const peerId = conv.participantIds.find((id) => id !== currentUid) || '';
      const peer = peerProfiles[peerId];
      return (
        (peer?.displayName || '').toLowerCase().includes(query) ||
        (peer?.username || '').toLowerCase().includes(query) ||
        conv.lastMessageText.toLowerCase().includes(query)
      );
    });
  }, [
    conversations,
    currentUid,
    filterMode,
    memberStates,
    peerProfiles,
    searchTerm,
    showArchived,
  ]);

  return (
    <div className="flex flex-col h-full">
      {/* Search + Archive Filter */}
      <div className="p-3 border-b border-[#D4D7E2] dark:border-[#303342] space-y-2.5">
        <div className="relative">
          <Search
            className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats or @handles..."
            aria-label="Search conversations"
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:outline-none focus:border-[#EF3038]"
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg border font-semibold transition-colors ${
              showArchived
                ? 'bg-[#EF3038]/10 border-[#EF3038] text-[#B92335] dark:text-[#EF3038]'
                : 'bg-[#F4F5F8] dark:bg-[#090B14] border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{showArchived ? 'Viewing Archived' : 'Archived Chats'}</span>
          </button>

          <span className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
            {filteredConversations.length} threads
          </span>
        </div>
      </div>

      {/* List Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 px-4">
            <AtaLoadingSpinner size="sm" label="Loading conversations" />
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
              Syncing conversations...
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-10 px-5 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center">
              <Inbox
                className="h-5 w-5 text-[#52576B] dark:text-[#A7A9B8]"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-1">
              <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
                {showArchived
                  ? 'No archived conversations'
                  : searchTerm.trim()
                    ? 'No matching conversations'
                    : filterMode === 'groups'
                      ? 'No group conversations yet'
                      : 'Your inbox is quiet'}
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                {showArchived
                  ? 'Threads you archive will stay tucked away here.'
                  : 'Send a direct message request to a member or start a watch-group circle.'}
              </p>
            </div>
            {!showArchived && !searchTerm.trim() && (
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onStartNewDirect}
                  className="px-3 py-2 min-h-[38px] text-xs font-semibold rounded-xl bg-[#EF3038] text-white border border-[#B92335] hover:bg-[#B92335] transition-colors"
                >
                  New Direct Message
                </button>
                <button
                  type="button"
                  onClick={onStartNewGroup}
                  className="px-3 py-2 min-h-[38px] text-xs font-semibold rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] text-[#090B14] dark:text-white border border-[#D4D7E2] dark:border-[#303342] hover:border-[#EF3038] transition-colors"
                >
                  Create Group
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const peerId =
              conv.type === 'direct'
                ? conv.participantIds.find((id) => id !== currentUid) || ''
                : '';
            return (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                currentUid={currentUid}
                memberState={memberStates[conv.id]}
                peerProfile={peerId ? peerProfiles[peerId] : null}
                isSelected={selectedConversationId === conv.id}
                onSelect={() => onSelectConversation(conv.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
