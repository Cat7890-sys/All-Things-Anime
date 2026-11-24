import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type {
  AnimeStreamingAvailability,
  StreamingAvailabilityReport,
  StreamingProvider,
} from '../../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  validateCountryCode,
  validateStreamingReportInput,
} from '../validation';
import {
  COUNTRIES,
  COUNTRY_CATALOG,
  CURATED_STREAMING_AVAILABILITY,
  DEFAULT_COUNTRY_CODE,
  NO_VERIFIED_FREE_OPTIONS_MESSAGE,
  VERIFIED_FREE_PROVIDERS,
  filterVerifiedAvailabilityForAnime,
  filterVerifiedAvailabilityForCountry,
  filterVerifiedProvidersForCountry,
  formatAvailabilityTypeLabel,
  getCountryByCode,
  isApprovedOfficialStreamingUrl,
  isEligibleVerifiedFreeAvailability,
  isEligibleVerifiedFreeProvider,
  mergeVerifiedAvailability,
  mergeVerifiedProviders,
  normalizeCountryCode,
  searchCountries,
  type CountryOption,
} from './streamingDirectory';

export {
  COUNTRIES,
  COUNTRY_CATALOG,
  CURATED_STREAMING_AVAILABILITY,
  DEFAULT_COUNTRY_CODE,
  NO_VERIFIED_FREE_OPTIONS_MESSAGE,
  VERIFIED_FREE_PROVIDERS,
  filterVerifiedAvailabilityForAnime,
  filterVerifiedAvailabilityForCountry,
  filterVerifiedProvidersForCountry,
  formatAvailabilityTypeLabel,
  getCountryByCode,
  isApprovedOfficialStreamingUrl,
  isEligibleVerifiedFreeAvailability,
  isEligibleVerifiedFreeProvider,
  mergeVerifiedAvailability,
  mergeVerifiedProviders,
  normalizeCountryCode,
  searchCountries,
  type CountryOption,
};

const PREFERRED_COUNTRY_STORAGE_KEY = 'ata_preferred_country';
const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

interface DirectoryCache {
  providers: StreamingProvider[];
  availability: AnimeStreamingAvailability[];
  fetchedAt: number;
}

let directoryCache: DirectoryCache | null = null;

export interface VerifiedDirectorySnapshot {
  providers: StreamingProvider[];
  availability: AnimeStreamingAvailability[];
  fetchedAt: number;
  syncedWithFirestore: boolean;
}

export async function loadVerifiedStreamingDirectory(
  options: { forceRefresh?: boolean } = {}
): Promise<VerifiedDirectorySnapshot> {
  const nowMs = Date.now();
  if (
    !options.forceRefresh &&
    directoryCache &&
    nowMs - directoryCache.fetchedAt < DIRECTORY_CACHE_TTL_MS
  ) {
    return {
      providers: directoryCache.providers,
      availability: directoryCache.availability,
      fetchedAt: directoryCache.fetchedAt,
      syncedWithFirestore: true,
    };
  }

  let extraProviders: Partial<StreamingProvider>[] = [];
  let extraAvailability: Partial<AnimeStreamingAvailability>[] = [];
  let syncedWithFirestore = false;

  try {
    const [providersSnap, availabilitySnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'streamingProviders'),
          where('isFree', '==', true),
          where('isLegitimate', '==', true),
          where('verificationStatus', '==', 'verified')
        )
      ),
      getDocs(
        query(
          collection(db, 'streamingAvailability'),
          where('isFree', '==', true),
          where('isLegitimate', '==', true),
          where('verificationStatus', '==', 'verified')
        )
      ),
    ]);

    extraProviders = providersSnap.docs.map((d) => ({
      ...(d.data() as Partial<StreamingProvider>),
      id: d.id,
    }));
    extraAvailability = availabilitySnap.docs.map((d) => ({
      ...(d.data() as Partial<AnimeStreamingAvailability>),
      id: d.id,
    }));
    syncedWithFirestore = true;
  } catch {
    // Graceful degradation to curated verified baseline when offline or rules restrict live sync
    syncedWithFirestore = false;
  }

  const providers = mergeVerifiedProviders(extraProviders);
  const availability = mergeVerifiedAvailability(extraAvailability, providers);

  directoryCache = {
    providers,
    availability,
    fetchedAt: nowMs,
  };

  return {
    providers,
    availability,
    fetchedAt: nowMs,
    syncedWithFirestore,
  };
}

export async function getStreamingAvailabilityForAnime(
  animeId: number,
  countryCode: string,
  options: { forceRefresh?: boolean } = {}
): Promise<AnimeStreamingAvailability[]> {
  const snapshot = await loadVerifiedStreamingDirectory({
    forceRefresh: options.forceRefresh,
  });
  return filterVerifiedAvailabilityForAnime(
    animeId,
    countryCode,
    snapshot.availability,
    snapshot.providers
  );
}

export async function getVerifiedDirectoryForCountry(
  countryCode: string,
  options: { forceRefresh?: boolean; query?: string } = {}
): Promise<{
  providers: StreamingProvider[];
  availability: AnimeStreamingAvailability[];
  fetchedAt: number;
  syncedWithFirestore: boolean;
}> {
  const snapshot = await loadVerifiedStreamingDirectory({
    forceRefresh: options.forceRefresh,
  });
  return {
    providers: filterVerifiedProvidersForCountry(
      countryCode,
      snapshot.providers
    ),
    availability: filterVerifiedAvailabilityForCountry(
      countryCode,
      options.query || '',
      snapshot.availability,
      snapshot.providers
    ),
    fetchedAt: snapshot.fetchedAt,
    syncedWithFirestore: snapshot.syncedWithFirestore,
  };
}

function readLocalPreferredCountry(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(PREFERRED_COUNTRY_STORAGE_KEY);
      if (stored) {
        return normalizeCountryCode(stored);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_COUNTRY_CODE;
}

function writeLocalPreferredCountry(countryCode: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(PREFERRED_COUNTRY_STORAGE_KEY, countryCode);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function getUserPreferredCountry(userId?: string): Promise<string> {
  const localFallback = readLocalPreferredCountry();
  if (!userId) {
    return localFallback;
  }
  try {
    const snap = await getDoc(doc(db, 'userWhereToWatchPrefs', userId));
    if (snap.exists() && typeof snap.data().countryCode === 'string') {
      const normalized = normalizeCountryCode(snap.data().countryCode);
      writeLocalPreferredCountry(normalized);
      return normalized;
    }
  } catch {
    // Fall back safely to local preference / South Africa default
  }
  return localFallback;
}

export async function setUserPreferredCountry(
  userId: string | undefined,
  countryCode: string
): Promise<string> {
  const normalized = normalizeCountryCode(countryCode);
  const countryError = validateCountryCode(normalized);
  if (countryError) {
    throw new Error(countryError);
  }

  writeLocalPreferredCountry(normalized);
  if (!userId) return normalized;

  try {
    await setDoc(
      doc(db, 'userWhereToWatchPrefs', userId),
      {
        userId,
        countryCode: normalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `userWhereToWatchPrefs/${userId}`
    );
  }
  return normalized;
}

export async function reportStreamingAvailability(
  report: Omit<StreamingAvailabilityReport, 'id' | 'createdAt' | 'status' | 'userId'> & {
    userId?: string;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  const effectiveUserId = report.userId || currentUser?.uid;

  if (!effectiveUserId || !currentUser) {
    throw new Error('Please sign in to submit an availability report.');
  }
  if (!currentUser.emailVerified) {
    throw new Error(
      'Please verify your email address before submitting an availability report.'
    );
  }

  const normalizedCountry = normalizeCountryCode(report.countryCode);
  const validationError = validateStreamingReportInput({
    animeId: report.animeId,
    animeTitle: report.animeTitle,
    countryCode: normalizedCountry,
    reason: report.reason,
    details: report.details || '',
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const docRef = doc(db, 'streamingReports', reportId);

  const payload = {
    id: reportId,
    userId: effectiveUserId,
    animeId: report.animeId,
    animeTitle: report.animeTitle.trim(),
    countryCode: normalizedCountry,
    providerId: (report.providerId || '').trim(),
    providerName: (report.providerName || '').trim(),
    reason: report.reason.trim(),
    details: (report.details || '').trim(),
    status: 'open' as const,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `streamingReports/${reportId}`);
  }
}
