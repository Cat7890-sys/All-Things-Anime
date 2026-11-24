import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import type {
  LegalDocumentOverride,
  LegalPageSlug,
  PlatformAnnouncement,
} from '../../types';
import { db } from '../firebase';

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  return null;
}

export async function fetchLegalDocumentOverride(
  slug: LegalPageSlug
): Promise<LegalDocumentOverride | null> {
  try {
    const snap = await getDoc(doc(db, 'legalDocuments', slug));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: slug,
      title: typeof data.title === 'string' ? data.title : '',
      customSummary:
        typeof data.customSummary === 'string' ? data.customSummary : '',
      guidelinesList: Array.isArray(data.guidelinesList)
        ? data.guidelinesList.map((item) => String(item)).filter(Boolean)
        : [],
      lastUpdatedLabel:
        typeof data.lastUpdatedLabel === 'string' ? data.lastUpdatedLabel : '',
      updatedByUid: String(data.updatedByUid || ''),
      updatedAt: toDateOrNull(data.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function fetchAllLegalDocumentOverrides(): Promise<
  Record<string, LegalDocumentOverride>
> {
  try {
    const snap = await getDocs(collection(db, 'legalDocuments'));
    const map: Record<string, LegalDocumentOverride> = {};
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      map[docSnap.id] = {
        id: docSnap.id as LegalPageSlug,
        title: typeof data.title === 'string' ? data.title : '',
        customSummary:
          typeof data.customSummary === 'string' ? data.customSummary : '',
        guidelinesList: Array.isArray(data.guidelinesList)
          ? data.guidelinesList.map((item) => String(item)).filter(Boolean)
          : [],
        lastUpdatedLabel:
          typeof data.lastUpdatedLabel === 'string'
            ? data.lastUpdatedLabel
            : '',
        updatedByUid: String(data.updatedByUid || ''),
        updatedAt: toDateOrNull(data.updatedAt),
      };
    });
    return map;
  } catch {
    return {};
  }
}

function mapAnnouncementDoc(
  id: string,
  data: Record<string, unknown>
): PlatformAnnouncement {
  return {
    id,
    title: String(data.title || ''),
    body: String(data.body || ''),
    kind: (data.kind as PlatformAnnouncement['kind']) || 'general',
    audience: data.audience === 'selected_users' ? 'selected_users' : 'all_users',
    targetUserIds: Array.isArray(data.targetUserIds)
      ? data.targetUserIds.map((u) => String(u))
      : [],
    isActive: Boolean(data.isActive),
    sendInAppNotification: Boolean(data.sendInAppNotification),
    createdByUid: String(data.createdByUid || ''),
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
    archivedAt: toDateOrNull(data.archivedAt),
  };
}

export async function fetchActivePlatformAnnouncements(
  userId?: string
): Promise<PlatformAnnouncement[]> {
  try {
    const publicQuery = query(
      collection(db, 'platformAnnouncements'),
      where('isActive', '==', true),
      where('audience', '==', 'all_users'),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );

    const targetedQuery = userId
      ? query(
          collection(db, 'platformAnnouncements'),
          where('isActive', '==', true),
          where('targetUserIds', 'array-contains', userId),
          limit(10)
        )
      : null;

    const [publicSnap, targetedSnap] = await Promise.all([
      getDocs(publicQuery),
      targetedQuery ? getDocs(targetedQuery) : Promise.resolve(null),
    ]);

    const byId = new Map<string, PlatformAnnouncement>();
    publicSnap.forEach((d) => {
      byId.set(d.id, mapAnnouncementDoc(d.id, d.data()));
    });
    targetedSnap?.forEach((d) => {
      byId.set(d.id, mapAnnouncementDoc(d.id, d.data()));
    });

    return Array.from(byId.values()).sort((a, b) => {
      const aTime = a.updatedAt ? a.updatedAt.getTime() : 0;
      const bTime = b.updatedAt ? b.updatedAt.getTime() : 0;
      return bTime - aTime;
    });
  } catch {
    return [];
  }
}

export function clearNonEssentialLocalCaches(): number {
  let clearedCount = 0;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }
    const exactKeys = [
      'ata_preferred_country',
      'ata-theme-preference',
      'ata_pwa_install_dismissed_at',
      'ata_storage_notice_ack_v1',
    ];
    for (const key of exactKeys) {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key);
        clearedCount += 1;
      }
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('ata:anilist:')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
      clearedCount += 1;
    }
  } catch {
    // Ignore browser storage errors
  }
  return clearedCount;
}
