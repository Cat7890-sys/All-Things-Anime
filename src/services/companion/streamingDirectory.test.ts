import assert from 'node:assert/strict';
import type { AnimeStreamingAvailability, StreamingProvider } from '../../types/index.ts';
import {
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
} from './streamingDirectory.ts';
import {
  STREAMING_REPORT_REASONS,
  validateCountryCode,
  validateStreamingReportInput,
} from '../validation.ts';

// 1. South Africa default priority & country normalization/search
assert.equal(DEFAULT_COUNTRY_CODE, 'ZA');
assert.equal(getCountryByCode().code, 'ZA');
assert.equal(getCountryByCode('invalid').code, 'ZA');
assert.equal(normalizeCountryCode('us'), 'US');
assert.equal(normalizeCountryCode('ALL'), 'ZA');

const zaMatches = searchCountries('South Africa');
assert.ok(zaMatches.some((c) => c.code === 'ZA'));
assert.ok(searchCountries('RSA').some((c) => c.code === 'ZA'));
assert.ok(searchCountries('UK').some((c) => c.code === 'GB'));
assert.equal(searchCountries('zzzz_nonexistent').length, 0);

// 2. Approved official HTTPS URL & domain allowlist checks
assert.equal(
  isApprovedOfficialStreamingUrl('https://www.youtube.com/@GundamInfo', [
    'www.youtube.com',
    'youtube.com',
  ]),
  true
);
assert.equal(
  isApprovedOfficialStreamingUrl('http://www.youtube.com/@GundamInfo'),
  false
); // rejects insecure HTTP
assert.equal(
  isApprovedOfficialStreamingUrl('javascript:alert(1)'),
  false
); // rejects javascript scheme
assert.equal(
  isApprovedOfficialStreamingUrl('https://pirate-anime.example.com/watch'),
  false
); // rejects unapproved domains
assert.equal(
  isApprovedOfficialStreamingUrl('https://tubitv.com/category/anime', [
    'www.youtube.com',
  ]),
  false
); // rejects domain mismatch for provider
assert.equal(
  isApprovedOfficialStreamingUrl('https://user:pass@www.youtube.com/@GundamInfo'),
  false
); // rejects embedded credentials

// 3. Curated providers & availability baseline all pass strict verification checks
for (const provider of VERIFIED_FREE_PROVIDERS) {
  assert.equal(
    isEligibleVerifiedFreeProvider(provider),
    true,
    `Provider ${provider.id} must satisfy strict free/legal verification`
  );
}
for (const item of CURATED_STREAMING_AVAILABILITY) {
  assert.equal(
    isEligibleVerifiedFreeAvailability(item, VERIFIED_FREE_PROVIDERS),
    true,
    `Availability ${item.id} must satisfy strict free/legal verification`
  );
}

// 4. Rejects non-free, illegitimate, unverified, or paid/subscription records
const baseValidRecord: AnimeStreamingAvailability = {
  id: 'test_record_1',
  animeId: 139274,
  animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
  providerId: 'gundaminfo',
  providerName: 'GundamInfo Official YouTube',
  countryCode: 'ZA',
  isFree: true,
  isLegitimate: true,
  officialUrl: 'https://www.youtube.com/@GundamInfo',
  accessModel: 'Free with Ads',
  availabilityType: 'full_series',
  verificationStatus: 'verified',
  lastVerifiedAt: '2026-11-24',
  source: 'Verified Official Publisher Channel',
};

assert.equal(isEligibleVerifiedFreeAvailability(baseValidRecord), true);
assert.equal(
  isEligibleVerifiedFreeAvailability({ ...baseValidRecord, isFree: false }),
  false
);
assert.equal(
  isEligibleVerifiedFreeAvailability({ ...baseValidRecord, isLegitimate: false }),
  false
);
assert.equal(
  isEligibleVerifiedFreeAvailability({
    ...baseValidRecord,
    verificationStatus: 'unverified',
  }),
  false
);
assert.equal(
  isEligibleVerifiedFreeAvailability({
    ...baseValidRecord,
    verificationStatus: 'needs_review',
  }),
  false
);
assert.equal(
  isEligibleVerifiedFreeAvailability({
    ...baseValidRecord,
    officialUrl: 'https://unverified-mirror.example.org/stream',
  }),
  false
);
assert.equal(
  isEligibleVerifiedFreeAvailability({
    ...baseValidRecord,
    accessModel: 'Subscription' as unknown as 'Free',
  }),
  false
);

// Rejects availability mapped to a country the provider does not support (e.g. Tubi in ZA)
assert.equal(
  isEligibleVerifiedFreeAvailability({
    ...baseValidRecord,
    providerId: 'tubi',
    providerName: 'Tubi',
    countryCode: 'ZA',
    officialUrl: 'https://tubitv.com/category/anime',
  }),
  false
);

// Merge rejects injected invalid providers/records
const mergedProviders = mergeVerifiedProviders([
  {
    ...(VERIFIED_FREE_PROVIDERS[0] as StreamingProvider),
    id: 'bad_paid_provider',
    isFree: false,
  },
]);
assert.equal(
  mergedProviders.some((p) => p.id === 'bad_paid_provider'),
  false
);

const mergedAvailability = mergeVerifiedAvailability([
  {
    ...baseValidRecord,
    id: 'bad_unverified_inject',
    verificationStatus: 'unverified',
  },
]);
assert.equal(
  mergedAvailability.some((a) => a.id === 'bad_unverified_inject'),
  false
);

// 5. Non-fabrication & country switching behavior
const zaProviders = filterVerifiedProvidersForCountry('ZA');
assert.ok(zaProviders.some((p) => p.id === 'gundaminfo'));
assert.equal(
  zaProviders.some((p) => p.id === 'tubi'),
  false
); // Tubi not falsely claimed for South Africa

// Verified ZA title returns verified result
const gundamZa = filterVerifiedAvailabilityForAnime(139274, 'ZA');
assert.equal(gundamZa.length, 1);
assert.equal(gundamZa[0].providerId, 'gundaminfo');

// Unverified/paid title in ZA returns [] (never invented fallback)
const frierenZa = filterVerifiedAvailabilityForAnime(154587, 'ZA');
assert.equal(frierenZa.length, 0);

// Switching to SG shows verified regional free stream for Frieren
const frierenSg = filterVerifiedAvailabilityForAnime(154587, 'SG');
assert.equal(frierenSg.length, 1);
assert.equal(frierenSg[0].providerId, 'muse_asia');

// Returning to ZA restores ZA filtering
const zaCatalog = filterVerifiedAvailabilityForCountry('ZA');
assert.ok(zaCatalog.every((item) => item.countryCode === 'ZA'));

assert.equal(
  formatAvailabilityTypeLabel('full_series'),
  'Full Series'
);
assert.equal(
  NO_VERIFIED_FREE_OPTIONS_MESSAGE,
  'No verified free streaming options found for this anime in your selected country.'
);

// 6. Report & country code validation
assert.equal(validateCountryCode('ZA'), null);
assert.ok(validateCountryCode('ALL'));
assert.ok(validateCountryCode('123'));

assert.equal(
  validateStreamingReportInput({
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    countryCode: 'ZA',
    reason: STREAMING_REPORT_REASONS[0],
    details: 'Playlist currently unavailable in Cape Town.',
  }),
  null
);
assert.ok(
  validateStreamingReportInput({
    animeId: 0,
    animeTitle: 'Test',
    countryCode: 'ZA',
    reason: STREAMING_REPORT_REASONS[0],
    details: '',
  })
);
assert.ok(
  validateStreamingReportInput({
    animeId: 1,
    animeTitle: 'Cowboy Bebop',
    countryCode: 'US',
    reason: 'Invalid Reason',
    details: '',
  })
);
assert.ok(
  validateStreamingReportInput({
    animeId: 1,
    animeTitle: 'Cowboy Bebop',
    countryCode: 'US',
    reason: STREAMING_REPORT_REASONS[0],
    details: 'x'.repeat(501),
  })
);

console.log('All Build 08A streamingDirectory tests passed.');
