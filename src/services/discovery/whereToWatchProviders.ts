export interface ExternalWatchProvider {
  id: 'miruro' | 'anikoto' | 'anichi';
  name: string;
  url: string;
  shortCode: string;
  domainLabel: string;
}

export const WHERE_TO_WATCH_PENDING_NOTE =
  'External websites — provider verification is pending.';

export const WHERE_TO_WATCH_EXTERNAL_PROVIDERS: readonly ExternalWatchProvider[] = [
  {
    id: 'miruro',
    name: 'Miruro',
    url: 'https://www.miruro.bz/',
    shortCode: 'MR',
    domainLabel: 'miruro.bz',
  },
  {
    id: 'anikoto',
    name: 'Anikoto',
    url: 'https://anikoto.net/',
    shortCode: 'AK',
    domainLabel: 'anikoto.net',
  },
  {
    id: 'anichi',
    name: 'Anichi',
    url: 'https://anichi.cz/',
    shortCode: 'AC',
    domainLabel: 'anichi.cz',
  },
] as const;

export function getExternalWatchProviders(): readonly ExternalWatchProvider[] {
  return WHERE_TO_WATCH_EXTERNAL_PROVIDERS;
}
