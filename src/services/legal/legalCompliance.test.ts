import assert from 'node:assert/strict';
import {
  ATA_LEGAL_RISK_REGISTER,
  ATA_OPERATOR_LEGAL_CONFIG,
  ATA_STORAGE_INVENTORY,
  ATA_TRACKING_AUDIT_DISCLOSURE,
  LEGAL_DOCUMENTS,
} from './legalConfig';
import {
  buildAppHref,
  resolveRouteFromLocation,
  stripBasePath,
} from '../routingService';
import {
  validateAccountDeletionInput,
  validateAdminNewsInput,
  validateAnnouncementInput,
  validateCopyrightComplaintInput,
  validateSecurityIncidentInput,
  validateUserFeedbackInput,
} from '../validation';

// 1. GitHub Pages base-path routing & clean path resolution
const BASE = '/All-Things-Anime/';
assert.equal(stripBasePath('/All-Things-Anime/', BASE), '/');
assert.equal(stripBasePath('/All-Things-Anime/privacy-policy', BASE), '/privacy-policy');
assert.equal(stripBasePath('/All-Things-Anime/admin/login', BASE), '/admin/login');

assert.deepEqual(resolveRouteFromLocation('/All-Things-Anime/admin/login', '', BASE), {
  kind: 'admin-login',
});
assert.deepEqual(resolveRouteFromLocation('/All-Things-Anime/admin', '', BASE), {
  kind: 'admin-dashboard',
});
assert.deepEqual(resolveRouteFromLocation('/All-Things-Anime/terms', '', BASE), {
  kind: 'legal',
  slug: 'terms',
});
assert.deepEqual(
  resolveRouteFromLocation('/All-Things-Anime/', '#/community-guidelines', BASE),
  { kind: 'legal', slug: 'community-guidelines' }
);
assert.equal(
  buildAppHref({ kind: 'legal', slug: 'cookie-policy' }, BASE),
  '/All-Things-Anime/cookie-policy'
);
assert.equal(
  buildAppHref({ kind: 'admin-login' }, BASE),
  '/All-Things-Anime/admin/login'
);
assert.deepEqual(
  resolveRouteFromLocation('/All-Things-Anime/where-to-watch', '', BASE),
  { kind: 'destination', destination: 'home' }
);
assert.deepEqual(
  resolveRouteFromLocation('/All-Things-Anime/', '#/where-to-watch', BASE),
  { kind: 'destination', destination: 'home' }
);

// 2. Legal docs & honest storage audit completeness
const slugs = [
  'privacy-policy',
  'terms',
  'cookie-policy',
  'refund-policy',
  'community-guidelines',
] as const;
for (const slug of slugs) {
  assert.ok(LEGAL_DOCUMENTS[slug].sections.length >= 3, `${slug} must have sections`);
}
assert.equal(ATA_TRACKING_AUDIT_DISCLOSURE.usesAdvertisingCookies, false);
assert.equal(ATA_TRACKING_AUDIT_DISCLOSURE.usesGoogleAnalytics, false);
assert.ok(ATA_STORAGE_INVENTORY.length >= 6);
assert.ok(ATA_LEGAL_RISK_REGISTER.length >= 5);
assert.ok(ATA_OPERATOR_LEGAL_CONFIG.operatorLegalName.includes('[OWNER ACTION REQUIRED'));

// 3. Build 08B compliance & admin form validators
assert.ok(
  validateCopyrightComplaintInput({
    claimantName: 'Jane Doe',
    claimantEmail: 'jane@example.com',
    workTitle: 'Original Illustration',
    targetType: 'post',
    targetReference: 'post-123',
    description: 'Detailed infringement report exceeding ten characters.',
    goodFaithConfirmed: false,
    accuracyConfirmed: true,
  }) !== null
);
assert.equal(
  validateCopyrightComplaintInput({
    claimantName: 'Jane Doe',
    claimantEmail: 'jane@example.com',
    workTitle: 'Original Illustration',
    targetType: 'post',
    targetReference: 'post-123',
    description: 'Detailed infringement report exceeding ten characters.',
    goodFaithConfirmed: true,
    accuracyConfirmed: true,
  }),
  null
);

assert.ok(
  validateAccountDeletionInput({
    reason: 'Leaving platform',
    acknowledgedIrreversible: false,
  }) !== null
);
assert.equal(
  validateAccountDeletionInput({
    reason: 'Leaving platform',
    acknowledgedIrreversible: true,
  }),
  null
);

assert.equal(
  validateUserFeedbackInput({
    category: 'accessibility',
    subject: 'Contrast on News header',
    message: 'Tested in light mode and verified high contrast text.',
  }),
  null
);

assert.equal(
  validateAdminNewsInput({
    title: 'Spring Showcase Schedule Announced',
    source: 'AniList Dispatch',
    sourceUrl: 'https://anilist.co',
    category: 'Events',
    publishedAt: '2026-11-24',
    summary: 'Verified production schedules for upcoming anime premieres.',
    author: 'ATA Editorial',
    status: 'published',
  }),
  null
);

assert.ok(
  validateAnnouncementInput({
    title: 'Targeted Alert',
    body: 'Please verify your collection links.',
    kind: 'safety',
    audience: 'selected_users',
    targetUserIds: [],
  }) !== null
);

assert.equal(
  validateSecurityIncidentInput({
    title: 'Suspicious login burst mitigated',
    severity: 'medium',
    status: 'contained',
    summary: 'Multiple invalid attempts rejected by Firebase Auth rate limiting.',
    remediationSteps: 'Reviewed adminLoginEvents and rotated session tokens.',
  }),
  null
);

console.log('legalCompliance.test.ts: ALL ASSERTIONS PASSED');
