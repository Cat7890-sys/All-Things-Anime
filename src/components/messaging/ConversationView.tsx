import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowLeft,
  Ban,
  Bell,
  BellOff,
  Flag,
  Settings2,
  Users,
} from 'lucide-react';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaMessage,
  AtaMessageSettings,
  AtaPublicProfile,
  AtaTypingIndicator,
  AtaUserAccount,
  AtaUserPresence,
  ReportReason,
} from '../../types';
import {
  markConversationRead,
  subscribeToConversationMembers,
  toggleConversationArchive,
  toggleConversationMute,
} from '../../services/messaging/conversationService';
import { submitMessagingReport } from '../../services/messaging/messageModerationService';
import {
  deleteOwnMessage,
  editOwnMessage,
  fetchOlderMessages,
  sendTextMessage,
  subscribeToRecentMessages,
} from '../../services/messaging/messageService';
import {
  isPresenceRecentlyActive,
  subscribeToUserPresence,
} from '../../services/messaging/presenceService';
import {
  setTypingState,
  subscribeToTypingIndicators,
} from '../../services/messaging/typingService';
import { blockUser, checkBlockBetween, unblockUser } from '../../services/socialGraphService';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';
import { GroupConversationModal } from './GroupConversationModal';
import { GroupMembersModal } from './GroupMembersModal';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { MessageReportModal } from './MessageReportModal';
import { TypingIndicator } from './TypingIndicator';

const MESSAGE_PAGE_SIZE = 35;

interface ConversationViewProps {
  conversation: AtaConversation;
  currentUserAccount: AtaUserAccount;
  userSettings: AtaMessageSettings;
  ownMemberState?: AtaConversationMember;
  peerProfile?: AtaPublicProfile | null;
  onBackMobile: () => void;
  onInspectProfile: (uid: string) => void;
  onConversationRemoved: () => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  currentUserAccount,
  userSettings,
  ownMemberState,
  peerProfile,
  onBackMobile,
  onInspectProfile,
  onConversationRemoved,
}) => {
  const [recentMessages, setRecentMessages] = useState<AtaMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<AtaMessage[]>([]);
  const [oldestCursor, setOldestCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  const [members, setMembers] = useState<AtaConversationMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<AtaTypingIndicator[]>([]);
  const [peerPresence, setPeerPresence] = useState<AtaUserPresence | null>(null);

  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);

  const [replyTo, setReplyTo] = useState<AtaMessage | null>(null);
  const [showScrollLatest, setShowScrollLatest] = useState(false);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: 'message' | 'conversation';
    targetId: string;
    authorId: string;
    label: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  const isGroup = conversation.type === 'group';
  const peerId = !isGroup
    ? conversation.participantIds.find((id) => id !== currentUserAccount.uid) || ''
    : '';

  const allMessages = useMemo(() => {
    const merged = new Map<string, AtaMessage>();
    for (const msg of olderMessages) merged.set(msg.id, msg);
    for (const msg of recentMessages) merged.set(msg.id, msg);
    return Array.from(merged.values()).sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.getTime() : 0;
      const tb = b.createdAt ? b.createdAt.getTime() : 0;
      return ta - tb;
    });
  }, [olderMessages, recentMessages]);

  const scrollToLatest = useCallback((smooth = true) => {
    bottomSentinelRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
  }, []);

  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const hasLoadedOlderRef = useRef(false);

  // Reset thread local pagination/reply state when switching conversations
  useEffect(() => {
    setOlderMessages([]);
    setOldestCursor(null);
    setHasMoreOlder(false);
    setReplyTo(null);
    setMessagesError(null);
    setIsLoadingMessages(true);
    lastMarkedMessageIdRef.current = null;
    hasLoadedOlderRef.current = false;
    shouldAutoScrollRef.current = true;
  }, [conversation.id]);

  // Real-time messages listener
  useEffect(() => {
    const unsub = subscribeToRecentMessages(
      conversation.id,
      MESSAGE_PAGE_SIZE,
      (res) => {
        setRecentMessages(res.messages);
        if (!hasLoadedOlderRef.current) {
          setOldestCursor(res.oldestCursor);
          setHasMoreOlder(res.hasMore);
        }
        setIsLoadingMessages(false);
        setMessagesError(null);
      },
      (errMsg) => {
        setMessagesError(errMsg);
        setIsLoadingMessages(false);
      },
      currentUserAccount.uid
    );
    return () => unsub();
  }, [conversation.id, currentUserAccount.uid]);

  // Members listener (roles & read cursors)
  useEffect(() => {
    const unsub = subscribeToConversationMembers(
      conversation.id,
      setMembers,
      undefined,
      currentUserAccount.uid
    );
    return () => unsub();
  }, [conversation.id, currentUserAccount.uid]);

  // Typing indicators listener
  useEffect(() => {
    const unsub = subscribeToTypingIndicators(
      conversation.id,
      currentUserAccount.uid,
      setTypingUsers
    );
    return () => unsub();
  }, [conversation.id, currentUserAccount.uid]);

  // Direct peer presence & block check
  useEffect(() => {
    if (isGroup || !peerId) {
      setPeerPresence(null);
      setBlockedByMe(false);
      setBlockedByThem(false);
      return;
    }

    const unsubPresence = subscribeToUserPresence(
      peerId,
      setPeerPresence,
      currentUserAccount.uid
    );
    let active = true;
    void checkBlockBetween(currentUserAccount.uid, peerId).then((res) => {
      if (!active) return;
      setBlockedByMe(res.blockedByMe);
      setBlockedByThem(res.blockedByThem);
    });

    return () => {
      active = false;
      unsubPresence();
    };
  }, [isGroup, peerId, currentUserAccount.uid]);

  // Mark conversation read on entry & incoming unread messages without triggering loops
  useEffect(() => {
    if (isLoadingMessages || !ownMemberState) return;
    const latestMsg = allMessages[allMessages.length - 1];
    const hasUnread = (ownMemberState.unreadCount ?? 0) > 0;
    const latestMsgMs = latestMsg?.createdAt ? latestMsg.createdAt.getTime() : 0;
    const lastReadMs = ownMemberState.lastReadAt
      ? ownMemberState.lastReadAt.getTime()
      : 0;
    const hasUnreadIncoming =
      Boolean(latestMsg) &&
      latestMsg.senderId !== currentUserAccount.uid &&
      latestMsg.id !== lastMarkedMessageIdRef.current &&
      (!ownMemberState.lastReadAt || latestMsgMs > lastReadMs);

    if (!hasUnread && !hasUnreadIncoming) {
      return;
    }

    if (latestMsg) {
      lastMarkedMessageIdRef.current = latestMsg.id;
    }

    void markConversationRead(
      conversation.id,
      currentUserAccount.uid,
      userSettings.readReceiptsEnabled
    );
  }, [
    allMessages,
    conversation.id,
    currentUserAccount.uid,
    isLoadingMessages,
    ownMemberState,
    userSettings.readReceiptsEnabled,
  ]);

  // Auto-scroll when near bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToLatest(false);
    }
  }, [allMessages.length, scrollToLatest]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    shouldAutoScrollRef.current = nearBottom;
    setShowScrollLatest(!nearBottom && allMessages.length > 0);
  };

  const handleLoadOlder = async () => {
    if (!oldestCursor || isLoadingOlder) return;
    setIsLoadingOlder(true);
    try {
      const res = await fetchOlderMessages(
        conversation.id,
        oldestCursor,
        MESSAGE_PAGE_SIZE
      );
      hasLoadedOlderRef.current = true;
      setOlderMessages((prev) => [...res.messages, ...prev]);
      setOldestCursor(res.oldestCursor);
      setHasMoreOlder(res.hasMore);
    } catch (err) {
      setMessagesError(
        err instanceof Error ? err.message : 'Unable to load older messages.'
      );
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      if (!userSettings.typingIndicatorsEnabled) return;
      void setTypingState(
        conversation.id,
        {
          uid: currentUserAccount.uid,
          displayName: currentUserAccount.displayName,
        },
        isTyping
      );
    },
    [
      conversation.id,
      currentUserAccount.displayName,
      currentUserAccount.uid,
      userSettings.typingIndicatorsEnabled,
    ]
  );

  const handleSend = async (text: string) => {
    shouldAutoScrollRef.current = true;
    await sendTextMessage(conversation, currentUserAccount, text, replyTo);
    setReplyTo(null);
  };

  const handleEditMessage = async (msg: AtaMessage, newText: string) => {
    const isLatest =
      allMessages.length > 0 && allMessages[allMessages.length - 1].id === msg.id;
    await editOwnMessage(conversation, msg, newText, isLatest);
  };

  const handleDeleteMessage = async (msg: AtaMessage) => {
    const isLatest =
      allMessages.length > 0 && allMessages[allMessages.length - 1].id === msg.id;
    await deleteOwnMessage(conversation, msg, isLatest);
  };

  const handleToggleBlockPeer = async () => {
    if (!peerProfile) return;
    if (blockedByMe) {
      await unblockUser(currentUserAccount.uid, peerProfile.uid);
      setBlockedByMe(false);
    } else {
      await blockUser(
        currentUserAccount.uid,
        peerProfile.uid,
        peerProfile.username
      );
      setBlockedByMe(true);
    }
  };

  const peerMemberRecord = !isGroup
    ? members.find((m) => m.userId === peerId)
    : undefined;

  const isRecentlyActive =
    !isGroup &&
    userSettings.onlineStatusVisible &&
    isPresenceRecentlyActive(peerPresence);

  const title = isGroup
    ? conversation.name || 'Group Conversation'
    : peerProfile?.displayName || 'ATA Member';
  const avatarUrl = isGroup
    ? conversation.avatarUrl
    : peerProfile?.avatarUrl || '';
  const isMuted = Boolean(ownMemberState?.muted);
  const isUserArchived = Boolean(ownMemberState?.archived);
  const isThreadReadOnly =
    conversation.status === 'archived' || blockedByMe || blockedByThem;
  const readOnlyReason =
    conversation.status === 'archived'
      ? 'This group conversation has been archived by the owner.'
      : blockedByMe
        ? 'You blocked this member. Unblock them to continue messaging.'
        : 'Messaging is disabled because of an active account block.';

  const latestMessageId =
    allMessages.length > 0 ? allMessages[allMessages.length - 1].id : null;

  return (
    <div className="flex flex-col h-[560px] sm:h-[620px] bg-white dark:bg-[#171923]">
      {/* Sticky Conversation Header */}
      <header className="px-3.5 sm:px-4 py-3 border-b border-[#D4D7E2] dark:border-[#303342] flex items-center justify-between gap-2 bg-white dark:bg-[#171923]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackMobile}
            aria-label="Back to conversations"
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#090B14] dark:text-white hover:bg-[#F4F5F8] dark:hover:bg-[#090B14]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isGroup) {
                setShowGroupMembersModal(true);
              } else if (peerId) {
                onInspectProfile(peerId);
              }
            }}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            {isGroup && !avatarUrl ? (
              <div className="h-9 w-9 rounded-full border-2 border-[#EF3038] bg-[#090B14] text-white flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              </div>
            ) : (
              <UserAvatar displayName={title} avatarUrl={avatarUrl} size="sm" />
            )}
            <div className="min-w-0">
              <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white truncate hover:text-[#EF3038] transition-colors">
                {title}
              </p>
              <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] truncate">
                {isGroup
                  ? `${conversation.participantIds.length} members${
                      conversation.status === 'archived' ? ' · Archived' : ''
                    }`
                  : `${peerProfile?.username ? `@${peerProfile.username}` : 'Direct Chat'}${
                      isRecentlyActive ? ' · Recently active' : ''
                    }`}
              </p>
            </div>
          </button>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() =>
              void toggleConversationMute(
                conversation.id,
                currentUserAccount.uid,
                !isMuted
              )
            }
            aria-label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
            title={isMuted ? 'Unmute conversation' : 'Mute conversation'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white transition-colors"
          >
            {isMuted ? (
              <BellOff className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
            ) : (
              <Bell className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              void toggleConversationArchive(
                conversation.id,
                currentUserAccount.uid,
                !isUserArchived
              )
            }
            aria-label={isUserArchived ? 'Unarchive chat' : 'Archive chat'}
            title={isUserArchived ? 'Restore to inbox' : 'Archive chat'}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors ${
              isUserArchived
                ? 'border-[#EF3038] text-[#EF3038]'
                : 'border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#090B14] dark:hover:text-white'
            }`}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
          </button>

          {isGroup ? (
            <button
              type="button"
              onClick={() => setShowGroupMembersModal(true)}
              aria-label="Group members and settings"
              title="Members & Group Settings"
              className="min-h-[40px] px-2.5 inline-flex items-center gap-1.5 rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] transition-colors"
            >
              <Settings2 className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              <span className="hidden sm:inline">Group</span>
            </button>
          ) : (
            <>
              {peerProfile && (
                <button
                  type="button"
                  onClick={() => void handleToggleBlockPeer()}
                  aria-label={blockedByMe ? 'Unblock member' : 'Block member'}
                  title={blockedByMe ? 'Unblock member' : 'Block member'}
                  className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors ${
                    blockedByMe
                      ? 'border-[#EF3038] bg-[#EF3038]/10 text-[#EF3038]'
                      : 'border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038]'
                  }`}
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setReportTarget({
                    type: 'conversation',
                    targetId: conversation.id,
                    authorId: peerId || conversation.id,
                    label: 'Conversation',
                  })
                }
                aria-label="Report conversation"
                title="Report conversation"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Scrollable Message Timeline */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3.5 sm:px-5 py-4 space-y-3"
        >
          {hasMoreOlder && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                disabled={isLoadingOlder}
                onClick={() => void handleLoadOlder()}
                className="px-3.5 py-1.5 min-h-[36px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white hover:border-[#EF3038] disabled:opacity-60"
              >
                {isLoadingOlder ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}

          {isLoadingMessages ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <AtaLoadingSpinner size="md" label="Loading messages" />
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Syncing messages...
              </p>
            </div>
          ) : messagesError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-4 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{messagesError}</span>
            </div>
          ) : allMessages.length === 0 ? (
            <div className="py-12 text-center space-y-1.5">
              <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
                Start the conversation
              </p>
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Messages in this thread are private to participants.
              </p>
            </div>
          ) : (
            allMessages.map((msg) => {
              const isOwn = msg.senderId === currentUserAccount.uid;
              const isReadByPeer = Boolean(
                isOwn &&
                  !isGroup &&
                  userSettings.readReceiptsEnabled &&
                  peerMemberRecord?.lastReadAt &&
                  msg.createdAt &&
                  peerMemberRecord.lastReadAt.getTime() >=
                    msg.createdAt.getTime() &&
                  msg.id === latestMessageId
              );

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={isOwn}
                  isGroup={isGroup}
                  isReadByPeer={isReadByPeer}
                  isConversationActive={!isThreadReadOnly}
                  onReply={setReplyTo}
                  onEdit={handleEditMessage}
                  onDelete={handleDeleteMessage}
                  onReport={(targetMsg) =>
                    setReportTarget({
                      type: 'message',
                      targetId: targetMsg.id,
                      authorId: targetMsg.senderId,
                      label: `Message from @${targetMsg.senderUsername}`,
                    })
                  }
                  onInspectSender={onInspectProfile}
                />
              );
            })
          )}

          <div ref={bottomSentinelRef} />
        </div>

        {showScrollLatest && (
          <button
            type="button"
            onClick={() => {
              shouldAutoScrollRef.current = true;
              setShowScrollLatest(false);
              scrollToLatest(true);
            }}
            aria-label="Scroll to latest messages"
            className="absolute bottom-3 right-4 min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded-xl bg-[#090B14] text-white border border-[#303342] text-xs font-semibold shadow-lg hover:border-[#EF3038]"
          >
            <ArrowDown className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
            <span>Latest</span>
          </button>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Composer */}
      <MessageComposer
        disabled={isThreadReadOnly}
        disabledReason={readOnlyReason}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
        onTypingChange={
          userSettings.typingIndicatorsEnabled ? handleTypingChange : undefined
        }
      />

      {/* Modals */}
      {isGroup && (
        <>
          <GroupMembersModal
            isOpen={showGroupMembersModal}
            conversation={conversation}
            members={members}
            currentUserAccount={currentUserAccount}
            onClose={() => setShowGroupMembersModal(false)}
            onEditDetails={() => setShowEditGroupModal(true)}
            onGroupRemovedOrLeft={onConversationRemoved}
            onInspectProfile={onInspectProfile}
          />
          <GroupConversationModal
            isOpen={showEditGroupModal}
            currentUserAccount={currentUserAccount}
            editingGroup={conversation}
            onClose={() => setShowEditGroupModal(false)}
          />
        </>
      )}

      <MessageReportModal
        isOpen={Boolean(reportTarget)}
        targetLabel={reportTarget?.label || 'Content'}
        onClose={() => setReportTarget(null)}
        onSubmit={async (reason: ReportReason, details: string) => {
          if (!reportTarget) return;
          await submitMessagingReport(currentUserAccount.uid, {
            targetType: reportTarget.type,
            targetId: reportTarget.targetId,
            conversationId: conversation.id,
            targetAuthorId: reportTarget.authorId,
            reason,
            details,
          });
        }}
      />
    </div>
  );
};
