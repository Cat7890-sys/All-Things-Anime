import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AtaMessageRequest } from '../../types';
import { AtaLoadingSpinner } from '../AtaLoadingSpinner';
import { MessageRequestCard } from './MessageRequestCard';

interface MessageRequestListProps {
  incomingRequests: AtaMessageRequest[];
  outgoingRequests: AtaMessageRequest[];
  isLoading: boolean;
  onAccept: (request: AtaMessageRequest) => Promise<void>;
  onDecline: (request: AtaMessageRequest) => Promise<void>;
  onCancel: (request: AtaMessageRequest) => Promise<void>;
  onBlock: (request: AtaMessageRequest) => Promise<void>;
  onReport: (request: AtaMessageRequest) => void;
  onInspectProfile: (uid: string) => void;
}

export const MessageRequestList: React.FC<MessageRequestListProps> = ({
  incomingRequests,
  outgoingRequests,
  isLoading,
  onAccept,
  onDecline,
  onCancel,
  onBlock,
  onReport,
  onInspectProfile,
}) => {
  if (isLoading) {
    return (
      <div className="py-14 flex flex-col items-center justify-center gap-3">
        <AtaLoadingSpinner size="md" label="Loading message requests" />
        <p className="text-xs text-[#52576B] dark:text-[#A7A9B8]">
          Loading message requests...
        </p>
      </div>
    );
  }

  if (incomingRequests.length === 0 && outgoingRequests.length === 0) {
    return (
      <div className="py-12 px-5 text-center space-y-3">
        <div className="mx-auto h-11 w-11 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] flex items-center justify-center">
          <ShieldCheck
            className="h-5 w-5 text-[#EF3038]"
            aria-hidden="true"
          />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="font-display-space font-bold text-base text-[#090B14] dark:text-white">
            No pending message requests
          </h3>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] leading-relaxed">
            First-contact messages from members appear here for your approval
            before entering your main Chats inbox.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-6">
      {incomingRequests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-2">
            <h3 className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
              Incoming Requests
            </h3>
            <span className="text-xs font-semibold text-[#EF3038] tabular-nums">
              {incomingRequests.length}
            </span>
          </div>
          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <MessageRequestCard
                key={req.id}
                request={req}
                direction="incoming"
                onAccept={onAccept}
                onDecline={onDecline}
                onBlock={onBlock}
                onReport={onReport}
                onInspectProfile={onInspectProfile}
              />
            ))}
          </div>
        </section>
      )}

      {outgoingRequests.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#D4D7E2] dark:border-[#303342] pb-2">
            <h3 className="font-display-space font-bold text-sm text-[#090B14] dark:text-white">
              Sent Requests
            </h3>
            <span className="text-xs font-semibold text-[#52576B] dark:text-[#A7A9B8] tabular-nums">
              {outgoingRequests.length}
            </span>
          </div>
          <div className="space-y-3">
            {outgoingRequests.map((req) => (
              <MessageRequestCard
                key={req.id}
                request={req}
                direction="outgoing"
                onCancel={onCancel}
                onInspectProfile={onInspectProfile}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
