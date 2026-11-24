import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WHERE_TO_WATCH_EXTERNAL_PROVIDERS,
  WHERE_TO_WATCH_PENDING_NOTE,
  getExternalWatchProviders,
} from './whereToWatchProviders';
import { resolveRouteFromLocation } from '../routingService';

// 1. Verify the three owner-supplied external providers and exact URLs
const providers = getExternalWatchProviders();
assert.equal(providers.length, 3);
assert.deepEqual(
  providers.map((p) => ({ name: p.name, url: p.url })),
  [
    { name: 'Miruro', url: 'https://www.miruro.bz/' },
    { name: 'Anikoto', url: 'https://anikoto.net/' },
    { name: 'Anichi', url: 'https://anichi.cz/' },
  ]
);

for (const provider of WHERE_TO_WATCH_EXTERNAL_PROVIDERS) {
  assert.ok(provider.shortCode.length >= 2);
  assert.ok(provider.domainLabel.length > 0);
  const parsed = new URL(provider.url);
  assert.equal(parsed.protocol, 'https:');
}

// 2. Verify exact neutral pending note and absence of unverified legal/free/safe claims
assert.equal(
  WHERE_TO_WATCH_PENDING_NOTE,
  'External websites — provider verification is pending.'
);
const loweredNote = WHERE_TO_WATCH_PENDING_NOTE.toLowerCase();
assert.equal(loweredNote.includes('legal'), false);
assert.equal(loweredNote.includes('licensed'), false);
assert.equal(loweredNote.includes('free'), false);
assert.equal(loweredNote.includes('safe'), false);

// 3. Verify standalone Where to Watch navigation and route are removed
const sampleDataSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/assets/sampleData.ts'),
  'utf8'
);
assert.equal(sampleDataSource.includes("id: 'where-to-watch'"), false);

assert.deepEqual(
  resolveRouteFromLocation('/All-Things-Anime/where-to-watch', '', '/All-Things-Anime/'),
  { kind: 'destination', destination: 'home' }
);
assert.deepEqual(
  resolveRouteFromLocation('/All-Things-Anime/', '#/where-to-watch', '/All-Things-Anime/'),
  { kind: 'destination', destination: 'home' }
);

// 4. Verify safe external-link attributes and integration inside AnimeDetailModal
const sectionSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/discovery/WhereToWatchSection.tsx'),
  'utf8'
);
assert.ok(sectionSource.includes('target="_blank"'));
assert.ok(sectionSource.includes('rel="noopener noreferrer"'));
assert.ok(sectionSource.includes('Visit Website'));

const modalSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/discovery/AnimeDetailModal.tsx'),
  'utf8'
);
assert.ok(modalSource.includes('<WhereToWatchSection />'));

console.log('whereToWatchProviders.test.ts: ALL ASSERTIONS PASSED');
