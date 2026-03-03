/**
 * Recommendation Engine Builder
 * 
 * Builds a content-based recommendation system using TF-IDF and cosine similarity.
 * This creates the similarity matrix and saves it for quick lookups.
 * 
 * Usage: npx ts-node src/scripts/build-recommender.ts
 */

import fs from 'fs';
import path from 'path';
import { query } from '../config/db';

const PROCESSED_DIR = path.join(__dirname, '../../data/processed');
const OUTPUT_DIR = path.join(PROCESSED_DIR, 'recommender');

interface LightGame {
  appId: number;
  name: string;
  allTags: string[];
  genres: string[];
  tags: string[];
  categories: string[];
  developers: string[];
  publishers: string[];
  price: number;
  positiveRatings: number;
  negativeRatings: number;
  ratingRatio: number;
  averagePlaytime: number;
  ownersMin: number;
  
  // Precomputed memory sets for O(1) mathematical intersection speeds
  genresSet: Set<string>;
  tagsSet: Set<string>;
  categoriesSet: Set<string>;
  studiosSet: Set<string>;
}

interface SimilarGame {
  appId: number;
  name: string;
  similarity: number;
}

// Global normalization maxes
interface GlobalMaxes {
  price: number;
  popularity: number;
  playtime: number;
}

const SCORE_WEIGHTS = {
  genres:       0.25,
  tags:         0.25,
  categories:   0.10,
  price:        0.10,
  review_ratio: 0.10,
  popularity:   0.05,
  developer:    0.04,
  playtime:     0.03,
};

async function fetchGamesFromDB(): Promise<LightGame[]> {
  console.log('Fetching all games from PostgreSQL database...');
  const result = await query('SELECT * FROM games');
  
  return result.rows.map(r => {
    const genres = (r.genres || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const tags = (r.tags || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const categories = (r.categories || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    
    // allTags is the union
    const allTags = Array.from(new Set([...genres, ...tags, ...categories]));

    const developers = (r.developers || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const publishers = (r.publishers || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const price = r.price ? parseFloat(r.price) : 0;
    const positiveRatings = r.positive_votes || 0;
    const negativeRatings = r.negative_votes || 0;
    const totalRatings = positiveRatings + negativeRatings;
    const ratingRatio = totalRatings > 0 ? positiveRatings / totalRatings : 0;
    
    const averagePlaytime = r.average_playtime || 0;

    let ownersMin = 0;
    if (r.estimated_owners) {
       const parts = r.estimated_owners.replace(/,/g, '').replace(/\s/g, '').split('-');
       ownersMin = parseInt(parts[0]) || 0;
    }

    // Precompile Sets exactly once to prevent 39 Billion dynamic array instantiations
    const genresSet = new Set<string>(genres.map((s: string) => s.toLowerCase()));
    const tagsSet = new Set<string>(tags.map((s: string) => s.toLowerCase()));
    const categoriesSet = new Set<string>(categories.map((s: string) => s.toLowerCase()));
    const studiosSet = new Set<string>([...developers, ...publishers].map((s: string) => s.toLowerCase()));

    return {
      appId: r.app_id,
      name: r.game_name,
      allTags,
      genres,
      tags,
      categories,
      developers,
      publishers,
      price,
      positiveRatings,
      negativeRatings,
      ratingRatio,
      averagePlaytime,
      ownersMin,
      genresSet,
      tagsSet,
      categoriesSet,
      studiosSet
    };
  });
}

function computeGlobalMaxes(games: LightGame[]): GlobalMaxes {
  let maxPrice = 60;
  let maxPop = 1;
  let maxPt = 1;

  for (const g of games) {
    const pop = (g.positiveRatings || 0) + (g.negativeRatings || 0) + (g.ownersMin || 0);
    if ((g.price || 0) > maxPrice) maxPrice = g.price;
    if (pop > maxPop) maxPop = pop;
    if ((g.averagePlaytime || 0) > maxPt) maxPt = g.averagePlaytime;
  }
  return { price: maxPrice, popularity: maxPop, playtime: maxPt };
}

function getJaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0.0;
  
  let intersect = 0;
  // Iterate the smaller set to find intersections fast
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  
  for (const item of smaller) {
    if (larger.has(item)) intersect++;
  }
  
  const union = setA.size + setB.size - intersect;
  return intersect / union;
}

function getStudioOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0.0;
  
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) return 1.0;
  }
  return 0.0;
}

function calculateScore(target: LightGame, candidate: LightGame, allMax: GlobalMaxes): number {
  let finalScore = 0;

  // 1. Ultra-fast Jaccard Indexing using precomputed HashSets
  finalScore += SCORE_WEIGHTS.genres * getJaccard(target.genresSet, candidate.genresSet);
  finalScore += SCORE_WEIGHTS.tags * getJaccard(target.tagsSet, candidate.tagsSet);
  finalScore += SCORE_WEIGHTS.categories * getJaccard(target.categoriesSet, candidate.categoriesSet);

  // 2. Studio Overlap
  finalScore += SCORE_WEIGHTS.developer * getStudioOverlap(target.studiosSet, candidate.studiosSet);

  // 3. Price Proximity
  const candPrice = candidate.price || 0;
  const prefPrice = target.price || 0;
  const priceScore = 1.0 - Math.min(Math.abs(candPrice - prefPrice) / allMax.price, 1.0);
  finalScore += SCORE_WEIGHTS.price * priceScore;

  // 4. Review Ratio
  finalScore += SCORE_WEIGHTS.review_ratio * (candidate.ratingRatio || 0);

  // 5. Popularity
  const popRaw = (candidate.positiveRatings || 0) + (candidate.negativeRatings || 0) + (candidate.ownersMin || 0);
  const popScore = Math.log1p(popRaw) / Math.log1p(allMax.popularity);
  finalScore += SCORE_WEIGHTS.popularity * (allMax.popularity > 0 ? popScore : 0);

  // 6. Playtime
  const ptScore = Math.log1p(candidate.averagePlaytime || 0) / Math.log1p(allMax.playtime);
  finalScore += SCORE_WEIGHTS.playtime * (allMax.playtime > 0 ? ptScore : 0);

  return finalScore;
}

/**
 * Find similar games for a given game
 */
function findSimilarGames(
  targetId: number,
  games: LightGame[],
  allMax: GlobalMaxes,
  topK: number = 20
): SimilarGame[] {
  const target = games.find(g => g.appId === targetId);
  if (!target) return [];
  
  const similarities: SimilarGame[] = [];
  
  for (const other of games) {
    if (other.appId === targetId) continue;
    
    // Use the 9-factor Python logic!
    const similarity = calculateScore(target, other, allMax);
    
    if (similarity > 0.1) { // Only include if somewhat similar
      similarities.push({
        appId: other.appId,
        name: other.name,
        similarity,
      });
    }
  }
  
  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  return similarities.slice(0, topK);
}

/**
 * Build and save the similarity index
 */
function buildSimilarityIndex(
  games: LightGame[],
  topK: number = 20
): Map<number, SimilarGame[]> {
  console.log(`Building similarity index for ${games.length} games...`);
  console.log('This may take a few minutes...\n');
  
  const index = new Map<number, SimilarGame[]>();
  const startTime = Date.now();
  const allMax = computeGlobalMaxes(games);
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const similar = findSimilarGames(game.appId, games, allMax, topK);
    index.set(game.appId, similar);
    
    // Progress update every 1000 games
    if ((i + 1) % 1000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (games.length - i - 1) / rate;
      console.log(`  Processed ${i + 1}/${games.length} (${remaining.toFixed(0)}s remaining)`);
    }
  }
  
  return index;
}

/**
 * Save the recommender data
 */
function saveRecommenderData(
  index: Map<number, SimilarGame[]>
): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Save similarity index
  const indexPath = path.join(OUTPUT_DIR, 'similarity-index.json');
  const indexObj = Object.fromEntries(index);
  fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2));
  console.log(`✓ Saved multi-factor similarity index to: ${indexPath}`);
}

/**
 * Demo: Show recommendations for popular games
 */
function demoRecommendations(
  games: LightGame[],
  index: Map<number, SimilarGame[]>
): void {
  // Popular game IDs
  const demoIds = [
    { id: 730, name: 'Counter-Strike 2' },
    { id: 570, name: 'Dota 2' },
    { id: 440, name: 'Team Fortress 2' },
    { id: 292030, name: 'The Witcher 3' },
  ];
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              SAMPLE RECOMMENDATIONS                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  for (const demo of demoIds) {
    const similar = index.get(demo.id);
    if (!similar || similar.length === 0) {
      // Try to find the game by partial name match
      const found = games.find(g => g.name.toLowerCase().includes(demo.name.toLowerCase()));
      if (found) {
        const foundSimilar = index.get(found.appId);
        if (foundSimilar) {
          console.log(`If you like "${found.name}", try:`);
          foundSimilar.slice(0, 5).forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.name} (${(s.similarity * 100).toFixed(1)}% similar)`);
          });
          console.log();
        }
      }
      continue;
    }
    
    console.log(`If you like "${demo.name}", try:`);
    similar.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${(s.similarity * 100).toFixed(1)}% similar)`);
    });
    console.log();
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('Recommendation Engine Builder\n');
  console.log('==============================\n');
  
  const games = await fetchGamesFromDB();
  console.log(`Loaded ${games.length} games\n`);
  
  // Filter games down to valid ones
  const validGames = games.filter(g => g.allTags && g.allTags.length > 0);
  console.log(`Games with metadata: ${validGames.length}\n`);
  
  // Build similarity index using Jaccard and multi-factor
  console.log('Building Jaccard/Proximity Matrix...');
  const index = buildSimilarityIndex(validGames, 20);
  
  // Save data
  console.log('\nSaving recommender data...');
  saveRecommenderData(index);
  
  // Show demo recommendations
  demoRecommendations(validGames, index);
  
  console.log('\n✓ Recommendation engine built successfully!');
  console.log('\nThe recommendation data is ready to be used by the API.');
}

main().catch((err) => {
  console.error('Error building recommender:', err);
  process.exit(1);
});
