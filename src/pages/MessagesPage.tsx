import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Lock,
  MailCheck,
  MessageSquarePlus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
  WifiOff,
} from 'lucide-react';
import { AtaLoadingSpinner } from '../components/AtaLoadingSpinner';
import { ConversationList } from '../components/messaging/ConversationList';
import { ConversationView } from '../components/messaging/ConversationView';
import { GroupConversationModal } from '../components/messaging/GroupConversationModal';
import { MessageReportModal } from '../components/messaging/MessageReportModal';
import { MessageRequestList } from '../components/messaging/MessageRequestList';
import { MessagingSettings } from '../components/messaging/MessagingSettings';
import { StartDirectMessageModal } from '../components/messaging/StartDirectMessageModal';
import { PublicProfileModal } from '../components/social/PublicProfileModal';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  subscribeToUserConversations,
  subscribeToUserMemberStates,
} from '../services/messaging/conversationService';
import { submitMessagingReport } from '../services/messaging/messageModerationService';
import {
  acceptMessageRequest,
  cancelMessageRequest,
  declineMessageRequest,
  subscribeToIncomingRequests,
  subscribeToOutgoingRequests,
} from '../services/messaging/messageRequestService';
import {
  subscribeToMessageSettings,
  updateMessageSettings,
} from '../services/messaging/messagingSettingsService';
import { DEFAULT_MESSAGE_SETTINGS } from '../services/messaging/messagingUtils';
import { blockUser } from '../services/socialGraphService';
import { getPublicProfile } from '../services/userProfileService';
import { buildDirectConversationId } from '../services/validation';
import type {
  AtaConversation,
  AtaConversationMember,
  AtaMessageRequest,
  AtaMessageSettings,
  AtaPublicProfile,
  AuthViewMode,
  ReportReason,
  UpdateMessageSettingsInput,
} from '../types';

interface MessagesPageProps {
  initialDirectTargetUserId?: string | null;
  onConsumeDirectTarget?: () => void;
  initialRouteTarget?: {
    conversationId?: string;
    tab?: 'chats' | 'requests' | 'groups';
  } | null;
  onConsumeRouteTarget?: () => void;
  onOpenAuth: (mode: AuthViewMode) => void;
  onNavigateProfile: () => void;
}

type MessagesTab = 'chats' | 'requests' | 'groups' | 'privacy';

export const MessagesPage: React.FC<MessagesPageProps> = ({
  initialDirectTargetUserId = null,
  onConsumeDirectTarget,
  initialRouteTarget = null,
  onConsumeRouteTarget,
  onOpenAuth,
  onNavigateProfile,
}) => {
  const { firebaseUser, profile, isLoadingAuth, isLoadingProfile, refreshProfile } =
    useAuth();
  const { isOnline } = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<MessagesTab>('chats');
  const [conversations, setConversations] = useState<AtaConversation[]>([]);
  const [memberStates, setMemberStates] = useState<
    Record<string, AtaConversationMember>
  >({});
  const [incomingRequests, setIncomingRequests] = useState<AtaMessageRequest[]>(
    []
  );
  const [outgoingRequests, setOutgoingRequests] = useState<AtaMessageRequest[]>(
    []
  );
  const [settings, setSettings] = useState<AtaMessageSettings | null>(null);
  const [peerProfiles, setPeerProfiles] = useState<
    Record<string, AtaPublicProfile>
  >({});

  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [directModalTargetId, setDirectModalTargetId] = useState<string | null>(
    null
  );
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [inspectProfileUid, setInspectProfileUid] = useState<string | null>(
    null
  );
  const [reportRequestTarget, setReportRequestTarget] =
    useState<AtaMessageRequest | null>(null);

  const isVerified = Boolean(firebaseUser?.emailVerified);

  // Subscribe to conversations, member unread states, message requests, and privacy settings
  useEffect(() => {
    if (!firebaseUser || !isVerified) {
      setConversations([]);
      setMemberStates({});
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setSettings(null);
      setSelectedConversationId(null);
      setIsLoadingConversations(false);
      setIsLoadingRequests(false);
      return;
    }

    setIsLoadingConversations(true);
    setIsLoadingRequests(true);
    setFeedError(null);

    const uid = firebaseUser.uid;
    let incomingReady = false;
    let outgoingReady = false;

    const unsubConvs = subscribeToUserConversations(
      uid,
      (items) => {
        setConversations(items);
        setIsLoadingConversations(false);
      },
      (err) => {
        setFeedError(err);
        setIsLoadingConversations(false);
      }
    );

    const unsubMembers = subscribeToUserMemberStates(
      uid,
      (states) => {
        setMemberStates(states);
      },
      (err) => {
        setFeedError((prev) => prev || err);
      }
    );

    const unsubIncoming = subscribeToIncomingRequests(
      uid,
      (reqs) => {
        setIncomingRequests(reqs);
        incomingReady = true;
        if (outgoingReady) setIsLoadingRequests(false);
      },
      (err) => {
        setFeedError((prev) => prev || err);
        setIsLoadingRequests(false);
      }
    );

    const unsubOutgoing = subscribeToOutgoingRequests(
      uid,
      (reqs) => {
        setOutgoingRequests(reqs);
        outgoingReady = true;
        if (incomingReady) setIsLoadingRequests(false);
      },
      (err) => {
        setFeedError((prev) => prev || err);
        setIsLoadingRequests(false);
      }
    );

    const unsubSettings = subscribeToMessageSettings(uid, (userCfg) => {
      setSettings(userCfg);
    });

    return () => {
      unsubConvs();
      unsubMembers();
      unsubIncoming();
      unsubOutgoing();
      unsubSettings();
    };
  }, [firebaseUser, isVerified]);

  // Lazy-fetch peer public profiles for direct conversations
  useEffect(() => {
    if (!firebaseUser) return;

    const missingPeerUids = new Set<string>();
    for (const conv of conversations) {
      if (conv.type !== 'direct') continue;
      const peerId = conv.participantIds.find((id) => id !== firebaseUser.uid);
      if (peerId && !peerProfiles[peerId]) {
        missingPeerUids.add(peerId);
      }
    }

    if (missingPeerUids.size === 0) return;

    let active = true;
    void Promise.all(
      Array.from(missingPeerUids).map(async (peerUid) => {
        const fetched = await getPublicProfile(peerUid).catch(() => null);
        return { peerUid, fetched };
      })
    ).then((results) => {
      if (!active) return;
      setPeerProfiles((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const item of results) {
          if (item.fetched && !next[item.peerUid]) {
            next[item.peerUid] = item.fetched;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      active = false;
    };
  }, [conversations, firebaseUser, peerProfiles]);

  // Handle deep link from PublicProfileModal ("Message" button)
  useEffect(() => {
    if (!initialDirectTargetUserId || !firebaseUser || !isVerified) return;

    if (initialDirectTargetUserId === firebaseUser.uid) {
      onConsumeDirectTarget?.();
      return;
    }

    const expectedConvId = buildDirectConversationId(
      firebaseUser.uid,
      initialDirectTargetUserId
    );
    const existing = conversations.find((c) => c.id === expectedConvId);

    if (existing) {
      setActiveTab('chats');
      setSelectedConversationId(existing.id);
      onConsumeDirectTarget?.();
      return;
    }

    setDirectModalTargetId(initialDirectTargetUserId);
    setShowNewDirectModal(true);
    onConsumeDirectTarget?.();
  }, [
    initialDirectTargetUserId,
    firebaseUser,
    isVerified,
    conversations,
    onConsumeDirectTarget,
  ]);

  // Handle deep links from Notifications (conversation, group, or message requests)
  useEffect(() => {
    if (!initialRouteTarget || !firebaseUser || !isVerified) return;

    const { conversationId, tab } = initialRouteTarget;

    if (!conversationId) {
      if (tab) {
        setActiveTab(tab);
        if (tab === 'requests') {
          setSelectedConversationId(null);
        }
      }
      onConsumeRouteTarget?.();
      return;
    }

    if (isLoadingConversations) {
      return;
    }

    const targetConv = conversations.find((c) => c.id === conversationId);
    if (targetConv) {
      setActionFeedback(null);
      setActiveTab(targetConv.type === 'group' ? 'groups' : 'chats');
      setSelectedConversationId(targetConv.id);
    } else {
      if (tab) {
        setActiveTab(tab);
      }
      setSelectedConversationId(null);
      setActionFeedback(
        'That conversation is no longer available or you are not a participant.'
      );
    }

    onConsumeRouteTarget?.();
  }, [
    initialRouteTarget,
    firebaseUser,
    isVerified,
    isLoadingConversations,
    conversations,
    onConsumeRouteTarget,
  ]);

  // Auto-clear selected conversation if user left or group was deleted
  useEffect(() => {
    if (!selectedConversationId) return;
    const stillExists = conversations.some(
      (c) => c.id === selectedConversationId
    );
    if (!stillExists && !isLoadingConversations) {
      setSelectedConversationId(null);
    }
  }, [conversations, isLoadingConversations, selectedConversationId]);

  const effectiveSettings: AtaMessageSettings = useMemo(
    () =>
      settings || {
        uid: firebaseUser?.uid || '',
        ...DEFAULT_MESSAGE_SETTINGS,
        updatedAt: null,
      },
    [settings, firebaseUser]
  );

  const selectedConversation = useMemo(
    () =>
      conversations.find((c) => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const selectedPeerProfile = useMemo(() => {
    if (!selectedConversation || selectedConversation.type !== 'direct' || !firebaseUser) {
      return null;
    }
    const peerId = selectedConversation.participantIds.find(
      (id) => id !== firebaseUser.uid
    );
    return peerId ? peerProfiles[peerId] || null : null;
  }, [selectedConversation, firebaseUser, peerProfiles]);

  const totalUnreadCount = useMemo(() => {
    return Object.values(memberStates).reduce((sum, member) => {
      if (member.archived) return sum;
      return sum + (member.unreadCount || 0);
    }, 0);
  }, [memberStates]);

  const groupConversationsCount = useMemo(
    () => conversations.filter((c) => c.type === 'group').length,
    [conversations]
  );

  // Request handlers
  const handleAcceptRequest = async (req: AtaMessageRequest) => {
    if (!profile) return;
    setActionFeedback(null);
    const conversationId = await acceptMessageRequest(profile, req);
    setActiveTab('chats');
    setSelectedConversationId(conversationId);
  };

  const handleDeclineRequest = async (req: AtaMessageRequest) => {
    if (!firebaseUser) return;
    setActionFeedback(null);
    await declineMessageRequest(firebaseUser.uid, req.id);
  };

  const handleCancelRequest = async (req: AtaMessageRequest) => {
    if (!firebaseUser) return;
    setActionFeedback(null);
    await cancelMessageRequest(firebaseUser.uid, req.id);
  };

  const handleBlockFromRequest = async (req: AtaMessageRequest) => {
    if (!firebaseUser) return;
    await declineMessageRequest(firebaseUser.uid, req.id).catch(() => {});
    await blockUser(firebaseUser.uid, req.senderId, req.senderUsername);
    setActionFeedback(
      `Blocked @${req.senderUsername} and declined their message request.`
    );
  };

  const handleSubmitRequestReport = async (
    reason: ReportReason,
    details: string
  ) => {
    if (!profile || !reportRequestTarget) return;
    await submitMessagingReport(profile.uid, {
      targetType: 'conversation',
      targetId: reportRequestTarget.id,
      conversationId: reportRequestTarget.id,
      targetAuthorId: reportRequestTarget.senderId,
      reason,
      details,
    });
  };

  const handleSaveSettings = async (input: UpdateMessageSettingsInput) => {
    if (!firebaseUser) return;
    const updated = await updateMessageSettings(firebaseUser.uid, input);
    setSettings(updated);
  };

  // Auth Loading Gate
  if (isLoadingAuth || (firebaseUser && isLoadingProfile)) {
    return (
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-10 flex flex-col items-center justify-center gap-3">
        <AtaLoadingSpinner size="md" label="Loading private messages" />
        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
          Loading your ATA messaging session...
        </p>
      </section>
    );
  }

  // Signed-Out Gate
  if (!firebaseUser) {
    return (
      <section className="bg-[#090B14] border border-[#303342] rounded-2xl p-6 sm:p-10 text-white space-y-5">
        <div className="space-y-2 max-w-xl">
          <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
            ATA Private Messaging
          </p>
          <h1 className="font-display-space font-bold text-2xl sm:text-3xl leading-tight">
            Direct Chats &amp; Small Group Rooms
          </h1>
          <p className="text-sm text-[#A7A9B8] leading-relaxed">
            Sign in with your ATA account to message fellow anime fans privately,
            review message requests with full privacy controls, and host watch-party
            group conversations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
          >
            Sign In to Messages
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="px-5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#171923] border border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors"
          >
            Create ATA Account
          </button>
        </div>
      </section>
    );
  }

  // Email Verification Gate
  if (!isVerified) {
    return (
      <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EF3038]/10 border border-[#EF3038]/40 flex items-center justify-center shrink-0">
            <MailCheck className="h-5 w-5 text-[#EF3038]" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              Verification Required
            </p>
            <h1 className="font-display-space font-bold text-xl text-[#090B14] dark:text-white">
              Verify Your Email to Access Private Messaging
            </h1>
            <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] leading-relaxed max-w-xl">
              Private direct messages, message requests, and group chats are
              protected for verified ATA members only. Complete verification in
              your Profile tab and refresh your verification status.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateProfile}
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors"
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          <span>Go to Profile Verification</span>
        </button>
      </section>
    );
  }

  // Profile Document Recovery Fallback
  if (!profile) {
    return (
      <section className="bg-white dark:bg-[#171923] border border-[#EF3038] rounded-2xl p-6 space-y-3">
        <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#090B14] dark:text-white">
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>
            Unable to load your ATA member profile record. Refresh your profile
            session to unlock private messaging.
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refreshProfile()}
          className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-[#EF3038] rounded-xl"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retry Profile Sync</span>
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Hero / Navigation Header */}
      <section className="bg-[#090B14] border border-[#303342] rounded-2xl p-5 sm:p-6 text-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="font-accent-orbitron text-[11px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              ATA Private Messaging
            </p>
            <h1 className="font-display-space font-bold text-2xl sm:text-3xl leading-tight">
              Messages &amp; Group Chats
            </h1>
            <p className="text-xs text-[#A7A9B8]">
              {totalUnreadCount > 0
                ? `${totalUnreadCount} unread ${totalUnreadCount === 1 ? 'message' : 'messages'} · `
                : ''}
              {incomingRequests.length > 0
                ? `${incomingRequests.length} pending ${incomingRequests.length === 1 ? 'request' : 'requests'}`
                : 'Consent-based direct messages & up to 25-member anime group chats'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDirectModalTargetId(null);
                setShowNewDirectModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335] transition-colors whitespace-nowrap"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              <span>New Message</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewGroupModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#171923] border border-[#303342] rounded-xl hover:border-[#EF3038] transition-colors whitespace-nowrap"
            >
              <Users className="h-4 w-4 text-[#EF3038]" aria-hidden="true" />
              <span>New Group</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div
          className="flex flex-wrap items-center gap-1.5 pt-1"
          role="tablist"
          aria-label="Messaging sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chats'}
            onClick={() => setActiveTab('chats')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
              activeTab === 'chats'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <span>Chats</span>
            {totalUnreadCount > 0 && (
              <span className="text-[11px] font-bold">({totalUnreadCount})</span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'requests'}
            onClick={() => {
              setActiveTab('requests');
              setSelectedConversationId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
              activeTab === 'requests'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Requests</span>
            {incomingRequests.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#090B14] text-[10px] font-bold">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'groups'}
            onClick={() => setActiveTab('groups')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors tabular-nums ${
              activeTab === 'groups'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Groups ({groupConversationsCount})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'privacy'}
            onClick={() => {
              setActiveTab('privacy');
              setSelectedConversationId(null);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-xl border transition-colors ${
              activeTab === 'privacy'
                ? 'bg-[#EF3038] text-white border-[#B92335]'
                : 'bg-[#171923] text-[#A7A9B8] border-[#303342] hover:border-[#EF3038] hover:text-white'
            }`}
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Privacy</span>
          </button>
        </div>
      </section>

      {/* Non-intrusive offline indicator */}
      {!isOnline && (
        <div
          role="status"
          className="rounded-xl bg-[#EF3038]/10 border border-[#EF3038] px-4 py-3 flex items-center gap-2.5 text-xs text-[#090B14] dark:text-white"
        >
          <WifiOff className="h-4 w-4 text-[#EF3038] shrink-0" aria-hidden="true" />
          <span>
            You are currently offline. Live messages and sending require an
            active connection.
          </span>
        </div>
      )}

      {feedError && (
        <div
          role="alert"
          className="rounded-xl bg-[#EF3038]/10 border border-[#EF3038] px-4 py-3 flex items-start gap-2.5 text-xs text-[#090B14] dark:text-white"
        >
          <AlertCircle
            className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{feedError}</span>
        </div>
      )}

      {actionFeedback && (
        <div
          role="status"
          className="rounded-xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] px-4 py-3 text-xs text-[#090B14] dark:text-white"
        >
          {actionFeedback}
        </div>
      )}

      {/* Main View by Active Tab */}
      {activeTab === 'requests' ? (
        <section className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden">
          <MessageRequestList
            incomingRequests={incomingRequests}
            outgoingRequests={outgoingRequests}
            isLoading={isLoadingRequests}
            onAccept={handleAcceptRequest}
            onDecline={handleDeclineRequest}
            onCancel={handleCancelRequest}
            onBlock={handleBlockFromRequest}
            onReport={(req) => setReportRequestTarget(req)}
            onInspectProfile={(uid) => setInspectProfileUid(uid)}
          />
        </section>
      ) : activeTab === 'privacy' ? (
        <MessagingSettings
          settings={effectiveSettings}
          onSave={handleSaveSettings}
          onClose={() => setActiveTab('chats')}
        />
      ) : (
        /* Chats / Groups Split View */
        <section
          aria-label="Private conversations workspace"
          className="bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] min-h-[540px] lg:h-[calc(100vh-14.5rem)] lg:max-h-[760px]"
        >
          {/* Left Pane: Conversation List */}
          <div
            className={`border-b lg:border-b-0 lg:border-r border-[#D4D7E2] dark:border-[#303342] min-h-0 ${
              selectedConversation ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'
            }`}
          >
            <ConversationList
              conversations={conversations}
              currentUid={profile.uid}
              memberStates={memberStates}
              peerProfiles={peerProfiles}
              selectedConversationId={selectedConversationId}
              filterMode={activeTab === 'groups' ? 'groups' : 'all'}
              isLoading={isLoadingConversations}
              onSelectConversation={(convId) => setSelectedConversationId(convId)}
              onStartNewDirect={() => {
                setDirectModalTargetId(null);
                setShowNewDirectModal(true);
              }}
              onStartNewGroup={() => setShowNewGroupModal(true)}
            />
          </div>

          {/* Right Pane: Active Conversation */}
          <div
            className={`min-h-0 min-w-0 flex-col ${
              selectedConversation ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {selectedConversation ? (
              <ConversationView
                conversation={selectedConversation}
                currentUserAccount={profile}
                userSettings={effectiveSettings}
                ownMemberState={memberStates[selectedConversation.id]}
                peerProfile={selectedPeerProfile}
                onBackMobile={() => setSelectedConversationId(null)}
                onInspectProfile={(uid) => setInspectProfileUid(uid)}
                onConversationRemoved={() => setSelectedConversationId(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center">
                  <MessageSquarePlus
                    className="h-6 w-6 text-[#EF3038]"
                    aria-hidden="true"
                  />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h2 className="font-display-space font-bold text-lg text-[#090B14] dark:text-white">
                    Select a Conversation
                  </h2>
                  <p className="text-xs sm:text-sm text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
                    Choose an active chat from the left or start a new direct
                    message or anime group conversation.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectModalTargetId(null);
                      setShowNewDirectModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-white bg-[#EF3038] border border-[#B92335] rounded-xl hover:bg-[#B92335]"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>New Direct Message</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewGroupModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-semibold text-[#090B14] dark:text-white bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] rounded-xl hover:border-[#EF3038]"
                  >
                    <Users className="h-3.5 w-3.5 text-[#EF3038]" aria-hidden="true" />
                    <span>Create Group</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* New Direct Message Modal */}
      <StartDirectMessageModal
        isOpen={showNewDirectModal}
        currentUserAccount={profile}
        initialTargetUserId={directModalTargetId}
        onClose={() => {
          setShowNewDirectModal(false);
          setDirectModalTargetId(null);
        }}
        onOpenConversation={(convId) => {
          setActiveTab('chats');
          setSelectedConversationId(convId);
        }}
        onOpenRequestsTab={() => {
          setActiveTab('requests');
          setSelectedConversationId(null);
        }}
      />

      {/* New Group Chat Modal */}
      <GroupConversationModal
        isOpen={showNewGroupModal}
        currentUserAccount={profile}
        onClose={() => setShowNewGroupModal(false)}
        onCreated={(created) => {
          setActiveTab('chats');
          setSelectedConversationId(created.id);
        }}
      />

      {/* Inspect Member Profile Modal */}
      <PublicProfileModal
        targetUserId={inspectProfileUid}
        onClose={() => setInspectProfileUid(null)}
        onOpenAuth={onOpenAuth}
        onStartDirectMessage={(uid) => {
          setInspectProfileUid(null);
          const expectedConvId = buildDirectConversationId(profile.uid, uid);
          const existing = conversations.find((c) => c.id === expectedConvId);
          if (existing) {
            setActiveTab('chats');
            setSelectedConversationId(existing.id);
          } else {
            setDirectModalTargetId(uid);
            setShowNewDirectModal(true);
          }
        }}
      />

      {/* Report Message Request Modal */}
      <MessageReportModal
        isOpen={Boolean(reportRequestTarget)}
        targetLabel={
          reportRequestTarget
            ? `message request from @${reportRequestTarget.senderUsername}`
            : ''
        }
        onClose={() => setReportRequestTarget(null)}
        onSubmit={handleSubmitRequestReport}
      />
    </div>
  );
};
