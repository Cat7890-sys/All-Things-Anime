import React, { useState } from 'react';
import { Ban, Check, Flag, X } from 'lucide-react';
import type { AtaMessageRequest } from '../../types';
import { formatRelativeTimestamp } from '../../utils/time';
import { UserAvatar } from '../UserAvatar';

interface MessageRequestCardProps {
  request: AtaMessageRequest;
  direction: 'incoming' | 'outgoing';
  onAccept?: (request: AtaMessageRequest) => Promise<void>;
  onDecline?: (request: AtaMessageRequest) => Promise<void>;
  onCancel?: (request: AtaMessageRequest) => Promise<void>;
  onBlock?: (request: AtaMessageRequest) => Promise<void>;
  onReport?: (request: AtaMessageRequest) => void;
  onInspectProfile?: (uid: string) => void;
}

export const MessageRequestCard: React.FC<MessageRequestCardProps> = ({
  request,
  direction,
  onAccept,
  onDecline,
  onCancel,
  onBlock,
  onReport,
  onInspectProfile,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerUid =
    direction === 'incoming' ? request.senderId : request.recipientId;
  const peerDisplayName =
    direction === 'incoming'
      ? request.senderDisplayName
      : request.recipientDisplayName;
  const peerUsername =
    direction === 'incoming'
      ? request.senderUsername
      : request.recipientUsername;
  const peerAvatarUrl =
    direction === 'incoming'
      ? request.senderAvatarUrl
      : request.recipientAvatarUrl;

  const runAction = async (fn: (() => Promise<void>) | undefined) => {
    if (!fn || isBusy) return;
    setError(null);
    setIsBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to process request.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article className="rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onInspectProfile?.(peerUid)}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <UserAvatar
            displayName={peerDisplayName}
            avatarUrl={peerAvatarUrl}
            size="sm"
          />
          <div className="min-w-0">
            <p className="font-display-space font-bold text-sm text-[#090B14] dark:text-white truncate hover:text-[#EF3038] transition-colors">
              {peerDisplayName}
            </p>
            <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] truncate">
              @{peerUsername} · {formatRelativeTimestamp(request.updatedAt)}
            </p>
          </div>
        </button>

        <span className="text-[11px] font-semibold text-[#B92335] dark:text-[#EF3038] uppercase tracking-wider shrink-0">
          {direction === 'incoming' ? 'Incoming' : 'Sent'}
        </span>
      </div>

      <p className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white/90 whitespace-pre-wrap break-words">
        {request.initialMessage}
      </p>

      {error && (
        <p role="alert" className="text-xs font-medium text-[#EF3038]">
          {error}
        </p>
      )}

      {confirmBlock && direction === 'incoming' && (
        <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#EF3038] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[#090B14] dark:text-white">
            Block @{peerUsername} and prevent future messages?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmBlock(false)}
              className="px-3 py-1.5 min-h-[36px] font-semibold text-[#52576B] dark:text-[#A7A9B8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void runAction(async () => {
                  if (onBlock) await onBlock(request);
                })
              }
              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#EF3038] text-white font-semibold disabled:opacity-60"
            >
              {isBusy ? 'Blocking...' : 'Confirm Block'}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {direction === 'incoming' ? (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void runAction(async () => {
                  if (onAccept) await onAccept(request);
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335] disabled:opacity-60 transition-colors"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isBusy ? 'Working...' : 'Accept'}</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                void runAction(async () => {
                  if (onDecline) await onDecline(request);
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white text-xs font-semibold hover:border-[#EF3038] disabled:opacity-60 transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Decline</span>
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmBlock((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] text-xs font-semibold hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Block</span>
            </button>
            {onReport && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onReport(request)}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#52576B] dark:text-[#A7A9B8] text-xs font-semibold hover:border-[#EF3038] hover:text-[#EF3038] transition-colors"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Report</span>
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void runAction(async () => {
                if (onCancel) await onCancel(request);
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] text-[#090B14] dark:text-white text-xs font-semibold hover:border-[#EF3038] disabled:opacity-60 transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isBusy ? 'Cancelling...' : 'Cancel Request'}</span>
          </button>
        )}
      </div>
    </article>
  );
};
