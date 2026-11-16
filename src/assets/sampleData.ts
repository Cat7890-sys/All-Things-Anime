import type {
  ComingSoonFeatureSpec,
  CommunityHighlight,
  DiscoverySeriesItem,
  DiscussionThread,
  NavDestination,
  TrendingAnimeItem,
} from '../types';

export const ATA_BRAND = {
  shortName: 'ATA',
  fullName: 'ALL THINGS ANIME',
  tagline: 'One Universe. Infinite Opinions.',
  foundationLabel: 'Build 02 · Independent Accounts',
  demonstrationNotice: 'Sample Demonstration Content — No live user feed connected yet.',
} as const;

export const WELCOME_BANNER_IMAGE =
  '/src/assets/images/ata_cosmic_banner_1794834295302.jpg';

export const NAV_DESTINATIONS: NavDestination[] = [
  {
    id: 'home',
    label: 'Home / Feed',
    shortLabel: 'Home',
    description: 'Platform overview, sample discussions, and anime discovery preview.',
    isImplemented: true,
  },
  {
    id: 'discover',
    label: 'Discover',
    shortLabel: 'Discover',
    description: 'Browse seasonal catalogues, genre indexes, and curated watchlists.',
    isImplemented: false,
  },
  {
    id: 'communities',
    label: 'Communities',
    shortLabel: 'Clubs',
    description: 'Dedicated fan clubs, episode discussion rooms, and debate circles.',
    isImplemented: false,
  },
  {
    id: 'messages',
    label: 'Messages',
    shortLabel: 'Messages',
    description: 'Direct conversations and watch-party threads with friends.',
    isImplemented: false,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    shortLabel: 'Alerts',
    description: 'Replies, debate mentions, and community updates.',
    isImplemented: false,
  },
  {
    id: 'profile',
    label: 'Profile',
    shortLabel: 'Profile',
    description: 'Independent ATA account, verification status, and profile editing.',
    isImplemented: true,
  },
];

export const SAMPLE_DISCUSSIONS: DiscussionThread[] = [
  {
    id: 'disc-01',
    title: 'Why silent environmental framing hits harder than monologue exposition in fantasy arcs',
    excerpt:
      'In the opening episodes of Monolith of Kiri, the camera lingers on crumbling masonry and wind-swept pine valleys instead of explaining the world history through dialogue.',
    fullSampleBody:
      'In the opening episodes of Monolith of Kiri, the camera lingers on crumbling masonry and wind-swept pine valleys instead of explaining the world history through dialogue. This is a classic visual storytelling discipline: letting background art carry institutional weight so character dialogue stays grounded in immediate survival. When ATA launches full thread tools, members will be able to attach scene timestamps and frame-by-frame notes directly inside debates.',
    authorHandle: '@kiri_ink',
    authorDisplay: 'Ren Takahashi',
    category: 'Story & Lore',
    seriesTitle: 'Monolith of Kiri',
    sampleReplyCount: 38,
    sampleUpvotes: 142,
    sampleTimestamp: 'Sample Thread · 2h ago',
    isDemonstration: true,
  },
  {
    id: 'disc-02',
    title: 'Mechanical weight vs. hyper-agile choreography in modern orbital mecha animation',
    excerpt:
      'Do you prefer heavy hydraulic inertia in hangar launch sequences, or crisp high-speed thruster cuts during space skirmishes?',
    fullSampleBody:
      'Do you prefer heavy hydraulic inertia in hangar launch sequences, or crisp high-speed thruster cuts during space skirmishes? Comparing hand-drawn keyframe smears with rigid 3D rig movement shows how lighting beams and panel detailing sell scale. Share which approach defines iconic mecha cinema for you once live polls and threads open in upcoming builds.',
    authorHandle: '@bay_four',
    authorDisplay: 'Mina Sato',
    category: 'Animation',
    seriesTitle: 'Orbital Frame No. 4',
    sampleReplyCount: 24,
    sampleUpvotes: 96,
    sampleTimestamp: 'Sample Thread · 5h ago',
    isDemonstration: true,
  },
  {
    id: 'disc-03',
    title: 'Weekly Debate: Should seasonal anime adaptations restructure slow manga openings?',
    excerpt:
      'Twelve-episode cour limits force directors to condense early world-building chapters—when does pacing discipline help, and when does it erase atmosphere?',
    fullSampleBody:
      'Twelve-episode cour limits force directors to condense early world-building chapters—when does pacing discipline help, and when does it erase atmosphere? Some adaptations trim quiet slice-of-life chapters to reach a mid-season cliffhanger, while others commit to deliberate pacing even at the risk of a slower premiere. This demonstration topic previews how structured community debates will appear on ATA.',
    authorHandle: '@panel_archive',
    authorDisplay: 'Devon Vance',
    category: 'Debates',
    seriesTitle: 'Crimson Moon Chronicle',
    sampleReplyCount: 51,
    sampleUpvotes: 184,
    sampleTimestamp: 'Sample Thread · 1d ago',
    isDemonstration: true,
  },
  {
    id: 'disc-04',
    title: 'Ink-wash brushwork and limited-palette night scenes in historical swordplay anime',
    excerpt:
      'Restricting night combat sequences to charcoal ink, warm paper highlights, and a single crimson moon creates immediate visual clarity.',
    fullSampleBody:
      'Restricting night combat sequences to charcoal ink, warm paper highlights, and a single crimson moon creates immediate visual clarity. Instead of muddying silhouettes with excessive particle glare, bold contrast lets viewers read every stance and blade trajectory cleanly across rooftops.',
    authorHandle: '@sumi_frames',
    authorDisplay: 'Hana Kimura',
    category: 'Animation',
    seriesTitle: 'Crimson Moon Chronicle',
    sampleReplyCount: 19,
    sampleUpvotes: 77,
    sampleTimestamp: 'Sample Thread · 1d ago',
    isDemonstration: true,
  },
];

export const SAMPLE_DISCOVERY_SERIES: DiscoverySeriesItem[] = [
  {
    id: 'series-wanderer',
    title: 'Monolith of Kiri',
    originalTitleNote: 'Original Sample Series',
    genre: 'Adventure · Mystery',
    releaseSeason: 'Sample Season',
    episodeCount: 12,
    synopsis:
      'A cartographer crosses mist-locked mountain ridges to chart floating stone monoliths that alter local gravity every crimson eclipse.',
    studioLabel: 'Sample Studio A',
    coverImageUrl: '/src/assets/images/anime_cover_wanderer_1794831912432.jpg',
    coverAlt:
      'Original manga illustration of a cloaked wanderer facing a floating geometric stone monolith over misty valleys.',
    isDemonstration: true,
  },
  {
    id: 'series-mecha',
    title: 'Orbital Frame No. 4',
    originalTitleNote: 'Original Sample Series',
    genre: 'Mecha · Sci-Fi',
    releaseSeason: 'Sample Season',
    episodeCount: 24,
    synopsis:
      'Dockyard engineers aboard a low-orbit relay station maintain prototype interceptor frames while navigating deep-space salvage treaties.',
    studioLabel: 'Sample Studio B',
    coverImageUrl: '/src/assets/images/anime_cover_mecha_1794831913654.jpg',
    coverAlt:
      'Original anime key visual of an angular white-and-ink mechanical frame standing inside a sunlit orbital hangar.',
    isDemonstration: true,
  },
  {
    id: 'series-martial',
    title: 'Crimson Moon Chronicle',
    originalTitleNote: 'Original Sample Series',
    genre: 'Action · Historical',
    releaseSeason: 'Sample Season',
    episodeCount: 13,
    synopsis:
      'Under a scarlet full moon, an exiled courier navigates lantern-lit rooftops to return stolen calligraphy scrolls before dawn.',
    studioLabel: 'Sample Studio C',
    coverImageUrl: '/src/assets/images/anime_cover_martial_1794831913177.jpg',
    coverAlt:
      'Original graphic novel artwork of a silhouetted swordsman leaping across tiled roofs before a crimson full moon.',
    isDemonstration: true,
  },
];

export const SAMPLE_TRENDING_ANIME: TrendingAnimeItem[] = [
  {
    id: 'trend-01',
    rank: 1,
    title: 'Crimson Moon Chronicle',
    genre: 'Action',
    format: 'TV Series',
    episodeCount: 13,
    discussionVolumeLabel: '184 sample notes',
    isDemonstration: true,
  },
  {
    id: 'trend-02',
    rank: 2,
    title: 'Monolith of Kiri',
    genre: 'Mystery',
    format: 'TV Series',
    episodeCount: 12,
    discussionVolumeLabel: '142 sample notes',
    isDemonstration: true,
  },
  {
    id: 'trend-03',
    rank: 3,
    title: 'Orbital Frame No. 4',
    genre: 'Mecha',
    format: 'TV Series',
    episodeCount: 24,
    discussionVolumeLabel: '96 sample notes',
    isDemonstration: true,
  },
  {
    id: 'trend-04',
    rank: 4,
    title: 'Paper Lantern District',
    genre: 'Slice of Life',
    format: 'Original Film',
    episodeCount: 1,
    discussionVolumeLabel: '64 sample notes',
    isDemonstration: true,
  },
  {
    id: 'trend-05',
    rank: 5,
    title: 'Zero Meridian Line',
    genre: 'Sci-Fi',
    format: 'ONA',
    episodeCount: 10,
    discussionVolumeLabel: '51 sample notes',
    isDemonstration: true,
  },
];

export const SAMPLE_COMMUNITY_HIGHLIGHTS: CommunityHighlight[] = [
  {
    id: 'comm-01',
    name: 'Sakuga Frame Study',
    focus: 'Animation Craft',
    summary: 'Breakdown threads on keyframe timing, smear techniques, and background layout.',
    sampleMemberCount: 'Sample Club · 1.2k preview',
    isDemonstration: true,
  },
  {
    id: 'comm-02',
    name: 'Orbital Hangar Guild',
    focus: 'Mecha & Sci-Fi',
    summary: 'World-building discussions on mechanical design, starship logistics, and retro OVA craft.',
    sampleMemberCount: 'Sample Club · 840 preview',
    isDemonstration: true,
  },
  {
    id: 'comm-03',
    name: 'Ink & Gutter Readers',
    focus: 'Manga Adaptation',
    summary: 'Panel composition comparisons between serialized manga chapters and animated episodes.',
    sampleMemberCount: 'Sample Club · 960 preview',
    isDemonstration: true,
  },
];

export const COMING_SOON_SPECS: Record<
  Exclude<NavDestination['id'], 'home'>,
  ComingSoonFeatureSpec
> = {
  discover: {
    id: 'discover',
    title: 'Discover Universe',
    subtitle: 'Coming Soon · Seasonal Index & Curated Series Explorer',
    overview:
      'The full Discover directory will let fans search series by genre, studio craft, format, and community consensus without clutter or spoiler traps.',
    plannedCapabilities: [
      {
        index: '01',
        title: 'Seasonal & Archive Indexing',
        detail: 'Filter upcoming, airing, and classic anime series with structured episode metadata.',
      },
      {
        index: '02',
        title: 'Mood & Craft Collections',
        detail: 'Curated editorial lists grouped by visual direction, soundtrack style, and pacing.',
      },
      {
        index: '03',
        title: 'Spoiler-Safe Premise Cards',
        detail: 'Clean synopses and community opinion summaries before you start episode one.',
      },
    ],
    milestoneNote:
      'Planned for an upcoming build once the catalogue data model and Firestore collections are wired.',
  },
  communities: {
    id: 'communities',
    title: 'Communities & Fan Clubs',
    subtitle: 'Coming Soon · Dedicated Circles for Deep Discussion',
    overview:
      'Communities will give anime fans structured spaces organized around genres, animation craft, episodic watch-alongs, and respectful debates.',
    plannedCapabilities: [
      {
        index: '01',
        title: 'Topic & Genre Clubs',
        detail: 'Join focused spaces from mecha engineering to slice-of-life cinematography.',
      },
      {
        index: '02',
        title: 'Episode Debate Rooms',
        detail: 'Episode-gated discussion threads that prevent accidental spoilers for catch-up viewers.',
      },
      {
        index: '03',
        title: 'Community Polls & Rankings',
        detail: 'Member-driven seasonal spotlights and weekly frame-of-the-week showcases.',
      },
    ],
    milestoneNote:
      'Club membership, moderation roles, and thread persistence will connect in a later milestone.',
  },
  messages: {
    id: 'messages',
    title: 'Direct Messages',
    subtitle: 'Coming Soon · Private Fan Conversations',
    overview:
      'Messages will enable one-to-one chats and small friend watch-group threads to trade recommendations and react to new episodes.',
    plannedCapabilities: [
      {
        index: '01',
        title: 'Friend Watch Circles',
        detail: 'Lightweight group threads built around shared seasonal watchlists.',
      },
      {
        index: '02',
        title: 'Series & Thread Sharing',
        detail: 'Send anime cards or debate links directly inside conversations.',
      },
      {
        index: '03',
        title: 'Privacy Controls',
        detail: 'Clear message request filters and user-controlled inbox permissions.',
      },
    ],
    milestoneNote:
      'Real-time messaging is intentionally inactive in Build 01—no simulated chat logs are displayed.',
  },
  notifications: {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Coming Soon · Activity & Reply Alerts',
    overview:
      'Notifications will surface direct replies to your opinions, club debate invitations, and seasonal air-date reminders in one quiet inbox.',
    plannedCapabilities: [
      {
        index: '01',
        title: 'Reply & Mention Digests',
        detail: 'Grouped notifications when fellow fans respond to your discussions.',
      },
      {
        index: '02',
        title: 'Club Announcements',
        detail: 'Watch-party schedules and community spotlight updates from clubs you join.',
      },
      {
        index: '03',
        title: 'Granular Signal Preferences',
        detail: 'Mute noisy threads and keep alerts strictly focused on conversations you care about.',
      },
    ],
    milestoneNote:
      'No simulated alerts are generated in this foundation build.',
  },
  profile: {
    id: 'profile',
    title: 'Member Profile',
    subtitle: 'Coming Soon · Personal Anime Identity & Opinion Archive',
    overview:
      'Your ATA profile will showcase your favourite series, saved discussions, club memberships, and personal watch reflections.',
    plannedCapabilities: [
      {
        index: '01',
        title: 'Authentication & Handle Setup',
        detail: 'Secure account sign-in and customizable display profile backed by Firebase Auth.',
      },
      {
        index: '02',
        title: 'Top Series Showcase',
        detail: 'Pin your defining anime favourites and display your current seasonal rotation.',
      },
      {
        index: '03',
        title: 'Opinion & Review Archive',
        detail: 'Keep a clean, searchable record of every discussion post and review you have published.',
      },
    ],
    milestoneNote:
      'Authentication is intentionally omitted in Build 01; account creation will arrive after foundation review.',
  },
};
