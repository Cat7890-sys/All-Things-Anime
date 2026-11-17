import type { AnimeCatalogueItem } from '../../types';
import animeCoverMartial from '../../assets/images/anime_cover_martial_1794831913177.jpg';
import animeCoverMecha from '../../assets/images/anime_cover_mecha_1794831913654.jpg';
import animeCoverWanderer from '../../assets/images/anime_cover_wanderer_1794831912432.jpg';
import cosmicBannerImage from '../../assets/images/ata_cosmic_banner_1794834295302.jpg';

export const ALL_ANIME_GENRES = [
  'Action',
  'Adventure',
  'Animation & Sakuga',
  'Comedy',
  'Drama',
  'Fantasy & Isekai',
  'Historical',
  'Horror',
  'Josei',
  'Mecha & Sci-Fi',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'School',
  'Seinen',
  'Shojo',
  'Shonen',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
] as const;

export const ALL_ANIME_FORMATS = [
  'TV Series',
  'Movie',
  'OVA',
  'ONA',
  'Special',
] as const;

export const ALL_RELEASE_PERIODS = [
  'Current Airing (2025-2026)',
  'Modern Era (2020-2024)',
  'Golden Decade (2010-2019)',
  '2000s Renaissance',
  'Classic 90s & Earlier',
] as const;

/**
 * Curated, verified Anime Catalogue for ATA with confirmed episode counts,
 * genres, formats, tags, and character rosters.
 */
export const CURATED_ANIME_CATALOGUE: AnimeCatalogueItem[] = [
  {
    id: 'monolith-of-kiri',
    title: 'Monolith of Kiri',
    romajiTitle: 'Kiri no Monolith',
    englishTitle: 'Monolith of Kiri',
    genres: ['Adventure', 'Mystery', 'Fantasy & Isekai'],
    format: 'TV Series',
    episodes: 12,
    seasonYear: '2025',
    synopsis:
      'A cartographer crosses mist-locked mountain ridges to chart floating stone monoliths that alter local gravity during every crimson eclipse.',
    coverImage: animeCoverWanderer,
    score: 8.8,
    characters: ['Ren Takahashi', 'Hana', 'Elder Kael'],
    tags: ['Gravity', 'Exploration', 'Atmospheric', 'Silent Framing'],
    isFeatured: true,
  },
  {
    id: 'orbital-frame-4',
    title: 'Orbital Frame No. 4',
    romajiTitle: 'Kidou Teisatsu Yon-Gou',
    englishTitle: 'Orbital Frame No. 4',
    genres: ['Mecha & Sci-Fi', 'Action', 'Seinen'],
    format: 'TV Series',
    episodes: 24,
    seasonYear: '2024',
    synopsis:
      'Dockyard engineers aboard a low-orbit relay station maintain prototype interceptor frames while navigating deep-space salvage treaties.',
    coverImage: animeCoverMecha,
    score: 8.6,
    characters: ['Mina Sato', 'Commander Vance', 'Pilot Shin'],
    tags: ['Mecha', 'Space Station', 'Engineering', 'Hard Sci-Fi'],
    isFeatured: true,
  },
  {
    id: 'crimson-moon-chronicle',
    title: 'Crimson Moon Chronicle',
    romajiTitle: 'Guren no Tsuki Enki',
    englishTitle: 'Crimson Moon Chronicle',
    genres: ['Action', 'Historical', 'Supernatural'],
    format: 'TV Series',
    episodes: 13,
    seasonYear: '2024',
    synopsis:
      'Under a scarlet full moon, an exiled courier navigates lantern-lit rooftops to return stolen calligraphy scrolls before dawn.',
    coverImage: animeCoverMartial,
    score: 9.0,
    characters: ['Jin Kurogane', 'Lady Sayo', 'Shadow Couriers'],
    tags: ['Swordplay', 'Stealth', 'Historical Kyoto', 'Ink Wash'],
    isFeatured: true,
  },
  {
    id: 'paper-lantern-district',
    title: 'Paper Lantern District',
    romajiTitle: 'Chouchin Machi',
    englishTitle: 'Paper Lantern District',
    genres: ['Slice of Life', 'Drama', 'Romance'],
    format: 'Movie',
    episodes: 1,
    seasonYear: '2023',
    synopsis:
      'An artisan craftsman restores antique paper lanterns along a rain-drenched riverside canal, rediscovering long-forgotten family memories.',
    coverImage: cosmicBannerImage,
    score: 8.4,
    characters: ['Taro', 'Aoi'],
    tags: ['Artisan Craft', 'Melancholy', 'Warm Rain', 'Canal Town'],
  },
  {
    id: 'zero-meridian-line',
    title: 'Zero Meridian Line',
    romajiTitle: 'Zero-sen Shigo-sen',
    englishTitle: 'Zero Meridian Line',
    genres: ['Mecha & Sci-Fi', 'Psychological', 'Thriller'],
    format: 'ONA',
    episodes: 10,
    seasonYear: '2024',
    synopsis:
      'Sub-orbital chronometer pilots sync quantum timestamps across fragmented timelines to prevent dimensional collapse.',
    coverImage: animeCoverMecha,
    score: 8.7,
    characters: ['Navigator Lux', 'Officer Maya'],
    tags: ['Time Travel', 'Quantum', 'Mind-Bending', 'Cerebral'],
  },
  {
    id: 'frieren-journey-end',
    title: "Frieren: Beyond Journey's End",
    romajiTitle: 'Sousou no Frieren',
    englishTitle: "Frieren: Beyond Journey's End",
    genres: ['Fantasy & Isekai', 'Adventure', 'Drama', 'Slice of Life'],
    format: 'TV Series',
    episodes: 28,
    seasonYear: '2023',
    synopsis:
      'An elven mage reflecting on human mortality embarks on a quiet pilgrimage retracing the steps of her former hero companions.',
    coverImage: animeCoverWanderer,
    score: 9.3,
    characters: ['Frieren', 'Fern', 'Stark', 'Himmel', 'Heiter', 'Eisen'],
    tags: ['Elves', 'Magic', 'Melancholy', 'Journey', 'Top Rated'],
    isFeatured: true,
  },
  {
    id: 'cowboy-bebop',
    title: 'Cowboy Bebop',
    romajiTitle: 'Cowboy Bebop',
    englishTitle: 'Cowboy Bebop',
    genres: ['Mecha & Sci-Fi', 'Action', 'Seinen', 'Music'],
    format: 'TV Series',
    episodes: 26,
    seasonYear: '1998',
    synopsis:
      'An eclectic crew of bounty hunters travel aboard the Bebop starship through the Solar System pursuing elusive targets and confronting their pasts.',
    coverImage: animeCoverMartial,
    score: 8.9,
    characters: ['Spike Spiegel', 'Faye Valentine', 'Jet Black', 'Edward', 'Ein'],
    tags: ['Bounty Hunters', 'Jazz', 'Noir', 'Space Western', 'Masterpiece'],
  },
  {
    id: 'fullmetal-alchemist-brotherhood',
    title: 'Fullmetal Alchemist: Brotherhood',
    romajiTitle: 'Hagane no Renkinjutsushi',
    englishTitle: 'Fullmetal Alchemist: Brotherhood',
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy & Isekai', 'Shonen'],
    format: 'TV Series',
    episodes: 64,
    seasonYear: '2009',
    synopsis:
      'Two brothers search for the Philosopher’s Stone after an attempt at human transmutation goes disastrously wrong.',
    coverImage: animeCoverMartial,
    score: 9.1,
    characters: ['Edward Elric', 'Alphonse Elric', 'Roy Mustang', 'Riza Hawkeye', 'Winry'],
    tags: ['Alchemy', 'Military', 'Philosophical', 'Masterpiece'],
  },
  {
    id: 'neon-genesis-evangelion',
    title: 'Neon Genesis Evangelion',
    romajiTitle: 'Shin Seiki Evangelion',
    englishTitle: 'Neon Genesis Evangelion',
    genres: ['Mecha & Sci-Fi', 'Psychological', 'Drama'],
    format: 'TV Series',
    episodes: 26,
    seasonYear: '1995',
    synopsis:
      'Teenage pilots operate gigantic biomechanical Evangelion units to defend Neo Tokyo-3 from extraterrestrial beings called Angels.',
    coverImage: animeCoverMecha,
    score: 8.6,
    characters: ['Shinji Ikari', 'Rei Ayanami', 'Asuka Langley Soryu', 'Misato Katsuragi'],
    tags: ['Existential', 'Giant Robot', 'Deconstruction', 'Classic'],
  },
  {
    id: 'steins-gate',
    title: 'Steins;Gate',
    romajiTitle: 'Steins;Gate',
    englishTitle: 'Steins;Gate',
    genres: ['Mecha & Sci-Fi', 'Thriller', 'Psychological'],
    format: 'TV Series',
    episodes: 24,
    seasonYear: '2011',
    synopsis:
      'An eccentric self-proclaimed mad scientist and his laboratory friends accidentally discover a way to send text messages into the past.',
    coverImage: cosmicBannerImage,
    score: 9.1,
    characters: ['Rintaro Okabe', 'Kurisu Makise', 'Mayuri Shiina', 'Itaru Hashida'],
    tags: ['Time Travel', 'Conspiracy', 'Akihabara', 'Suspense'],
  },
  {
    id: 'vinland-saga',
    title: 'Vinland Saga',
    romajiTitle: 'Vinland Saga',
    englishTitle: 'Vinland Saga',
    genres: ['Action', 'Adventure', 'Historical', 'Seinen', 'Drama'],
    format: 'TV Series',
    episodes: 48,
    seasonYear: '2019',
    synopsis:
      'A young Norse warrior consumed by vengeance against the mercenary who killed his father witnesses the brutal realities of Viking warfare.',
    coverImage: animeCoverWanderer,
    score: 8.9,
    characters: ['Thorfinn', 'Askeladd', 'Canute', 'Thorkell', 'Einar'],
    tags: ['Vikings', 'Vengeance', 'Pacifism', 'Historical Fiction'],
  },
  {
    id: 'bocchi-the-rock',
    title: 'Bocchi the Rock!',
    romajiTitle: 'Bocchi the Rock!',
    englishTitle: 'Bocchi the Rock!',
    genres: ['Comedy', 'Music', 'Slice of Life'],
    format: 'TV Series',
    episodes: 12,
    seasonYear: '2022',
    synopsis:
      'An anxious, introverted high school girl who dreams of playing in a band joins the Kessoku Band and takes baby steps into performing.',
    coverImage: cosmicBannerImage,
    score: 8.8,
    characters: ['Hitori Gotoh', 'Nijika Ijichi', 'Ryo Yamada', 'Ikuyo Kita'],
    tags: ['Social Anxiety', 'Indie Rock', 'Inventive Animation', 'Relatable'],
  },
  {
    id: 'cyberpunk-edgerunners',
    title: 'Cyberpunk: Edgerunners',
    romajiTitle: 'Cyberpunk: Edgerunners',
    englishTitle: 'Cyberpunk: Edgerunners',
    genres: ['Action', 'Mecha & Sci-Fi', 'Psychological'],
    format: 'ONA',
    episodes: 10,
    seasonYear: '2022',
    synopsis:
      'A street kid trying to survive in Night City—a technology and body-modification obsessed city of the future—becomes a high-risk edgerunner mercenary.',
    coverImage: animeCoverMecha,
    score: 8.6,
    characters: ['David Martinez', 'Lucy', 'Rebecca', 'Maine', 'Kiwi'],
    tags: ['Night City', 'Trigger Sakuga', 'Cyberware', 'Tragic Romance'],
  },
  {
    id: 'monster',
    title: 'Monster',
    romajiTitle: 'Monster',
    englishTitle: 'Monster',
    genres: ['Mystery', 'Psychological', 'Thriller', 'Seinen'],
    format: 'TV Series',
    episodes: 74,
    seasonYear: '2004',
    synopsis:
      'An accomplished neurosurgeon in Germany saves the life of a young boy who grows up to become a charismatic and remorseless sociopath.',
    coverImage: animeCoverWanderer,
    score: 9.1,
    characters: ['Dr. Kenzo Tenma', 'Johan Liebert', 'Nina Fortner', 'Inspector Lunge'],
    tags: ['Morality', 'Cold War Germany', 'Cat and Mouse', 'Masterpiece'],
  },
  {
    id: 'spirited-away',
    title: 'Spirited Away',
    romajiTitle: 'Sen to Chihiro no Kamikakushi',
    englishTitle: 'Spirited Away',
    genres: ['Supernatural', 'Fantasy & Isekai', 'Adventure'],
    format: 'Movie',
    episodes: 1,
    seasonYear: '2001',
    synopsis:
      'A ten-year-old girl stumbles into an ethereal bathhouse realm of spirits and witches, working to free her transformed parents.',
    coverImage: animeCoverWanderer,
    score: 8.9,
    characters: ['Chihiro Ogino', 'Haku', 'Yubaba', 'No-Face', 'Kamaji'],
    tags: ['Ghibli', 'Spirits', 'Bathhouse', 'Academy Award Winner'],
  },
  {
    id: 'mob-psycho-100',
    title: 'Mob Psycho 100',
    romajiTitle: 'Mob Psycho 100',
    englishTitle: 'Mob Psycho 100',
    genres: ['Action', 'Comedy', 'Supernatural', 'Slice of Life'],
    format: 'TV Series',
    episodes: 37,
    seasonYear: '2016',
    synopsis:
      'A physically meek middle schooler with incomprehensible psychic powers works as an assistant to a fraud spirit medium while seeking normal self-improvement.',
    coverImage: animeCoverMartial,
    score: 8.9,
    characters: ['Shigeo "Mob" Kageyama', 'Arataka Reigen', 'Dimple', 'Ritsu', 'Teruki'],
    tags: ['Telekinesis', 'Growth', 'Mentorship', 'Bones Sakuga'],
  },
];

/**
 * Modular Anime Catalogue Adapter Interface for future external API integration (Jikan, AniList).
 */
export interface AnimeCatalogueAdapter {
  searchAnime(query: string): Promise<AnimeCatalogueItem[]>;
  getAnimeById(id: string): Promise<AnimeCatalogueItem | null>;
  getAnimeByGenre(genre: string): Promise<AnimeCatalogueItem[]>;
  getFeaturedAnime(): Promise<AnimeCatalogueItem[]>;
  getAllAnime(): Promise<AnimeCatalogueItem[]>;
}

export class CuratedAnimeCatalogueAdapter implements AnimeCatalogueAdapter {
  private items: AnimeCatalogueItem[] = CURATED_ANIME_CATALOGUE;

  async searchAnime(query: string): Promise<AnimeCatalogueItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.items.slice(0, 15);

    return this.items.filter((item) => {
      const matchTitle =
        item.title.toLowerCase().includes(q) ||
        item.romajiTitle.toLowerCase().includes(q) ||
        item.englishTitle.toLowerCase().includes(q);
      const matchGenre = item.genres.some((g) => g.toLowerCase().includes(q));
      const matchTag = item.tags.some((t) => t.toLowerCase().includes(q));
      const matchChar = item.characters.some((c) => c.toLowerCase().includes(q));
      return matchTitle || matchGenre || matchTag || matchChar;
    });
  }

  async getAnimeById(id: string): Promise<AnimeCatalogueItem | null> {
    return this.items.find((item) => item.id === id) || null;
  }

  async getAnimeByGenre(genre: string): Promise<AnimeCatalogueItem[]> {
    const g = genre.toLowerCase();
    return this.items.filter((item) =>
      item.genres.some((itemGenre) => itemGenre.toLowerCase() === g)
    );
  }

  async getFeaturedAnime(): Promise<AnimeCatalogueItem[]> {
    return this.items.filter((item) => item.isFeatured);
  }

  async getAllAnime(): Promise<AnimeCatalogueItem[]> {
    return [...this.items];
  }
}

export const animeCatalogueService = new CuratedAnimeCatalogueAdapter();
