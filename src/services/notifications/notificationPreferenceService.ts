import type {
  AtaNotificationSettings,
  NotificationCategory,
} from '../../types';

export function isCategoryEnabled(
  settings: AtaNotificationSettings | null,
  category: NotificationCategory
): boolean {
  if (!settings || !settings.enabled) {
    return false;
  }

  switch (category) {
    case 'social':
      return settings.socialEnabled;
    case 'followers':
      return settings.followersEnabled;
    case 'communities':
      return settings.communitiesEnabled;
    case 'messaging':
      return settings.messagingEnabled;
    case 'groups':
      return settings.groupsEnabled;
    case 'system':
      return settings.systemEnabled;
  }
}

export function isQuietHoursActive(
  settings: AtaNotificationSettings | null,
  now: Date = new Date()
): boolean {
  if (!settings || !settings.quietHoursEnabled) {
    return false;
  }

  try {
    const tz = settings.timezone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeParts = formatter.format(now); // e.g. "23:45"
    const [currHourStr, currMinStr] = timeParts.split(':');
    const currentMinutes =
      parseInt(currHourStr, 10) * 60 + parseInt(currMinStr, 10);

    const [startHourStr, startMinStr] = settings.quietHoursStart.split(':');
    const startMinutes =
      parseInt(startHourStr, 10) * 60 + parseInt(startMinStr, 10);

    const [endHourStr, endMinStr] = settings.quietHoursEnd.split(':');
    const endMinutes =
      parseInt(endHourStr, 10) * 60 + parseInt(endMinStr, 10);

    if (startMinutes <= endMinutes) {
      // Same day quiet hours (e.g. 01:00 to 06:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight quiet hours crossing midnight (e.g. 22:00 to 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  } catch {
    return false;
  }
}
