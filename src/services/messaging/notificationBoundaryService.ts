import type { MessagingNotificationEventType } from '../../types';

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
