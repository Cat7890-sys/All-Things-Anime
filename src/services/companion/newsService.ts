import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AnimeNewsArticle, NewsCategory } from '../../types';
import { db, handleFirestoreError, OperationType } from '../firebase';

export const FEATURED_ANIME_NEWS: AnimeNewsArticle[] = [
  {
    id: 'news-01',
    title: 'Wit Studio & Production I.G Announce Collaborative Animation Laboratory for Hand-Drawn Keyframes',
    source: 'Anime News Desk',
    sourceUrl: 'https://anilist.co',
    category: 'Industry',
    publishedAt: '2 hours ago',
    summary: 'A new dedicated studio wing aims to preserve traditional cel-shading principles while training next-generation digital ink artists on historical action sequences.',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    author: 'Kenji Sato',
  },
  {
    id: 'news-02',
    title: 'Spring Season Preview: Top 10 Most Anticipated Sequel Arcs and Original Screenplays',
    source: 'CrunchyWire',
    sourceUrl: 'https://anilist.co',
    category: 'Releases',
    publishedAt: '5 hours ago',
    summary: 'From sci-fi cyberpunk thrillers to pastoral slice-of-life journeys, here is the complete breakdown of character directors and production lineups returning this April.',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
    author: 'Mina Takahashi',
  },
  {
    id: 'news-03',
    title: 'Director Interview: Crafting Emotional Silence in Atmospheric Fantasy Adaptations',
    source: 'Sakuga Studies',
    sourceUrl: 'https://anilist.co',
    category: 'Interviews',
    publishedAt: '1 day ago',
    summary: 'In an exclusive discussion, lead directors discuss why letting background audio breathe without background music creates unforgettable dramatic tension.',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    author: 'Ren Kurosawa',
  },
  {
    id: 'news-04',
    title: 'Annual Tokyo Animation Expo Confirms Global Virtual Screening Rooms for Upcoming Summer Features',
    source: 'Global Anime Gazette',
    sourceUrl: 'https://anilist.co',
    category: 'Events',
    publishedAt: '2 days ago',
    summary: 'International fans will have access to simultaneous theater premieres and live creator Q&A sessions through online festival passes.',
    imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
    author: 'Hana Matsuoka',
  },
  {
    id: 'news-05',
    title: 'Review: Why Monolith of Kiri Redefines World-Building Through Architectural Cinematography',
    source: 'ATA Editorial',
    sourceUrl: 'https://anilist.co',
    category: 'Reviews',
    publishedAt: '3 days ago',
    summary: 'An in-depth look at how background painters use stone texture and variable horizon lines to make fantasy geography feel lived-in and authentic.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    author: 'Devon Vance',
  },
];

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
  return onSnapshot(
    query(colRef),
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((docSnap) => {
        ids.add(docSnap.id);
      });
      onBookmarks(ids);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, `userNewsBookmarks/${userId}/items`);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Failed to load news bookmarks.');
      }
    }
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
