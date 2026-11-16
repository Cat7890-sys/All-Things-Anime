import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { AtaNotification } from '../../types';
import { UserAvatar } from '../UserAvatar';
import { formatRelativeTimestamp } from '../../utils/time';

interface NotificationToastProps {
  notification: AtaNotification;
  onClose: (id: string) => void;
  onClick: (notification: AtaNotification) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onClick,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  return (
    <div className="pointer-events-auto w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#171923] border border-[#D4D7E2] dark:border-[#303342] shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-slide-in-up">
      <div className="bg-[#090B14] px-3.5 py-2.5 flex items-center justify-between text-white border-b border-[#303342]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#EF3038] animate-pulse" />
          <span className="font-accent-orbitron text-[10px] font-bold tracking-wider text-[#EF3038] uppercase">
            New Alert
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose(notification.id);
          }}
          aria-label="Dismiss toast"
          className="text-[#A7A9B8] hover:text-white p-1 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onClick(notification)}
        className="w-full text-left p-4 flex items-start gap-3.5 hover:bg-[#F4F5F8] dark:hover:bg-[#090B14]/60 transition-colors"
      >
        <UserAvatar
          displayName={notification.actorDisplayName || 'ATA Member'}
          avatarUrl={notification.actorAvatarUrl}
          size="md"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-[#090B14] dark:text-white truncate">
              {notification.title}
            </h4>
            <span className="text-[10px] text-[#52576B] dark:text-[#A7A9B8] shrink-0 tabular-nums">
              {formatRelativeTimestamp(notification.createdAt)}
            </span>
          </div>
          <p className="text-xs text-[#52576B] dark:text-[#A7A9B8] line-clamp-2 leading-relaxed">
            {notification.body}
          </p>
        </div>
      </button>
    </div>
  );
};
