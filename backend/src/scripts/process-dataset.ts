/**
 * Steam Dataset Processor
 * 
 * Processes the Kaggle Steam dataset for the recommendation engine.
 * Creates feature vectors and prepares data for content-based filtering.
 * 
 * Usage: npx ts-node src/scripts/process-dataset.ts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// Paths
const DATA_DIR = path.join(__dirname, '../../data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROCESSED_DIR = path.join(DATA_DIR, 'processed');
const INPUT_FILE = path.join(RAW_DIR, 'games.csv');

// Interfaces
interface RawGame {
  appid: string;
  name: string;
  release_date: string;
  developer: string;
  publisher: string;
  platforms: string;
  categories: string;
  genres: string;
  steamspy_tags: string;
  positive_ratings: string;
  negative_ratings: string;
  average_playtime: string;
  median_playtime: string;
  owners: string;
  price: string;
}

interface ProcessedGame {
  appId: number;
  name: string;
  releaseDate: string;
  developers: string[];
  publishers: string[];
  genres: string[];
  tags: string[];
  steamspyTags: string[];
  positiveRatings: number;
  negativeRatings: number;
  totalRatings: number;
  ratingRatio: number;
  averagePlaytime: number;
  medianPlaytime: number;
  ownersMin: number;
  ownersMax: number;
  price: number;
  isFree: boolean;
  // Combined features for recommendations
  allTags: string[];
  featureVector: string;
}

interface DatasetStats {
  totalGames: number;
  uniqueGenres: string[];
  uniqueTags: string[];
  freeGames: number;
  avgRatingRatio: number;
  topTags: { tag: string; count: number }[];
}

/**
 * Parse semicolon-separated values into array
 */
function parseList(value: string): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(';').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Parse owner range string (e.g., "10000-20000")
 */
function parseOwnerRange(value: string): { min: number; max: number } {
  if (!value) return { min: 0, max: 0 };
  
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
  const parts = cleaned.split('-');
  
  return {
    min: parseInt(parts[0]) || 0,
    max: parseInt(parts[1]) || parseInt(parts[0]) || 0,
  };
}

/**
 * Process a single raw game record
 */
function processGame(raw: RawGame): ProcessedGame | null {
  const appId = parseInt(raw.appid);
  if (isNaN(appId) || !raw.name) return null;
  
  const genres = parseList(raw.genres);
  const categories = parseList(raw.categories);
  const steamspyTags = parseList(raw.steamspy_tags);
  
  const positiveRatings = parseInt(raw.positive_ratings) || 0;
  const negativeRatings = parseInt(raw.negative_ratings) || 0;
  const totalRatings = positiveRatings + negativeRatings;
  
  const owners = parseOwnerRange(raw.owners);
  const price = parseFloat(raw.price) || 0;
  
  // Combine all tags for recommendations (deduplicated)
  const allTagsSet = new Set<string>();
  genres.forEach(g => allTagsSet.add(g.toLowerCase()));
  categories.forEach(c => allTagsSet.add(c.toLowerCase()));
  steamspyTags.forEach(t => allTagsSet.add(t.toLowerCase()));
  const allTags = Array.from(allTagsSet);
  
  return {
    appId,
    name: raw.name,
    releaseDate: raw.release_date || '',
    developers: parseList(raw.developer),
    publishers: parseList(raw.publisher),
    genres,
    tags: categories,
    steamspyTags,
    positiveRatings,
    negativeRatings,
    totalRatings,
    ratingRatio: totalRatings > 0 ? positiveRatings / totalRatings : 0,
    averagePlaytime: parseInt(raw.average_playtime) || 0,
    medianPlaytime: parseInt(raw.median_playtime) || 0,
    ownersMin: owners.min,
    ownersMax: owners.max,
    price,
    isFree: price === 0,
    allTags,
    featureVector: allTags.join(' '),
  };
}

/**
 * Calculate dataset statistics
 */
function calculateStats(games: ProcessedGame[]): DatasetStats {
  const genreSet = new Set<string>();
  const tagCounts = new Map<string, number>();
  let freeCount = 0;
  let totalRatingRatio = 0;
  let ratedGames = 0;
  
  for (const game of games) {
    game.genres.forEach(g => genreSet.add(g));
    
    game.allTags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
    
    if (game.isFree) freeCount++;
    
    if (game.totalRatings > 0) {
      totalRatingRatio += game.ratingRatio;
      ratedGames++;
    }
  }
  
  // Sort tags by count
  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
  
  return {
    totalGames: games.length,
    uniqueGenres: Array.from(genreSet).sort(),
    uniqueTags: Array.from(tagCounts.keys()).sort(),
    freeGames: freeCount,
    avgRatingRatio: ratedGames > 0 ? totalRatingRatio / ratedGames : 0,
    topTags,
  };
}

/**
 * Save processed data to files
 */
function saveProcessedData(games: ProcessedGame[], stats: DatasetStats): void {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  
  // Save full processed games
  const gamesPath = path.join(PROCESSED_DIR, 'games.json');
  fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2));
  console.log(`✓ Saved ${games.length} games to: ${gamesPath}`);
  
  // Save lightweight version (for quick loading)
  const lightGames = games.map(g => ({
    appId: g.appId,
    name: g.name,
    allTags: g.allTags,
    ratingRatio: g.ratingRatio,
    ownersMin: g.ownersMin,
  }));
  const lightPath = path.join(PROCESSED_DIR, 'games-light.json');
  fs.writeFileSync(lightPath, JSON.stringify(lightGames, null, 2));
  console.log(`✓ Saved lightweight data to: ${lightPath}`);
  
  // Save statistics
  const statsPath = path.join(PROCESSED_DIR, 'stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`✓ Saved statistics to: ${statsPath}`);
  
  // Save tag vocabulary (for feature engineering)
  const vocabPath = path.join(PROCESSED_DIR, 'tag-vocabulary.json');
  fs.writeFileSync(vocabPath, JSON.stringify(stats.topTags, null, 2));
  console.log(`✓ Saved tag vocabulary to: ${vocabPath}`);
  
  // Save app ID to name mapping
  const idMap = Object.fromEntries(games.map(g => [g.appId, g.name]));
  const idMapPath = path.join(PROCESSED_DIR, 'app-id-map.json');
  fs.writeFileSync(idMapPath, JSON.stringify(idMap, null, 2));
  console.log(`✓ Saved ID mapping to: ${idMapPath}`);
}

/**
 * Print summary statistics
 */
function printSummary(stats: DatasetStats): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    DATASET STATISTICS                          ║
╠════════════════════════════════════════════════════════════════╣
║  Total Games:        ${stats.totalGames.toLocaleString().padEnd(10)}                          ║
║  Free Games:         ${stats.freeGames.toLocaleString().padEnd(10)} (${((stats.freeGames / stats.totalGames) * 100).toFixed(1)}%)                  ║
║  Unique Genres:      ${stats.uniqueGenres.length.toString().padEnd(10)}                          ║
║  Unique Tags:        ${stats.uniqueTags.length.toString().padEnd(10)}                          ║
║  Avg Rating:         ${(stats.avgRatingRatio * 100).toFixed(1)}%                                ║
╚════════════════════════════════════════════════════════════════╝

Top 10 Tags:
${stats.topTags.slice(0, 10).map((t, i) => `  ${i + 1}. ${t.tag} (${t.count.toLocaleString()} games)`).join('\n')}
  `);
}

/**
 * Main processing function
 */
async function main(): Promise<void> {
  console.log('Steam Dataset Processor\n');
  console.log('========================\n');
  
  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.log('\nRun the download script first:');
    console.log('  npx ts-node src/scripts/download-dataset.ts');
    process.exit(1);
  }
  
  // Read and parse CSV
  console.log(`Reading: ${INPUT_FILE}`);
  const csvContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  
  console.log('Parsing CSV...');
  const rawRecords: RawGame[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  
  console.log(`Found ${rawRecords.length} raw records`);
  
  // Process games
  console.log('Processing games...');
  const games: ProcessedGame[] = [];
  let skipped = 0;
  
  for (const raw of rawRecords) {
    const processed = processGame(raw);
    if (processed) {
      games.push(processed);
    } else {
      skipped++;
    }
  }
  
  console.log(`Processed ${games.length} games (skipped ${skipped} invalid)`);
  
  // Calculate statistics
  console.log('Calculating statistics...');
  const stats = calculateStats(games);
  
  // Save processed data
  console.log('\nSaving processed data...');
  saveProcessedData(games, stats);
  
  // Print summary
  printSummary(stats);
  
  console.log('\n✓ Processing complete!');
  console.log('\nNext step: Build the recommendation engine');
  console.log('  npx ts-node src/scripts/build-recommender.ts');
}

main().catch((err) => {
  console.error('Error processing dataset:', err);
  process.exit(1);
});
