import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import type { AtaMessage } from '../../types';
import { MESSAGE_MAX_LENGTH } from '../../services/validation';

interface MessageComposerProps {
  disabled: boolean;
  disabledReason?: string;
  replyTo: AtaMessage | null;
  onCancelReply: () => void;
  onSend: (text: string) => Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  disabled,
  disabledReason,
  replyTo,
  onCancelReply,
  onSend,
  onTypingChange,
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const isTypingActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingActiveRef.current) {
        onTypingChange?.(false);
      }
    };
  }, [onTypingChange]);

  const notifyTyping = (nextText: string) => {
    if (!onTypingChange || disabled) return;
    const hasContent = nextText.trim().length > 0;

    if (hasContent) {
      if (!isTypingActiveRef.current) {
        isTypingActiveRef.current = true;
        onTypingChange(true);
      }
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        isTypingActiveRef.current = false;
        onTypingChange(false);
      }, 3500);
    } else if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      onTypingChange(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || isSending || !text.trim()) return;
    setError(null);
    setIsSending(true);
    const payload = text;

    try {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      isTypingActiveRef.current = false;
      await onSend(payload);
      setText('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to send message right now.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="border-t border-[#D4D7E2] dark:border-[#303342] bg-white dark:bg-[#171923] p-3 sm:p-4 space-y-2">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-[#B92335] dark:text-[#EF3038]">
              Replying to {replyTo.senderDisplayName}
            </p>
            <p className="text-[#52576B] dark:text-[#A7A9B8] truncate">
              {replyTo.deletedAt ? 'Message deleted' : replyTo.text}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#52576B] dark:text-[#A7A9B8] hover:text-[#090B14] dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-[#EF3038]">
          {error}
        </p>
      )}

      {disabled ? (
        <div className="rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 text-xs text-[#52576B] dark:text-[#A7A9B8]">
          {disabledReason || 'Messaging is currently unavailable in this thread.'}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 min-w-0">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                notifyTyping(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="Write a private message..."
              aria-label="Message text"
              className="w-full min-h-[44px] max-h-32 resize-y rounded-xl bg-[#F4F5F8] dark:bg-[#090B14] border border-[#D4D7E2] dark:border-[#303342] px-3.5 py-2.5 text-sm text-[#090B14] dark:text-white placeholder:text-[#52576B] dark:placeholder:text-[#A7A9B8]/70 focus:outline-none focus:border-[#EF3038]"
            />
            {text.length > MESSAGE_MAX_LENGTH - 250 && (
              <p className="mt-1 text-[11px] text-[#52576B] dark:text-[#A7A9B8] tabular-nums text-right">
                {text.length} / {MESSAGE_MAX_LENGTH}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSending || !text.trim()}
            aria-label="Send message"
            className="min-h-[44px] min-w-[44px] px-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EF3038] border border-[#B92335] text-white text-xs font-semibold hover:bg-[#B92335] disabled:opacity-50 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">
              {isSending ? 'Sending...' : 'Send'}
            </span>
          </button>
        </form>
      )}
    </div>
  );
};
