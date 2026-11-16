import {
  collection,
  deleteDoc,
  doc,
  type DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AtaNotification, NotificationCategory } from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface PaginatedNotificationsResult {
  notifications: AtaNotification[];
  lastCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return null;
}

export function mapDocToNotification(
  id: string,
  data: Record<string, unknown>
): AtaNotification {
  return {
    id,
    recipientId: String(data.recipientId || ''),
    actorId: typeof data.actorId === 'string' ? data.actorId : '',
    actorUsername:
      typeof data.actorUsername === 'string' ? data.actorUsername : '',
    actorDisplayName:
      typeof data.actorDisplayName === 'string'
        ? data.actorDisplayName
        : 'ATA Member',
    actorAvatarUrl:
      typeof data.actorAvatarUrl === 'string' ? data.actorAvatarUrl : '',
    type: (data.type as AtaNotification['type']) || 'system_notice',
    category: (data.category as NotificationCategory) || 'system',
    title: String(data.title || 'Notification'),
    body: String(data.body || ''),
    targetType:
      (data.targetType as AtaNotification['targetType']) || undefined,
    targetId: typeof data.targetId === 'string' ? data.targetId : undefined,
    route: typeof data.route === 'string' ? data.route : undefined,
    isRead: Boolean(data.isRead),
    isDismissed: Boolean(data.isDismissed),
    createdAt: toDateOrNull(data.createdAt),
    readAt: toDateOrNull(data.readAt),
    dedupeKey: String(data.dedupeKey || id),
    metadata:
      data.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, string>)
        : undefined,
  };
}

export function subscribeToUserNotifications(
  recipientId: string,
  pageSize: number,
  onResult: (result: { notifications: AtaNotification[]; unreadCount: number }) => void,
  onError: (message: string) => void
): Unsubscribe {
  if (!recipientId) {
    onResult({ notifications: [], unreadCount: 0 });
    return () => {};
  }

  const path = 'notifications';
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', recipientId),
    where('isDismissed', '==', false),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((d) =>
        mapDocToNotification(d.id, d.data())
      );
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      onResult({ notifications, unreadCount });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : 'Unable to load notifications.'
        );
      }
    }
  );
}

export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  if (!notificationId) return;
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(
  recipientId: string
): Promise<void> {
  if (!recipientId) return;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', recipientId),
      where('isRead', '==', false),
      where('isDismissed', '==', false),
      limit(100)
    );
    const snapshot = await getDocs(q);
    const now = serverTimestamp();
    await Promise.all(
      snapshot.docs.map((d) =>
        updateDoc(d.ref, {
          isRead: true,
          readAt: now,
        })
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function dismissNotification(
  notificationId: string
): Promise<void> {
  if (!notificationId) return;
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      isDismissed: true,
      isRead: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function clearDismissedNotifications(
  recipientId: string
): Promise<void> {
  if (!recipientId) return;
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', recipientId),
      where('isDismissed', '==', true),
      limit(100)
    );
    const snapshot = await getDocs(q);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'notifications');
  }
}
