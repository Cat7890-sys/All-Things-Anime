import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  AnimeCatalogueItem,
  AnimeRecommendation,
  AtaUserPreferences,
  RecommendationFeedback,
  RecommendationFeedbackType,
  UserAnimeListItem,
} from '../../types';
import { animeCatalogueService } from '../catalogue/animeCatalogueService';
import { db, handleFirestoreError, OperationType } from '../firebase';

export async function getUserRecommendationFeedback(
  userId: string
): Promise<Record<string, RecommendationFeedbackType>> {
  if (!userId) return {};
  const path = `recommendationFeedback/${userId}/items`;
  try {
    const snap = await getDocs(collection(db, path));
    const map: Record<string, RecommendationFeedbackType> = {};
    for (const d of snap.docs) {
      map[d.id] = d.data().feedbackType as RecommendationFeedbackType;
    }
    return map;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {};
  }
}

export async function recordRecommendationFeedback(
  userId: string,
  animeId: string,
  feedbackType: RecommendationFeedbackType,
  reason?: string
): Promise<void> {
  if (!userId || !animeId) return;
  const path = `recommendationFeedback/${userId}/items/${animeId}`;
  const docRef = doc(db, 'recommendationFeedback', userId, 'items', animeId);
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      await updateDoc(docRef, {
        feedbackType,
        reason: reason || '',
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        animeId,
        feedbackType,
        reason: reason || '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearRecommendationFeedback(
  userId: string
): Promise<void> {
  if (!userId) return;
  const path = `recommendationFeedback/${userId}/items`;
  try {
    const snap = await getDocs(collection(db, path));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Generates transparent, explainable rule-based anime recommendations.
 * Uses only explicit user interests, favourite titles, formats, and watchlist status.
 */
export async function generateAnimeRecommendations(
  preferences: AtaUserPreferences | null,
  watchlist: UserAnimeListItem[] = [],
  feedbackMap: Record<string, RecommendationFeedbackType> = {}
): Promise<AnimeRecommendation[]> {
  const allAnime = await animeCatalogueService.getAllAnime();

  // If recommendations are explicitly disabled by the user
  if (preferences && preferences.recommendationsEnabled === false) {
    return [];
  }

  const completedOrDroppedIds = new Set(
    watchlist
      .filter((w) => w.status === 'completed' || w.status === 'dropped')
      .map((w) => w.animeId)
  );

  const hiddenGenres = new Set(
    (preferences?.hiddenGenres || []).map((g) => g.toLowerCase())
  );
  const userGenres = new Set(
    (preferences?.favouriteGenres || []).map((g) => g.toLowerCase())
  );
  const userFormats = new Set(
    (preferences?.preferredFormats || []).map((f) => f.toLowerCase())
  );
  const favouriteTitles = (preferences?.favouriteAnimeTitles || []).map((t) =>
    t.toLowerCase()
  );

  const scoredList: AnimeRecommendation[] = [];

  for (const anime of allAnime) {
    // 1. Hard filters: explicit not_interested or disliked
    const feedback = feedbackMap[anime.id];
    if (feedback === 'not_interested' || feedback === 'dislike') {
      continue;
    }

    // 2. Filter out already completed anime from recommendations
    if (completedOrDroppedIds.has(anime.id)) {
      continue;
    }

    // 3. Skip if has hidden genre
    const hasHiddenGenre = anime.genres.some((g) =>
      hiddenGenres.has(g.toLowerCase())
    );
    if (hasHiddenGenre) {
      continue;
    }

    let score = 0;
    const matchedSignals: string[] = [];

    // Genre scoring
    let matchingGenreCount = 0;
    for (const g of anime.genres) {
      if (userGenres.has(g.toLowerCase())) {
        matchingGenreCount++;
        matchedSignals.push(`Genre: ${g}`);
      }
    }
    score += matchingGenreCount * 3;

    // Favourite anime / franchise overlap
    for (const fav of favouriteTitles) {
      if (
        anime.title.toLowerCase().includes(fav) ||
        anime.romajiTitle.toLowerCase().includes(fav) ||
        fav.includes(anime.title.toLowerCase())
      ) {
        score += 6;
        matchedSignals.push(`Related to favourite: ${anime.title}`);
      }
    }

    // Format scoring
    if (userFormats.has(anime.format.toLowerCase())) {
      score += 2;
      matchedSignals.push(`Format: ${anime.format}`);
    }

    // Base quality score weight
    score += Math.round(anime.score || 7.5);

    // Boost if already saved/liked
    if (feedback === 'like' || feedback === 'saved') {
      score += 5;
      matchedSignals.push('Previously liked');
    }

    // Determine category
    let reasonCategory: AnimeRecommendation['reasonCategory'] =
      'Recommended for You';
    let reasonDetail = 'Matches your anime preferences and viewing tastes.';

    if (matchingGenreCount >= 2) {
      reasonCategory = 'Similar Genres';
      reasonDetail = `High overlap with your favourite genres (${anime.genres.slice(0, 2).join(', ')}).`;
    } else if (
      favouriteTitles.some((t) => anime.title.toLowerCase().includes(t))
    ) {
      reasonCategory = 'Because You Like...';
      reasonDetail = `Connected to your selected favourite titles.`;
    } else if (anime.score >= 8.8) {
      reasonCategory = 'Hidden Gems';
      reasonDetail = `Critically acclaimed standout rated ${anime.score}/10 in the ATA community.`;
    }

    scoredList.push({
      anime,
      score,
      reasonCategory,
      reasonDetail,
      matchedSignals,
    });
  }

  // Sort descending by calculated score
  return scoredList.sort((a, b) => b.score - a.score);
}
