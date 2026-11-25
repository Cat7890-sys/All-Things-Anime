import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import newsStudioImg from '../../assets/images/news_animation_studio_1795537483241.jpg';
import newsPremiereImg from '../../assets/images/news_seasonal_premiere_1795537482946.jpg';
import newsSoundtrackImg from '../../assets/images/news_soundtrack_symphony_1795537482648.jpg';
import type { AdminNewsArticle, AnimeNewsArticle, NewsCategory } from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getOrFetch } from '../memoryCache';
import { subscribeShared } from '../sharedSubscriptionManager';

const ADMIN_NEWS_CACHE_TTL_MS = 5 * 60_000;
const NEWS_BOOKMARKS_QUERY_LIMIT = 200;

export const FEATURED_ANIME_NEWS: AnimeNewsArticle[] = [
  {
    id: 'news-01',
    title: 'Sample Editorial Preview: Traditional Keyframe & Cel-Shading Craft in Modern Action Series',
    source: 'ATA Editorial Sample',
    sourceUrl: 'https://anilist.co',
    category: 'Industry',
    publishedAt: 'Sample Preview',
    summary: 'An editorial feature exploring how dedicated animation units preserve hand-drawn keyframe timing alongside digital compositing pipelines.',
    imageUrl: newsStudioImg,
    author: 'ATA Editorial Desk',
    isSamplePreview: true,
  },
  {
    id: 'news-02',
    title: 'Sample Editorial Preview: Upcoming Seasonal Premiere Spotlight & Studio Lineups',
    source: 'ATA Editorial Sample',
    sourceUrl: 'https://anilist.co',
    category: 'Releases',
    publishedAt: 'Sample Preview',
    summary: 'A curated overview of newly announced seasonal television arcs, theatrical premieres, and confirmed production schedules via AniList.',
    imageUrl: newsPremiereImg,
    author: 'ATA Editorial Desk',
    isSamplePreview: true,
  },
  {
    id: 'news-03',
    title: 'Sample Editorial Preview: Orchestral Scoring & Emotional Silence in Fantasy Soundtracks',
    source: 'ATA Editorial Sample',
    sourceUrl: 'https://anilist.co',
    category: 'Interviews',
    publishedAt: 'Sample Preview',
    summary: 'Examining how composers and sound directors balance live orchestral themes with intentional acoustic restraint during pivotal story scenes.',
    imageUrl: newsSoundtrackImg,
    author: 'ATA Editorial Desk',
    isSamplePreview: true,
  },
  {
    id: 'news-04',
    title: 'Sample Editorial Preview: Global Simulcast Festivals & Creator Q&A Livestreams',
    source: 'ATA Editorial Sample',
    sourceUrl: 'https://anilist.co',
    category: 'Events',
    publishedAt: 'Sample Preview',
    summary: 'How international anime conventions and licensed online showcases connect overseas viewers with directors, animators, and voice casts.',
    imageUrl: newsPremiereImg,
    author: 'ATA Editorial Desk',
    isSamplePreview: true,
  },
  {
    id: 'news-05',
    title: 'Sample Editorial Preview: Background Art & Atmospheric Architecture in Anime Cinema',
    source: 'ATA Editorial Sample',
    sourceUrl: 'https://anilist.co',
    category: 'Reviews',
    publishedAt: 'Sample Preview',
    summary: 'A closer look at how art directors use painted light gradients, perspective shifts, and weather motifs to ground fantastical settings.',
    imageUrl: newsStudioImg,
    author: 'ATA Editorial Desk',
    isSamplePreview: true,
  },
];

export async function fetchPublishedAdminNews(): Promise<AdminNewsArticle[]> {
  return getOrFetch(
    'publishedAdminNews',
    async () => {
      try {
        const q = query(
          collection(db, 'adminNews'),
          where('status', '==', 'published'),
          orderBy('updatedAt', 'desc'),
          limit(30)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            source: String(data.source || 'ATA News'),
            sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : '',
            category: (data.category as NewsCategory) || 'Industry',
            publishedAt: String(data.publishedAt || 'Published'),
            summary: String(data.summary || ''),
            imageUrl:
              typeof data.imageUrl === 'string' && data.imageUrl
                ? data.imageUrl
                : newsPremiereImg,
            author: String(data.author || 'ATA Editorial'),
            status: 'published',
            isFeatured: Boolean(data.isFeatured),
            createdByUid: String(data.createdByUid || ''),
            updatedAt: toDateOrNull(data.updatedAt),
            isSamplePreview: false,
          };
        });
      } catch {
        return [];
      }
    },
    { ttlMs: ADMIN_NEWS_CACHE_TTL_MS }
  );
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function subscribeToUserNewsBookmarks(
  userId: string,
  onBookmarks: (bookmarkedIds: Set<string>) => void,
  onError?: (msg: string) => void
): Unsubscribe {
  if (!userId) {
    onBookmarks(new Set());
    return () => {};
  }

  const colRef = collection(db, 'userNewsBookmarks', userId, 'items');
  const q = query(colRef, limit(NEWS_BOOKMARKS_QUERY_LIMIT));
  return subscribeShared<Set<string>>(
    `userNewsBookmarks:${userId}`,
    'newsService',
    (emitData, emitError) =>
      onSnapshot(
        q,
        (snapshot) => {
          const ids = new Set<string>();
          snapshot.forEach((docSnap) => {
            ids.add(docSnap.id);
          });
          emitData(ids);
        },
        (error) => {
          try {
            handleFirestoreError(
              error,
              OperationType.GET,
              `userNewsBookmarks/${userId}/items`
            );
          } catch (err) {
            emitError(
              err instanceof Error
                ? err.message
                : 'Failed to load news bookmarks.'
            );
          }
        }
      ),
    onBookmarks,
    onError,
    { uid: userId }
  );
}

export async function toggleNewsBookmark(
  userId: string,
  article: AnimeNewsArticle,
  isCurrentlyBookmarked: boolean
): Promise<void> {
  if (!userId) throw new Error('User ID required.');
  const docRef = doc(db, 'userNewsBookmarks', userId, 'items', article.id);
  try {
    if (isCurrentlyBookmarked) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, {
        articleId: article.id,
        title: article.title,
        source: article.source,
        category: article.category,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `userNewsBookmarks/${userId}/items/${article.id}`);
  }
}
