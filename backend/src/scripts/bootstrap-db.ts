import { pool, query } from '../config/db';

type SeedGame = {
  appId: number;
  name: string;
  shortDescription: string;
  genres: string;
  tags: string;
  categories: string;
  headerImage: string;
  price: number;
  positiveVotes: number;
  windows: boolean;
  mac: boolean;
  linux: boolean;
};

const STARTER_GAMES: SeedGame[] = [
  {
    appId: 620,
    name: 'Portal 2',
    shortDescription: 'Puzzle-platform game with portals, co-op chambers, and witty narrative.',
    genres: 'Puzzle,Adventure',
    tags: 'Puzzle,Co-op,Portal,Sci-fi,Story Rich',
    categories: 'Single-player,Co-op,Online Co-op',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/header.jpg',
    price: 9.99,
    positiveVotes: 430000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 400,
    name: 'Portal',
    shortDescription: 'First-person puzzle game built around portals and physics experiments.',
    genres: 'Puzzle,Action',
    tags: 'Puzzle,Portal,Physics,Sci-fi,First-Person',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/400/header.jpg',
    price: 9.99,
    positiveVotes: 190000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 730,
    name: 'Counter-Strike 2',
    shortDescription: 'Competitive tactical shooter with ranked matchmaking and team objectives.',
    genres: 'Action',
    tags: 'FPS,Competitive,Multiplayer,Tactical,Shooter',
    categories: 'Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/header.jpg',
    price: 0,
    positiveVotes: 7800000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 570,
    name: 'Dota 2',
    shortDescription: 'Team-based MOBA with deep strategy, heroes, and esports competition.',
    genres: 'Strategy,Action',
    tags: 'MOBA,Strategy,Multiplayer,Esports,Competitive',
    categories: 'Multi-player,Online PvP,Co-op',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg',
    price: 0,
    positiveVotes: 2100000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 440,
    name: 'Team Fortress 2',
    shortDescription: 'Class-based team shooter with objective modes and stylized characters.',
    genres: 'Action',
    tags: 'FPS,Class-Based,Multiplayer,Shooter,Comedy',
    categories: 'Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/440/header.jpg',
    price: 0,
    positiveVotes: 1200000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 271590,
    name: 'Grand Theft Auto V Legacy',
    shortDescription: 'Open-world crime action game with story campaign and GTA Online.',
    genres: 'Action,Adventure',
    tags: 'Open World,Action,Story Rich,Multiplayer,Crime',
    categories: 'Single-player,Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/header.jpg',
    price: 29.99,
    positiveVotes: 1700000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 1091500,
    name: 'Cyberpunk 2077',
    shortDescription: 'Open-world futuristic RPG set in Night City with story-driven quests.',
    genres: 'RPG,Action',
    tags: 'RPG,Open World,Cyberpunk,Story Rich,Sci-fi',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/header.jpg',
    price: 59.99,
    positiveVotes: 780000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 1174180,
    name: 'Red Dead Redemption 2',
    shortDescription: 'Western open-world adventure with cinematic storytelling and exploration.',
    genres: 'Action,Adventure',
    tags: 'Open World,Western,Story Rich,Adventure,Horses',
    categories: 'Single-player,Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg',
    price: 59.99,
    positiveVotes: 710000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 292030,
    name: 'The Witcher 3: Wild Hunt',
    shortDescription: 'Fantasy RPG with monster hunting, branching quests, and open-world travel.',
    genres: 'RPG',
    tags: 'RPG,Open World,Fantasy,Story Rich,Singleplayer',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/header.jpg',
    price: 39.99,
    positiveVotes: 810000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 1245620,
    name: 'ELDEN RING',
    shortDescription: 'Dark fantasy action RPG with challenging combat and open-world exploration.',
    genres: 'RPG,Action',
    tags: 'Souls-like,Action RPG,Open World,Difficult,Fantasy',
    categories: 'Single-player,Online Co-op,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/header.jpg',
    price: 59.99,
    positiveVotes: 960000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 431960,
    name: 'Wallpaper Engine',
    shortDescription: 'Customizable animated wallpapers and desktop scenes.',
    genres: 'Utility,Simulation',
    tags: 'Utility,Customization,Animation,Desktop,Workshop',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/431960/header.jpg',
    price: 3.99,
    positiveVotes: 760000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 413150,
    name: 'Stardew Valley',
    shortDescription: 'Relaxing farming RPG with crops, crafting, fishing, and relationships.',
    genres: 'Indie,RPG,Simulation',
    tags: 'Farming,Cozy,Pixel Graphics,Crafting,Life Sim',
    categories: 'Single-player,Co-op,Online Co-op',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg',
    price: 14.99,
    positiveVotes: 720000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 108600,
    name: 'Project Zomboid',
    shortDescription: 'Isometric zombie survival sandbox focused on crafting and realism.',
    genres: 'Indie,RPG,Simulation',
    tags: 'Zombies,Survival,Crafting,Open World,Sandbox',
    categories: 'Single-player,Multi-player,Online Co-op',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/108600/header.jpg',
    price: 19.99,
    positiveVotes: 290000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 578080,
    name: 'PUBG: BATTLEGROUNDS',
    shortDescription: 'Battle royale shooter where squads fight to be the last team standing.',
    genres: 'Action,Adventure',
    tags: 'Battle Royale,Shooter,Multiplayer,PvP,Survival',
    categories: 'Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg',
    price: 0,
    positiveVotes: 1600000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 252490,
    name: 'Rust',
    shortDescription: 'Online survival crafting game with base-building and PvP raids.',
    genres: 'Action,Adventure,Indie',
    tags: 'Survival,Crafting,Multiplayer,Open World,Base Building',
    categories: 'Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/252490/header.jpg',
    price: 39.99,
    positiveVotes: 980000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 1145360,
    name: 'Hades',
    shortDescription: 'Fast-paced roguelike dungeon crawler with narrative progression.',
    genres: 'Action,Indie,RPG',
    tags: 'Roguelike,Action,Mythology,Hack and Slash,Story Rich',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1145360/header.jpg',
    price: 24.99,
    positiveVotes: 260000,
    windows: true,
    mac: true,
    linux: false,
  },
  {
    appId: 367520,
    name: 'Hollow Knight',
    shortDescription: 'Hand-drawn metroidvania platformer with exploration and precise combat.',
    genres: 'Action,Adventure,Indie',
    tags: 'Metroidvania,Difficult,Platformer,Indie,Atmospheric',
    categories: 'Single-player',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/367520/header.jpg',
    price: 14.99,
    positiveVotes: 380000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 218620,
    name: 'PAYDAY 2',
    shortDescription: 'Co-op heist shooter with stealth and loud mission approaches.',
    genres: 'Action,RPG',
    tags: 'Heist,Co-op,FPS,Multiplayer,Shooter',
    categories: 'Single-player,Co-op,Online Co-op',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/218620/header.jpg',
    price: 9.99,
    positiveVotes: 560000,
    windows: true,
    mac: false,
    linux: false,
  },
  {
    appId: 594570,
    name: 'Total War: WARHAMMER II',
    shortDescription: 'Grand strategy game mixing turn-based empire play with real-time battles.',
    genres: 'Strategy',
    tags: 'Strategy,Turn-Based,Warhammer,Fantasy,RTS',
    categories: 'Single-player,Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/594570/header.jpg',
    price: 59.99,
    positiveVotes: 140000,
    windows: true,
    mac: true,
    linux: true,
  },
  {
    appId: 236390,
    name: 'War Thunder',
    shortDescription: 'Vehicle combat MMO featuring aircraft, tanks, and naval battles.',
    genres: 'Action,Simulation',
    tags: 'Military,Flight,Simulation,Multiplayer,Tanks',
    categories: 'Multi-player,Online PvP',
    headerImage: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/236390/header.jpg',
    price: 0,
    positiveVotes: 610000,
    windows: true,
    mac: true,
    linux: true,
  },
];

async function ensureSchema(): Promise<void> {
  await query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

  await query(`
    CREATE TABLE IF NOT EXISTS games (
      app_id INTEGER PRIMARY KEY,
      game_name VARCHAR(500) NOT NULL,
      short_description TEXT,
      genres TEXT,
      tags TEXT,
      categories TEXT,
      header_image TEXT,
      price NUMERIC(10,2) DEFAULT 0,
      positive_votes INTEGER DEFAULT 0,
      windows_support BOOLEAN DEFAULT TRUE,
      mac_support BOOLEAN DEFAULT FALSE,
      linux_support BOOLEAN DEFAULT FALSE
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_games_search_vector
    ON games USING GIN (
      (
        setweight(to_tsvector('english', coalesce(game_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(short_description, '')), 'B')
      )
    );
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_games_positive_votes ON games (positive_votes DESC);');
  await query('CREATE INDEX IF NOT EXISTS idx_games_genres_trgm ON games USING GIN (genres gin_trgm_ops);');
  await query('CREATE INDEX IF NOT EXISTS idx_games_tags_trgm ON games USING GIN (tags gin_trgm_ops);');
  await query('CREATE INDEX IF NOT EXISTS idx_games_categories_trgm ON games USING GIN (categories gin_trgm_ops);');
}

async function maybeSeedStarterData(): Promise<void> {
  const countResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM games;');
  const gameCount = Number(countResult.rows[0]?.count ?? '0');

  if (gameCount > 0) {
    console.log(`[bootstrap-db] Existing catalog detected (${gameCount} games). Skipping starter seed.`);
    return;
  }

  for (const game of STARTER_GAMES) {
    await query(
      `
        INSERT INTO games (
          app_id,
          game_name,
          short_description,
          genres,
          tags,
          categories,
          header_image,
          price,
          positive_votes,
          windows_support,
          mac_support,
          linux_support
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `,
      [
        game.appId,
        game.name,
        game.shortDescription,
        game.genres,
        game.tags,
        game.categories,
        game.headerImage,
        game.price,
        game.positiveVotes,
        game.windows,
        game.mac,
        game.linux,
      ]
    );
  }

  console.log(`[bootstrap-db] Seeded starter catalog with ${STARTER_GAMES.length} games.`);
}

async function main(): Promise<void> {
  if (process.env.AUTO_SEED_DB !== 'true') {
    console.log('[bootstrap-db] AUTO_SEED_DB is not enabled. Skipping bootstrap.');
    return;
  }

  try {
    console.log('[bootstrap-db] Ensuring schema and local starter catalog...');
    await ensureSchema();
    await maybeSeedStarterData();
    console.log('[bootstrap-db] Bootstrap complete.');
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error('[bootstrap-db] Failed:', error);
  process.exit(1);
});
