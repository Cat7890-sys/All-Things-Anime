import React from 'react';
import type { AtaTypingIndicator } from '../../types';

interface TypingIndicatorProps {
  typingUsers: AtaTypingIndicator[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
}) => {
  if (typingUsers.length === 0) return null;

  const label =
    typingUsers.length === 1
      ? `${typingUsers[0].displayName} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`
        : `${typingUsers[0].displayName} and ${typingUsers.length - 1} others are typing...`;

  return (
    <div
      aria-live="polite"
      className="px-4 py-1.5 text-xs font-medium text-[#52576B] dark:text-[#A7A9B8]"
    >
      {label}
    </div>
  );
};
