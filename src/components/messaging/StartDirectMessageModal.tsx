import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Search,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { AtaPublicProfile, AtaUserAccount } from '../../types';
import {
  getDirectRelationshipState,
  sendMessageRequest,
  type DirectRelationshipState,
} from '../../services/messaging/messageRequestService';
import { lookupPublicProfileByUsername } from '../../services/messaging/messagingSettingsService';
import { MESSAGE_REQUEST_MAX_LENGTH } from '../../services/validation';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { UserAvatar } from '../UserAvatar';

interface StartDirectMessageModalProps {
  isOpen: boolean;
  currentUserAccount: AtaUserAccount;
  initialTargetUserId?: string | null;
  onClose: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenRequestsTab: () => void;
}

export const StartDirectMessageModal: React.FC<StartDirectMessageModalProps> = ({
  isOpen,
  currentUserAccount,
  initialTargetUserId,
  onClose,
  onOpenConversation,
  onOpenRequestsTab,
}) => {
  const [usernameQuery, setUsernameQuery] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] =
    useState<AtaPublicProfile | null>(null);
  const [relState, setRelState] = useState<DirectRelationshipState | null>(
    null
  );
  const [initialMessage, setInitialMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLookupError(null);
    setInitialMessage('');

    if (!initialTargetUserId) {
      setSelectedProfile(null);
      setRelState(null);
      return;
    }

    let active = true;
    setIsLookingUp(true);
    setRelState(null);

    void (async () => {
      try {
        const state = await getDirectRelationshipState(
          currentUserAccount.uid,
          initialTargetUserId
        );
        if (!active) return;

        if (state.kind === 'existing_conversation') {
          onOpenConversation(state.conversationId);
          onClose();
          return;
        }
        if (state.kind === 'can_request') {
          setSelectedProfile(state.targetProfile);
          setUsernameQuery(state.targetProfile.username);
        }
        setRelState(state);
      } catch (err) {
        if (!active) return;
        setLookupError(
          err instanceof Error ? err.message : 'Unable to check member status.'
        );
      } finally {
        if (active) setIsLookingUp(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    isOpen,
    initialTargetUserId,
    currentUserAccount.uid,
    onClose,
    onOpenConversation,
  ]);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLookingUp) return;
    setLookupError(null);
    setSelectedProfile(null);
    setRelState(null);
    setIsLookingUp(true);
    try {
      const profile = await lookupPublicProfileByUsername(usernameQuery);
      if (!profile) {
        setLookupError('No ATA member found with that exact @username.');
        return;
      }
      if (profile.uid === currentUserAccount.uid) {
        setLookupError('You cannot start a private chat with your own account.');
        return;
      }
      const state = await getDirectRelationshipState(
        currentUserAccount.uid,
        profile.uid
      );
      if (state.kind === 'existing_conversation') {
        onOpenConversation(state.conversationId);
        onClose();
        return;
      }
      setSelectedProfile(profile);
      setRelState(state);
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Unable to find member.'
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || isSending) return;
    setLookupError(null);
    setIsSending(true);
    try {
      await sendMessageRequest(
        currentUserAccount,
        selectedProfile,
        initialMessage
      );
      onOpenRequestsTab();
      onClose();
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Unable to send message request.'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ata-start-dm-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#090B14] px-5 py-4 border-b border-[#303342] flex items-center justify-between gap-3">
          <div>
            <p className="font-accent-orbitron text-[10px] font-semibold tracking-[0.12em] text-[#EF3038] uppercase">
              Direct Messaging
            </p>
            <h2
              id="ata-start-dm-title"
              className="font-display-space font-bold text-lg text-white"
            >
              Start Conversation
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new message dialog"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-[#303342] bg-[#171923] text-white hover:border-[#EF3038]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!initialTargetUserId && (
            <form onSubmit={handleLookup} className="space-y-2">
              <label
                htmlFor="ata-dm-username-search"
                className="block text-xs font-semibold text-[#090B14] dark:text-white"
              >
                Find member by @username
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="h-4 w-4 text-[#52576B] dark:text-[#A7A9B8] absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="ata-dm-username-search"
                    type="text"
                    value={usernameQuery}
                    onChange={(e) => setUsernameQuery(e.target.value)}
                    placeholder="e.g. kiri_01"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLookingUp || !usernameQuery.trim()}
                  className="px-4 min-h-[42px] rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335] disabled:opacity-60"
                >
                  {isLookingUp ? 'Checking...' : 'Check'}
                </button>
              </div>
            </form>
          )}

          {isLookingUp && initialTargetUserId && (
            <div className="py-8 flex flex-col items-center gap-3">
              <AtaLoadingSpinner size="sm" label="Checking messaging status" />
              <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                Checking privacy &amp; conversation status...
              </p>
            </div>
          )}

          {lookupError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-[#EF3038]/10 border border-[#EF3038] p-3 text-xs text-[#090B14] dark:text-white"
            >
              <AlertCircle
                className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{lookupError}</span>
            </div>
          )}

          {relState && (
            <>
              {selectedProfile && (
                <div className="flex items-center gap-3 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3">
                  <UserAvatar
                    displayName={selectedProfile.displayName}
                    avatarUrl={selectedProfile.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white truncate">
                      {selectedProfile.displayName}
                    </p>
                    <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
                      @{selectedProfile.username}
                    </p>
                  </div>
                </div>
              )}

              {(relState.kind === 'blocked' ||
                relState.kind === 'not_accepting') && (
                <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 flex items-start gap-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  <ShieldAlert
                    className="h-4 w-4 text-[#EF3038] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{relState.reason}</span>
                </div>
              )}

              {relState.kind === 'outgoing_declined' && (
                <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] p-3.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
                  Your previous message request to this member was declined.
                  Repeated requests are disabled.
                </div>
              )}

              {(relState.kind === 'incoming_pending' ||
                relState.kind === 'outgoing_pending') && (
                <div className="space-y-3">
                  <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
                    {relState.kind === 'incoming_pending'
                      ? 'This member already sent you a message request. Open Requests to accept and start chatting.'
                      : 'You already have a pending message request awaiting their approval.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenRequestsTab();
                      onClose();
                    }}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335]"
                  >
                    <span>View in Requests</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}

              {relState.kind === 'can_request' && (
                <form onSubmit={handleSendRequest} className="space-y-3">
                  <div>
                    <label
                      htmlFor="ata-dm-request-text"
                      className="block text-xs font-semibold text-[#090B14] dark:text-white mb-1.5"
                    >
                      Send a Message Request
                    </label>
                    <p className="text-[11px] text-[#52576B] dark:text-[#A7A9B8] mb-2">
                      First-time messages appear in their Requests tab until
                      they accept.
                    </p>
                    <textarea
                      id="ata-dm-request-text"
                      value={initialMessage}
                      onChange={(e) => setInitialMessage(e.target.value)}
                      rows={3}
                      maxLength={MESSAGE_REQUEST_MAX_LENGTH}
                      placeholder="Introduce yourself or share what anime you're discussing..."
                      className="w-full rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2.5 text-sm text-[#090B14] dark:text-white focus:outline-none focus:border-[#EF3038]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-xs font-semibold text-[#090B14] dark:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSending || !initialMessage.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl bg-[#EF3038] border border-[#B92335] text-xs font-semibold text-white hover:bg-[#B92335] disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSending ? 'Sending...' : 'Send Request'}</span>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
