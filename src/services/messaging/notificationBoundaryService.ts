import type {
  MessagingNotificationEvent,
  MessagingNotificationEventType,
} from '../../types';

type MessagingNotificationListener = (
  event: MessagingNotificationEvent
) => void;

const listeners = new Set<MessagingNotificationListener>();

/**
 * Registers a Build 05 notification consumer without leaking private message
 * content or generating simulated notifications in Build 04B.
 */
export function registerMessagingNotificationListener(
  listener: MessagingNotificationListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Produces strictly neutral, privacy-safe notification preview text that
 * never leaks private message body contents when previews are restricted.
 */
export function getNeutralPreviewText(
  type: MessagingNotificationEventType
): string {
  switch (type) {
    case 'new_message_request':
      return 'You received a new message request.';
    case 'accepted_message_request':
      return 'Your message request was accepted.';
    case 'new_direct_message':
      return 'You have a new direct message.';
    case 'new_group_message':
      return 'You have a new group message.';
    case 'group_membership_change':
      return 'A group conversation membership update occurred.';
  }
}

export function emitMessagingNotificationEvent(input: {
  type: MessagingNotificationEventType;
  recipientIds: string[];
  actorId: string;
  conversationId?: string;
  requestId?: string;
}): void {
  const filteredRecipients = Array.from(
    new Set(input.recipientIds.filter((id) => id && id !== input.actorId))
  );
  if (filteredRecipients.length === 0) return;

  const event: MessagingNotificationEvent = {
    type: input.type,
    recipientIds: filteredRecipients,
    actorId: input.actorId,
    conversationId: input.conversationId,
    requestId: input.requestId,
    neutralPreviewText: getNeutralPreviewText(input.type),
    createdAtMs: Date.now(),
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Notification listener errors never block primary messaging delivery
    }
  }
}
