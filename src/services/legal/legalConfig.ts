import type { LegalPageSlug } from '../../types';

export interface OperatorLegalMetadata {
  platformName: string;
  shortName: string;
  operatorLegalName: string;
  operatorRegistrationNumber: string;
  primaryJurisdiction: string;
  physicalAddress: string;
  legalContactEmail: string;
  copyrightAgentEmail: string;
  informationOfficerName: string;
  lastUpdatedIso: string;
  lastUpdatedHuman: string;
  minimumAgeYears: number;
}

export const ATA_OPERATOR_LEGAL_CONFIG: OperatorLegalMetadata = {
  platformName: 'All Things Anime',
  shortName: 'ATA',
  operatorLegalName: '[OWNER ACTION REQUIRED: Insert Legal Entity / Proprietor Name]',
  operatorRegistrationNumber:
    '[OWNER ACTION REQUIRED: Insert Company Registration Number or Sole Proprietor Reference]',
  primaryJurisdiction: 'Republic of South Africa (with global online availability)',
  physicalAddress:
    '[OWNER ACTION REQUIRED: Insert Physical Service Address for Legal & PAIA Notices]',
  legalContactEmail: '[OWNER ACTION REQUIRED: Insert Privacy / Legal Contact Email]',
  copyrightAgentEmail: '[OWNER ACTION REQUIRED: Insert Copyright / Takedown Contact Email]',
  informationOfficerName: '[OWNER ACTION REQUIRED: Insert POPIA Information Officer Name]',
  lastUpdatedIso: '2026-11-24',
  lastUpdatedHuman: '24 November 2026',
  minimumAgeYears: 13,
};

export interface StorageInventoryItem {
  id: string;
  storageType: 'localStorage' | 'sessionStorage' | 'IndexedDB' | 'Cache Storage';
  keyOrDatabase: string;
  category: 'strictly_necessary' | 'functional_preferences';
  purpose: string;
  retention: string;
}

export const ATA_STORAGE_INVENTORY: readonly StorageInventoryItem[] = [
  {
    id: 'firebase-auth-idb',
    storageType: 'IndexedDB',
    keyOrDatabase: 'firebaseLocalStorageDb',
    category: 'strictly_necessary',
    purpose:
      'Maintains your authenticated Firebase session when "Keep my ATA session signed in" is selected.',
    retention: 'Until sign-out, account revocation, or browser site data clearance.',
  },
  {
    id: 'firebase-auth-session',
    storageType: 'sessionStorage',
    keyOrDatabase: 'firebase:authUser:*',
    category: 'strictly_necessary',
    purpose:
      'Holds temporary session authentication state during single-tab sessions when persistent sign-in is unchecked.',
    retention: 'Cleared when the browser tab or session closes.',
  },
  {
    id: 'workbox-pwa-cache',
    storageType: 'Cache Storage',
    keyOrDatabase: 'workbox-precache-v2 / ata-google-fonts-*',
    category: 'strictly_necessary',
    purpose:
      'Caches static application shell assets and font stylesheets for offline PWA support. Firebase Auth, Firestore, and Storage requests use NetworkOnly and are never cached in the service worker.',
    retention: 'Managed automatically by Workbox cache expiration rules.',
  },
  {
    id: 'theme-preference',
    storageType: 'localStorage',
    keyOrDatabase: 'ata-theme-preference',
    category: 'functional_preferences',
    purpose: 'Remembers your Light or Dark theme selection locally.',
    retention: 'Persistent until changed or cleared in browser settings.',
  },
  {
    id: 'country-preference',
    storageType: 'localStorage',
    keyOrDatabase: 'ata_preferred_country',
    category: 'functional_preferences',
    purpose:
      'Remembers your selected country in Where to Watch (defaults to South Africa).',
    retention: 'Persistent until changed or cleared.',
  },
  {
    id: 'anilist-public-cache',
    storageType: 'localStorage',
    keyOrDatabase: 'ata:anilist:v1:*',
    category: 'functional_preferences',
    purpose:
      'Caches public AniList catalogue metadata briefly (15 minutes) to avoid redundant API requests.',
    retention: '15-minute TTL.',
  },
  {
    id: 'pwa-install-dismiss',
    storageType: 'localStorage',
    keyOrDatabase: 'ata_pwa_install_dismissed_at',
    category: 'functional_preferences',
    purpose: 'Remembers when you dismissed the PWA install banner so it does not nag repeatedly.',
    retention: 'Persistent until cleared.',
  },
  {
    id: 'storage-notice-ack',
    storageType: 'localStorage',
    keyOrDatabase: 'ata_storage_notice_ack_v1',
    category: 'strictly_necessary',
    purpose: 'Records your acknowledgement or functional-cache preference choice.',
    retention: 'Persistent until cleared.',
  },
] as const;

export const ATA_TRACKING_AUDIT_DISCLOSURE = {
  usesAdvertisingCookies: false,
  usesCrossSiteBehavioralTracking: false,
  usesGoogleAnalytics: false,
  usesMetaOrAdPixels: false,
  requiresTrackingConsentBanner: false,
  summary:
    'ATA does not load Google Analytics, advertising pixels, cross-site trackers, or third-party marketing cookies. Browser storage is limited to strictly necessary authentication/offline operation and optional local UI preferences.',
} as const;

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocumentContent {
  slug: LegalPageSlug;
  title: string;
  subtitle: string;
  publishedDate: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalPageSlug, LegalDocumentContent> = {
  'privacy-policy': {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    subtitle: 'How All Things Anime (ATA) handles personal information under POPIA and applicable global standards.',
    publishedDate: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    lastUpdated: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    sections: [
      {
        heading: '1. Responsible Party & Contact Information',
        paragraphs: [
          `This Privacy Policy explains how ${ATA_OPERATOR_LEGAL_CONFIG.platformName} ("ATA") collects, uses, stores, and protects personal information. Primary regulatory alignment is with the South African Protection of Personal Information Act 4 of 2013 ("POPIA"), alongside international user rights where applicable.`,
          `Operator: ${ATA_OPERATOR_LEGAL_CONFIG.operatorLegalName}. Registration: ${ATA_OPERATOR_LEGAL_CONFIG.operatorRegistrationNumber}. Physical Address: ${ATA_OPERATOR_LEGAL_CONFIG.physicalAddress}. Information Officer: ${ATA_OPERATOR_LEGAL_CONFIG.informationOfficerName}. Privacy Contact: ${ATA_OPERATOR_LEGAL_CONFIG.legalContactEmail}.`,
        ],
      },
      {
        heading: '2. Personal Information We Collect',
        paragraphs: [
          'We collect only the information reasonably necessary to operate ATA accounts, community participation, personal anime tracking, and safety moderation:',
        ],
        bullets: [
          'Account credentials & identity: email address, password hash (managed by Firebase Authentication; never stored in plaintext by ATA), unique username, display name, and email verification state.',
          'Profile & personalisation preferences: optional bio, avatar URL, theme, accent colour, feed density, favourite genres/studios, anime watchlist status, episode progress, custom collections, and watch reminders.',
          'Community & messaging activity: posts, comments, community memberships, direct/group messages (stored in participant-restricted collections), reports, copyright complaints, and user feedback.',
          'Technical & security telemetry: server timestamps, Firebase Authentication session identifiers, and tamper-resistant administrator audit/login events.',
        ],
      },
      {
        heading: '3. Purpose & Lawful Basis for Processing',
        paragraphs: [
          'We process your personal information to provide requested platform services, verify account ownership, prevent spam or abuse, respond to legal or copyright takedown notices, and maintain platform security.',
        ],
      },
      {
        heading: '4. Children & Minimum Age',
        paragraphs: [
          `ATA is not directed to children under ${ATA_OPERATOR_LEGAL_CONFIG.minimumAgeYears} years of age (or under 18 without competent consent where required by South African law under POPIA Section 35 for children). We do not knowingly collect personal information from minors below applicable age thresholds without verifiable guardian consent. Suspected underage accounts can be reported via our safety or legal contact channels for prompt removal.`,
        ],
      },
      {
        heading: '5. Infrastructure Processors & Cross-Border Transfers',
        paragraphs: [
          'ATA relies on Google Firebase (Authentication, Cloud Firestore, Firebase Storage, Cloud Functions) for account security and database hosting, AniList GraphQL (public read-only anime metadata requests; no ATA account PII is sent to AniList), and Google Fonts stylesheets. Cross-border cloud processing is subject to contractual safeguards consistent with POPIA Section 72.',
        ],
      },
      {
        heading: '6. Data Retention & Your Rights',
        paragraphs: [
          'You may update your profile and personalisation settings inside ATA at any time, or submit an Account Deletion Request directly from your Profile settings. Active moderation evidence and security audit logs may be retained only as long as reasonably necessary to enforce bans, resolve disputes, or meet legal obligations.',
          'Under POPIA (and GDPR where applicable), you have the right to request access to, correction of, objection to, or deletion of your personal information, and to lodge a complaint with the Information Regulator of South Africa.',
        ],
      },
      {
        heading: '7. Information Regulator (South Africa) & Escalation',
        paragraphs: [
          'If a privacy concern is not resolved after contacting our Information Officer, South African users may escalate matters to the Information Regulator (South Africa) at inforeg.org.za.',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Terms & Conditions',
    subtitle: 'Rules governing access to and use of All Things Anime (ATA).',
    publishedDate: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    lastUpdated: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    sections: [
      {
        heading: '1. Acceptance of Terms & Operator Details',
        paragraphs: [
          `By creating an account or accessing ${ATA_OPERATOR_LEGAL_CONFIG.platformName} ("ATA"), you agree to these Terms & Conditions and our Community Guidelines. Operator: ${ATA_OPERATOR_LEGAL_CONFIG.operatorLegalName} (${ATA_OPERATOR_LEGAL_CONFIG.primaryJurisdiction}). Contact: ${ATA_OPERATOR_LEGAL_CONFIG.legalContactEmail}.`,
        ],
      },
      {
        heading: '2. Eligibility & Account Security',
        paragraphs: [
          'You must provide a valid email address, complete email verification for publishing/social actions, keep your password confidential, and maintain accurate account information. You may not impersonate another person, create automated spam accounts, or attempt to bypass security controls or administrator restrictions.',
        ],
      },
      {
        heading: '3. Acceptable Use & Community Conduct',
        paragraphs: [
          'Members must follow our Community Guidelines. Harassment, hate speech, non-consensual sharing of private messages, unmarked major spoilers, malware, and unlawful piracy links are prohibited. ATA reserves the right to remove violating content and suspend or permanently ban offending accounts.',
        ],
      },
      {
        heading: '4. Intellectual Property & Third-Party Anime Metadata',
        paragraphs: [
          'You retain ownership of original commentary and reviews you write, while granting ATA a limited, non-exclusive license to display your public posts and public collections on the platform. Anime catalogue data retrieved from AniList remains subject to AniList and underlying studio/licensor rights.',
          'Where to Watch links strictly point to official third-party free legal streaming domains verified by ATA administrators. ATA does not host anime video streams and does not guarantee continuous third-party catalogue availability.',
        ],
      },
      {
        heading: '5. Copyright Takedown & Counter-Notice Procedure',
        paragraphs: [
          `Rights holders may submit formal copyright infringement or takedown notices via the in-app Copyright Complaint workflow or by contacting ${ATA_OPERATOR_LEGAL_CONFIG.copyrightAgentEmail}. Promptly verified infringing material or links will be disabled pending review.`,
        ],
      },
      {
        heading: '6. Disclaimers & Limitation of Liability',
        paragraphs: [
          'ATA is provided on an "as is" and "as available" basis to the fullest extent permitted under South African law (including the Consumer Protection Act 68 of 2008 and Electronic Communications and Transactions Act 25 of 2002 where applicable). Nothing in these Terms excludes liability that cannot lawfully be excluded.',
        ],
      },
      {
        heading: '7. Governing Law & Disputes',
        paragraphs: [
          'These Terms are governed by the laws of the Republic of South Africa without prejudice to mandatory consumer protections in your jurisdiction of residence.',
        ],
      },
    ],
  },
  'cookie-policy': {
    slug: 'cookie-policy',
    title: 'Cookie & Browser Storage Policy',
    subtitle: 'Transparent inventory of essential authentication and local preference storage used by ATA.',
    publishedDate: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    lastUpdated: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    sections: [
      {
        heading: '1. Honest Assessment of Tracking & Cookies',
        paragraphs: [
          ATA_TRACKING_AUDIT_DISCLOSURE.summary,
          'Because ATA currently operates without third-party advertising cookies or behavioral analytics SDKs, no marketing tracking consent wall is triggered. You remain free to inspect, adjust, or clear optional local UI caches below.',
        ],
      },
      {
        heading: '2. Strictly Necessary Storage',
        paragraphs: [
          'Essential storage technologies keep your sign-in session authenticated (Firebase Auth IndexedDB/sessionStorage), keep your offline PWA shell responsive (Workbox precache), and ensure Firestore security checks work properly.',
        ],
      },
      {
        heading: '3. Functional Preference Caches',
        paragraphs: [
          'Local preferences such as Dark/Light theme, preferred Where to Watch country (defaulting to South Africa), and brief 15-minute public AniList catalogue caches are stored locally in your browser so settings persist smoothly across reloads.',
        ],
      },
      {
        heading: '4. Managing Your Browser Storage',
        paragraphs: [
          'You can open ATA Storage Preferences from the site footer at any time to clear non-essential local caches, or configure your browser to restrict localStorage/IndexedDB (noting that blocking strictly necessary Auth storage will prevent staying signed in).',
        ],
      },
    ],
  },
  'refund-policy': {
    slug: 'refund-policy',
    title: 'Refund & Paid Services Policy',
    subtitle: 'Current free-access status of All Things Anime and future billing transparency.',
    publishedDate: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    lastUpdated: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    sections: [
      {
        heading: '1. No Paid Subscriptions or In-App Purchases Currently Offered',
        paragraphs: [
          'All Things Anime (ATA) currently operates with zero paid memberships, zero paywalls, zero rentals, and zero in-app purchases. All implemented community, watchlist, companion calendar, news, and Where to Watch free-directory features are free to access.',
        ],
      },
      {
        heading: '2. Third-Party Services',
        paragraphs: [
          'Where to Watch exclusively surfaces free and ad-supported legal streaming providers. ATA never collects payment details or processes transactions on behalf of third-party streaming platforms.',
        ],
      },
      {
        heading: '3. Future Paid Features & Consumer Rights',
        paragraphs: [
          'Should ATA introduce optional paid memberships or digital goods in the future, clear pricing, billing cadence, cancellation methods, and cooling-off/refund rights compliant with the South African Consumer Protection Act (CPA) and ECTA Section 44 will be published and explicitly accepted prior to any purchase.',
        ],
      },
    ],
  },
  'community-guidelines': {
    slug: 'community-guidelines',
    title: 'Community Guidelines',
    subtitle: 'Shared standards keeping ATA discussions respectful, spoiler-safe, and legally compliant.',
    publishedDate: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    lastUpdated: ATA_OPERATOR_LEGAL_CONFIG.lastUpdatedHuman,
    sections: [
      {
        heading: '1. Respect Fellow Fans & Critique Ideas, Not People',
        paragraphs: [
          'Passionate anime debates are welcome; harassment, slurs, hate speech, doxxing, and targeted intimidation are strictly prohibited across posts, comments, communities, and private messages.',
        ],
      },
      {
        heading: '2. Protect Spoilers Using Spoiler Tags',
        paragraphs: [
          'Always toggle the spoiler tag and specify the anime title/episode when discussing major plot twists, endings, or recent manga developments.',
        ],
      },
      {
        heading: '3. Zero Piracy & Unauthorised Streams',
        paragraphs: [
          'Do not post links to pirated anime streams, torrent indices, unauthorised download portals, or infringing full-episode uploads. Use Where to Watch strictly for verified legal free streaming options.',
        ],
      },
      {
        heading: '4. Authentic Participation & No Spam',
        paragraphs: [
          'Avoid repetitive self-promotion, impersonation of creators or moderators, or evasion of community bans and user blocks.',
        ],
      },
      {
        heading: '5. Moderation & Appeals',
        paragraphs: [
          `Moderation decisions are logged with evidence review by designated ATA administrators. To contest a removal or report an urgent safety issue, contact ${ATA_OPERATOR_LEGAL_CONFIG.legalContactEmail} or submit an in-app report.`,
        ],
      },
    ],
  },
};

export interface LegalRiskRegisterEntry {
  id: string;
  domain: string;
  statuteOrStandard: string;
  riskLevel: 'low' | 'medium' | 'high';
  currentControl: string;
  remainingOwnerAction: string;
}

export const ATA_LEGAL_RISK_REGISTER: readonly LegalRiskRegisterEntry[] = [
  {
    id: 'risk-popia-operator',
    domain: 'Privacy & Responsible Party Identity',
    statuteOrStandard: 'POPIA (Act 4 of 2013) & PAIA (Act 2 of 2000)',
    riskLevel: 'high',
    currentControl:
      'Privacy Policy, isolated users/{uid} PII rules, owner-only private prefs, and in-app Account Deletion Request workflow implemented.',
    remainingOwnerAction:
      'Populate legal entity/proprietor name, physical service address, Information Officer name & contact email in legalConfig.ts, and register Information Officer with the SA Information Regulator.',
  },
  {
    id: 'risk-popia-children',
    domain: 'Children’s Privacy',
    statuteOrStandard: 'POPIA Section 35 & GDPR Art. 8',
    riskLevel: 'medium',
    currentControl:
      'Registration form includes explicit minimum-age confirmation checkbox (un-prechecked) and Privacy Policy disclosure.',
    remainingOwnerAction:
      'Determine whether South African under-18 parental consent workflow is required based on target audience onboarding.',
  },
  {
    id: 'risk-copyright-news-images',
    domain: 'Third-Party Editorial Images & Copyright',
    statuteOrStandard: 'SA Copyright Act 98 of 1978 & ECTA Safe Harbour (Ch. XI)',
    riskLevel: 'medium',
    currentControl:
      'Removed unverified external Unsplash URLs from newsService.ts; replaced with local original ATA assets; marked baseline items transparently as sample previews; added user Copyright & Takedown Complaint workflow and Admin review queue.',
    remainingOwnerAction:
      'Publish live articles only with verified studio press-kit rights or original commentary, and configure dedicated takedown contact inbox.',
  },
  {
    id: 'risk-streaming-links',
    domain: 'Free Streaming Directory Liability',
    statuteOrStandard: 'ECTA Chapter XI & Anti-Piracy Compliance',
    riskLevel: 'low',
    currentControl:
      'Firestore rules and client validators strictly enforce HTTPS allowlisted official provider domains, isFree == true, isLegitimate == true, and human verification timestamps.',
    remainingOwnerAction:
      'Periodically re-verify regional licensing availability via Admin Content Dashboard as licensors rotate catalogues.',
  },
  {
    id: 'risk-admin-provisioning',
    domain: 'Administrator Access Control & Breach Response',
    statuteOrStandard: 'POPIA Section 22 (Security Compromises)',
    riskLevel: 'medium',
    currentControl:
      'Strict 3-seat cap, zero hardcoded passwords/client self-promotion, Cloud Functions auth + custom claims + Firestore admin doc checks, immutable audit logs, and Admin Security Incident Log.',
    remainingOwnerAction:
      'Manually provision Admin Seat 1 (Owner) in Firebase Auth/Firestore, deploy updated firestore.rules & functions, and document POPIA Section 22 regulator notification runbook.',
  },
  {
    id: 'risk-ectl-cookies',
    domain: 'Cookies, Tracking & Consumer Law',
    statuteOrStandard: 'ECTA, CPA (Act 68 of 2008), GDPR ePrivacy',
    riskLevel: 'low',
    currentControl:
      'Zero external ad pixels/Google Analytics present; accurate Cookie/Storage inventory and preference reset modal published; accurate free-tier Refund Policy published.',
    remainingOwnerAction:
      'If third-party analytics or paid subscriptions are added later, require explicit opt-in consent gate and updated CPA/ECTA billing terms before launch.',
  },
] as const;
