import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import type { AtaPublicProfile } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { fetchBlockedUsers } from './socialGraphService';

export async function searchPublicProfilesByUsernamePrefix(
  prefix: string,
  maxResults = 10
): Promise<AtaPublicProfile[]> {
  const clean = prefix.trim().toLowerCase();
  if (!clean) return [];

  try {
    const q = query(
      collection(db, 'publicProfiles'),
      where('usernameLowercase', '>=', clean),
      where('usernameLowercase', '<=', clean + '\uf8ff'),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid || d.id),
        username: String(data.username || ''),
        usernameLowercase: String(data.usernameLowercase || ''),
        displayName: String(data.displayName || ''),
        bio: typeof data.bio === 'string' ? data.bio : '',
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : '',
        bannerUrl: typeof data.bannerUrl === 'string' ? data.bannerUrl : '',
        accentColor: typeof data.accentColor === 'string' ? data.accentColor : 'red',
        favouriteQuote: typeof data.favouriteQuote === 'string' ? data.favouriteQuote : '',
        favouriteAnimeTitles: Array.isArray(data.favouriteAnimeTitles)
          ? (data.favouriteAnimeTitles as string[])
          : [],
        favouriteCharacters: Array.isArray(data.favouriteCharacters)
          ? (data.favouriteCharacters as string[])
          : [],
        favouriteGenres: Array.isArray(data.favouriteGenres)
          ? (data.favouriteGenres as string[])
          : [],
        showAnimeActivity: Boolean(data.showAnimeActivity),
        followersCount: typeof data.followersCount === 'number' ? data.followersCount : 0,
        followingCount: typeof data.followingCount === 'number' ? data.followingCount : 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
    return [];
  }
}

export async function fetchBlockedUserIds(uid: string): Promise<string[]> {
  if (!uid) return [];
  const blocked = await fetchBlockedUsers(uid);
  return blocked.map((b) => b.blockedId);
}
