import type {
  AnimeStreamingAvailability,
  StreamingAccessModel,
  StreamingAvailabilityType,
  StreamingProvider,
} from '../../types';

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  region: string;
  aliases?: string[];
}

export const DEFAULT_COUNTRY_CODE = 'ZA';

export const NO_VERIFIED_FREE_OPTIONS_MESSAGE =
  'No verified free streaming options found for this anime in your selected country.';

export const COUNTRY_CATALOG: CountryOption[] = [
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    region: 'Africa',
    aliases: ['RSA', 'South Africa'],
  },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', region: 'Oceania', aliases: ['AUS'] },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', region: 'South America' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', region: 'Europe' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', region: 'Asia' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', region: 'Europe' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', region: 'Africa' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', region: 'South America', aliases: ['Brasil'] },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', region: 'North America' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', region: 'South America' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', region: 'South America' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', region: 'Europe' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', region: 'Africa' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', region: 'Europe' },
  { code: 'FR', name: 'France', flag: '🇫🇷', region: 'Europe' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', region: 'Europe', aliases: ['Deutschland'] },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', region: 'Africa' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', region: 'Asia' },
  { code: 'IN', name: 'India', flag: '🇮🇳', region: 'Asia' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', region: 'Asia' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', region: 'Europe' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', region: 'Europe' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', region: 'Asia', aliases: ['Nihon', 'Nippon'] },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', region: 'Africa' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', region: 'Asia' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', region: 'North America' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', region: 'Africa' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦', region: 'Africa' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', region: 'Europe', aliases: ['Holland'] },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', region: 'Oceania' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', region: 'Africa' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', region: 'Europe' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', region: 'Asia' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', region: 'South America' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', region: 'Asia' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', region: 'Europe' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', region: 'Europe' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', region: 'Middle East' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', region: 'Asia' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', region: 'Asia', aliases: ['Korea'] },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', region: 'Europe' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', region: 'Europe' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', region: 'Asia' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', region: 'Asia' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', region: 'Europe / Asia' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', region: 'Middle East', aliases: ['UAE', 'Dubai'] },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    region: 'Europe',
    aliases: ['UK', 'Britain', 'England'],
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    region: 'North America',
    aliases: ['USA', 'America'],
  },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', region: 'Asia' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼', region: 'Africa' },
];

export const COUNTRIES = COUNTRY_CATALOG;

export function normalizeCountryCode(code?: string | null): string {
  const cleaned = (code || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(cleaned)) {
    const match = COUNTRY_CATALOG.find((c) => c.code === cleaned);
    if (match) return match.code;
  }
  return DEFAULT_COUNTRY_CODE;
}

export function getCountryByCode(code?: string | null): CountryOption {
  const normalized = normalizeCountryCode(code);
  return (
    COUNTRY_CATALOG.find((c) => c.code === normalized) || COUNTRY_CATALOG[0]
  );
}

export function searchCountries(queryText: string): CountryOption[] {
  const q = queryText.trim().toLowerCase();
  if (!q) return COUNTRY_CATALOG;
  return COUNTRY_CATALOG.filter((c) => {
    if (c.name.toLowerCase().includes(q)) return true;
    if (c.code.toLowerCase().includes(q)) return true;
    if (c.region.toLowerCase().includes(q)) return true;
    if (c.aliases?.some((alias) => alias.toLowerCase().includes(q))) return true;
    return false;
  });
}

export const APPROVED_STREAMING_DOMAINS: readonly string[] = [
  'youtube.com',
  'www.youtube.com',
  'tubitv.com',
  'www.tubitv.com',
  'pluto.tv',
  'www.pluto.tv',
  'retrocrush.tv',
  'www.retrocrush.tv',
  'abema.tv',
  'bilibili.tv',
  'www.bilibili.tv',
  'itv.com',
  'www.itv.com',
  'bbc.co.uk',
  'www.bbc.co.uk',
  'iview.abc.net.au',
];

const VALID_ACCESS_MODELS = new Set<StreamingAccessModel>(['Free', 'Free with Ads']);
const VALID_AVAILABILITY_TYPES = new Set<StreamingAvailabilityType>([
  'full_series',
  'selected_episodes',
  'promotional',
  'movie',
]);

export function formatAvailabilityTypeLabel(type: StreamingAvailabilityType): string {
  switch (type) {
    case 'full_series':
      return 'Full Series';
    case 'selected_episodes':
      return 'Selected Episodes';
    case 'promotional':
      return 'Promotional Free';
    case 'movie':
      return 'Feature Film';
  }
}

export function isApprovedOfficialStreamingUrl(
  rawUrl: unknown,
  providerAllowedDomains?: string[]
): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;

  const host = parsed.hostname.toLowerCase();
  const isGloballyApproved = APPROVED_STREAMING_DOMAINS.includes(host);
  if (!isGloballyApproved) return false;

  if (Array.isArray(providerAllowedDomains) && providerAllowedDomains.length > 0) {
    const allowedSet = new Set(providerAllowedDomains.map((d) => d.toLowerCase()));
    return allowedSet.has(host);
  }

  return true;
}

export const VERIFIED_FREE_PROVIDERS: StreamingProvider[] = [
  {
    id: 'gundaminfo',
    name: 'GundamInfo Official YouTube',
    shortLabel: 'GI',
    accentHex: '#2563EB',
    description:
      'Official Bandai Namco Filmworks YouTube channel featuring rotating full Gundam anime series free with ads worldwide.',
    supportedCountries: [
      'ZA', 'US', 'GB', 'CA', 'AU', 'NZ', 'SG', 'MY', 'PH', 'ID', 'TH', 'VN', 'IN',
      'JP', 'KR', 'HK', 'TW', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'BR', 'MX',
      'NG', 'KE', 'BW', 'NA', 'ZW', 'EG', 'GH', 'AE', 'SA',
    ],
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    allowedDomains: ['www.youtube.com', 'youtube.com'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'tms_official',
    name: 'TMS Anime Official YouTube',
    shortLabel: 'TMS',
    accentHex: '#DC2626',
    description:
      'Official TMS Entertainment YouTube channel offering licensed classic anime series and episodes free with ads.',
    supportedCountries: [
      'ZA', 'US', 'GB', 'CA', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'BR', 'MX',
      'NG', 'KE', 'BW', 'NA', 'ZW', 'GH', 'IE',
    ],
    officialUrl: 'https://www.youtube.com/@AnimeonTMSOfficialChannel',
    allowedDomains: ['www.youtube.com', 'youtube.com'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'muse_asia',
    name: 'Muse Asia Official YouTube',
    shortLabel: 'MA',
    accentHex: '#EA580C',
    description:
      'Licensed Asian animation distributor providing free ad-supported YouTube simulcasts and complete series in supported Asian territories.',
    supportedCountries: ['SG', 'MY', 'PH', 'ID', 'TH', 'VN', 'IN', 'BD', 'HK', 'TW'],
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    allowedDomains: ['www.youtube.com', 'youtube.com'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'anione_asia',
    name: 'Ani-One Asia Official YouTube',
    shortLabel: 'A1',
    accentHex: '#0D9488',
    description:
      'Medialink official YouTube channel streaming licensed anime titles free with ads across supported Asian regions.',
    supportedCountries: ['SG', 'MY', 'PH', 'ID', 'TH', 'VN', 'IN', 'BD', 'HK', 'TW'],
    officialUrl: 'https://www.youtube.com/@AniOneAsia',
    allowedDomains: ['www.youtube.com', 'youtube.com'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'tubi',
    name: 'Tubi',
    shortLabel: 'TB',
    accentHex: '#9333EA',
    description:
      'Legitimate ad-supported free streaming platform offering licensed anime series and films in supported Western territories.',
    supportedCountries: ['US', 'CA', 'GB', 'AU', 'NZ', 'MX'],
    officialUrl: 'https://tubitv.com/category/anime',
    allowedDomains: ['tubitv.com', 'www.tubitv.com'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'pluto_tv',
    name: 'Pluto TV',
    shortLabel: 'PTV',
    accentHex: '#EAB308',
    description:
      'Free ad-supported live channels and on-demand licensed anime catalogue available in supported territories.',
    supportedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'BR', 'MX'],
    officialUrl: 'https://pluto.tv/en/on-demand/categories/anime',
    allowedDomains: ['pluto.tv', 'www.pluto.tv'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'retrocrush',
    name: 'RetroCrush',
    shortLabel: 'RC',
    accentHex: '#DB2777',
    description:
      'Dedicated classic anime streaming service offering free ad-supported playback in the United States and Canada.',
    supportedCountries: ['US', 'CA'],
    officialUrl: 'https://www.retrocrush.tv',
    allowedDomains: ['www.retrocrush.tv', 'retrocrush.tv'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
  {
    id: 'abema',
    name: 'ABEMA',
    shortLabel: 'ABM',
    accentHex: '#16A34A',
    description:
      'Japanese free ad-supported streaming broadcaster carrying licensed simulcast anime and live channels in Japan.',
    supportedCountries: ['JP'],
    officialUrl: 'https://abema.tv/video/genre/animation',
    allowedDomains: ['abema.tv'],
    accessModel: 'Free with Ads',
    isFree: true,
    isLegitimate: true,
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
  },
];

// Curated verified free title-by-country index.
// Missing entries intentionally remain absent — never invent fallback availability.
export const CURATED_STREAMING_AVAILABILITY: AnimeStreamingAvailability[] = [
  // South Africa (ZA) — verified official global publisher channels
  {
    id: '139274_za_gundaminfo',
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
  },
  {
    id: '2581_za_gundaminfo',
    animeId: 2581,
    animeTitle: 'Mobile Suit Gundam 00',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'ZA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },
  {
    id: '1412_za_tms',
    animeId: 1412,
    animeTitle: 'Lupin the Third: Part 1',
    providerId: 'tms_official',
    providerName: 'TMS Anime Official YouTube',
    countryCode: 'ZA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@AnimeonTMSOfficialChannel',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },
  {
    id: '1972_za_tms',
    animeId: 1972,
    animeTitle: 'Sherlock Hound',
    providerId: 'tms_official',
    providerName: 'TMS Anime Official YouTube',
    countryCode: 'ZA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@AnimeonTMSOfficialChannel',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },

  // United States (US)
  {
    id: '1_us_tubi',
    animeId: 1,
    animeTitle: 'Cowboy Bebop',
    providerId: 'tubi',
    providerName: 'Tubi',
    countryCode: 'US',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://tubitv.com/category/anime',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '20_us_tubi',
    animeId: 20,
    animeTitle: 'Naruto',
    providerId: 'tubi',
    providerName: 'Tubi',
    countryCode: 'US',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://tubitv.com/category/anime',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '481_us_pluto',
    animeId: 481,
    animeTitle: 'Yu-Gi-Oh! Duel Monsters',
    providerId: 'pluto_tv',
    providerName: 'Pluto TV',
    countryCode: 'US',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://pluto.tv/en/on-demand/categories/anime',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '967_us_retrocrush',
    animeId: 967,
    animeTitle: 'Fist of the North Star',
    providerId: 'retrocrush',
    providerName: 'RetroCrush',
    countryCode: 'US',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.retrocrush.tv',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '139274_us_gundaminfo',
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'US',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },

  // Canada (CA)
  {
    id: '1_ca_tubi',
    animeId: 1,
    animeTitle: 'Cowboy Bebop',
    providerId: 'tubi',
    providerName: 'Tubi',
    countryCode: 'CA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://tubitv.com/category/anime',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '967_ca_retrocrush',
    animeId: 967,
    animeTitle: 'Fist of the North Star',
    providerId: 'retrocrush',
    providerName: 'RetroCrush',
    countryCode: 'CA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.retrocrush.tv',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '139274_ca_gundaminfo',
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'CA',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },

  // United Kingdom (GB)
  {
    id: '139274_gb_gundaminfo',
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'GB',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },
  {
    id: '1412_gb_tms',
    animeId: 1412,
    animeTitle: 'Lupin the Third: Part 1',
    providerId: 'tms_official',
    providerName: 'TMS Anime Official YouTube',
    countryCode: 'GB',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@AnimeonTMSOfficialChannel',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },

  // Australia (AU)
  {
    id: '1_au_tubi',
    animeId: 1,
    animeTitle: 'Cowboy Bebop',
    providerId: 'tubi',
    providerName: 'Tubi',
    countryCode: 'AU',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://tubitv.com/category/anime',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified AVOD Directory',
  },
  {
    id: '139274_au_gundaminfo',
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'AU',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },

  // Singapore / Southeast Asia (SG, MY, PH, ID, TH, IN)
  {
    id: '140960_sg_muse',
    animeId: 140960,
    animeTitle: 'SPY×FAMILY',
    providerId: 'muse_asia',
    providerName: 'Muse Asia Official YouTube',
    countryCode: 'SG',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '154587_sg_muse',
    animeId: 154587,
    animeTitle: "Frieren: Beyond Journey's End",
    providerId: 'muse_asia',
    providerName: 'Muse Asia Official YouTube',
    countryCode: 'SG',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '113415_sg_anione',
    animeId: 113415,
    animeTitle: 'Jujutsu Kaisen',
    providerId: 'anione_asia',
    providerName: 'Ani-One Asia Official YouTube',
    countryCode: 'SG',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@AniOneAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '140960_my_muse',
    animeId: 140960,
    animeTitle: 'SPY×FAMILY',
    providerId: 'muse_asia',
    providerName: 'Muse Asia Official YouTube',
    countryCode: 'MY',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '154587_my_muse',
    animeId: 154587,
    animeTitle: "Frieren: Beyond Journey's End",
    providerId: 'muse_asia',
    providerName: 'Muse Asia Official YouTube',
    countryCode: 'MY',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '140960_ph_muse',
    animeId: 140960,
    animeTitle: 'SPY×FAMILY',
    providerId: 'muse_asia',
    providerName: 'Muse Asia Official YouTube',
    countryCode: 'PH',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@MuseAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },
  {
    id: '113415_in_anione',
    animeId: 113415,
    animeTitle: 'Jujutsu Kaisen',
    providerId: 'anione_asia',
    providerName: 'Ani-One Asia Official YouTube',
    countryCode: 'IN',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@AniOneAsia',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Licensor Channel',
  },

  // Japan (JP)
  {
    id: '154587_jp_abema',
    animeId: 154587,
    animeTitle: "Frieren: Beyond Journey's End",
    providerId: 'abema',
    providerName: 'ABEMA',
    countryCode: 'JP',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://abema.tv/video/genre/animation',
    accessModel: 'Free with Ads',
    availabilityType: 'selected_episodes',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Regional Broadcaster',
  },
  {
    id: '139274_jp_gundaminfo',
    animeId: 139274,
    animeTitle: 'Mobile Suit Gundam: The Witch from Mercury',
    providerId: 'gundaminfo',
    providerName: 'GundamInfo Official YouTube',
    countryCode: 'JP',
    isFree: true,
    isLegitimate: true,
    officialUrl: 'https://www.youtube.com/@GundamInfo',
    accessModel: 'Free with Ads',
    availabilityType: 'full_series',
    verificationStatus: 'verified',
    lastVerifiedAt: '2026-11-24',
    source: 'Verified Official Publisher Channel',
  },
];

export function isEligibleVerifiedFreeProvider(
  provider: Partial<StreamingProvider> | null | undefined
): provider is StreamingProvider {
  if (!provider || typeof provider !== 'object') return false;
  if (!provider.id || !provider.name || !provider.description) return false;
  if (provider.isFree !== true || provider.isLegitimate !== true) return false;
  if (provider.verificationStatus !== 'verified') return false;
  if (!provider.accessModel || !VALID_ACCESS_MODELS.has(provider.accessModel)) {
    return false;
  }
  if (
    !Array.isArray(provider.supportedCountries) ||
    provider.supportedCountries.length === 0
  ) {
    return false;
  }
  const hasValidCountry = provider.supportedCountries.every(
    (code) => typeof code === 'string' && /^[A-Z]{2}$/.test(code)
  );
  if (!hasValidCountry) return false;
  if (!provider.lastVerifiedAt || typeof provider.lastVerifiedAt !== 'string') {
    return false;
  }
  if (
    !isApprovedOfficialStreamingUrl(
      provider.officialUrl,
      provider.allowedDomains
    )
  ) {
    return false;
  }
  return true;
}

export function isEligibleVerifiedFreeAvailability(
  record: Partial<AnimeStreamingAvailability> | null | undefined,
  providers: StreamingProvider[] = VERIFIED_FREE_PROVIDERS
): record is AnimeStreamingAvailability {
  if (!record || typeof record !== 'object') return false;
  if (!record.id || typeof record.id !== 'string') return false;
  if (typeof record.animeId !== 'number' || !Number.isInteger(record.animeId) || record.animeId <= 0) {
    return false;
  }
  if (typeof record.animeTitle !== 'string' || !record.animeTitle.trim()) {
    return false;
  }
  if (typeof record.providerId !== 'string' || !record.providerId.trim()) {
    return false;
  }
  if (typeof record.providerName !== 'string' || !record.providerName.trim()) {
    return false;
  }
  if (typeof record.countryCode !== 'string' || !/^[A-Z]{2}$/.test(record.countryCode)) {
    return false;
  }
  if (record.isFree !== true || record.isLegitimate !== true) return false;
  if (record.verificationStatus !== 'verified') return false;
  if (!record.accessModel || !VALID_ACCESS_MODELS.has(record.accessModel)) {
    return false;
  }
  if (
    !record.availabilityType ||
    !VALID_AVAILABILITY_TYPES.has(record.availabilityType)
  ) {
    return false;
  }
  if (!record.lastVerifiedAt || typeof record.lastVerifiedAt !== 'string' || !record.lastVerifiedAt.trim()) {
    return false;
  }
  if (!record.source || typeof record.source !== 'string' || !record.source.trim()) {
    return false;
  }

  const matchedProvider = providers.find((p) => p.id === record.providerId);
  if (matchedProvider) {
    if (!isEligibleVerifiedFreeProvider(matchedProvider)) return false;
    if (!matchedProvider.supportedCountries.includes(record.countryCode)) {
      return false;
    }
    if (
      !isApprovedOfficialStreamingUrl(
        record.officialUrl,
        matchedProvider.allowedDomains
      )
    ) {
      return false;
    }
  } else {
    if (!isApprovedOfficialStreamingUrl(record.officialUrl)) {
      return false;
    }
  }

  return true;
}

export function mergeVerifiedProviders(
  extraProviders: Partial<StreamingProvider>[] = [],
  baseline: StreamingProvider[] = VERIFIED_FREE_PROVIDERS
): StreamingProvider[] {
  const byId = new Map<string, StreamingProvider>();
  for (const item of baseline) {
    if (isEligibleVerifiedFreeProvider(item)) {
      byId.set(item.id, item);
    }
  }
  for (const item of extraProviders) {
    if (isEligibleVerifiedFreeProvider(item)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

export function mergeVerifiedAvailability(
  extraRecords: Partial<AnimeStreamingAvailability>[] = [],
  providers: StreamingProvider[] = VERIFIED_FREE_PROVIDERS,
  baseline: AnimeStreamingAvailability[] = CURATED_STREAMING_AVAILABILITY
): AnimeStreamingAvailability[] {
  const byId = new Map<string, AnimeStreamingAvailability>();
  for (const item of baseline) {
    if (isEligibleVerifiedFreeAvailability(item, providers)) {
      byId.set(item.id, item);
    }
  }
  for (const item of extraRecords) {
    if (isEligibleVerifiedFreeAvailability(item, providers)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

export function filterVerifiedProvidersForCountry(
  countryCode: string,
  providers: StreamingProvider[] = VERIFIED_FREE_PROVIDERS
): StreamingProvider[] {
  const normalized = normalizeCountryCode(countryCode);
  return providers.filter(
    (p) =>
      isEligibleVerifiedFreeProvider(p) &&
      p.supportedCountries.includes(normalized)
  );
}

export function filterVerifiedAvailabilityForAnime(
  animeId: number,
  countryCode: string,
  records: AnimeStreamingAvailability[] = CURATED_STREAMING_AVAILABILITY,
  providers: StreamingProvider[] = VERIFIED_FREE_PROVIDERS
): AnimeStreamingAvailability[] {
  const normalized = normalizeCountryCode(countryCode);
  return records.filter(
    (item) =>
      isEligibleVerifiedFreeAvailability(item, providers) &&
      Number(item.animeId) === Number(animeId) &&
      item.countryCode === normalized
  );
}

export function filterVerifiedAvailabilityForCountry(
  countryCode: string,
  queryText: string = '',
  records: AnimeStreamingAvailability[] = CURATED_STREAMING_AVAILABILITY,
  providers: StreamingProvider[] = VERIFIED_FREE_PROVIDERS
): AnimeStreamingAvailability[] {
  const normalized = normalizeCountryCode(countryCode);
  const q = queryText.trim().toLowerCase();
  return records.filter((item) => {
    if (!isEligibleVerifiedFreeAvailability(item, providers)) return false;
    if (item.countryCode !== normalized) return false;
    if (!q) return true;
    return (
      item.animeTitle.toLowerCase().includes(q) ||
      item.providerName.toLowerCase().includes(q)
    );
  });
}
