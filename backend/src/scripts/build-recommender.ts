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

const PROCESSED_DIR = path.join(__dirname, '../../data/processed');
const GAMES_FILE = path.join(PROCESSED_DIR, 'games-light.json');
const OUTPUT_DIR = path.join(PROCESSED_DIR, 'recommender');

interface LightGame {
  appId: number;
  name: string;
  allTags: string[];
  ratingRatio: number;
  ownersMin: number;
}

interface TfIdfVector {
  [term: string]: number;
}

interface GameVector {
  appId: number;
  name: string;
  vector: TfIdfVector;
  magnitude: number;
}

interface SimilarGame {
  appId: number;
  name: string;
  similarity: number;
}

/**
 * Calculate term frequency for a document (game's tags)
 */
function calculateTF(tags: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const total = tags.length;
  
  for (const tag of tags) {
    tf.set(tag, (tf.get(tag) || 0) + 1);
  }
  
  // Normalize by total terms
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }
  
  return tf;
}

/**
 * Calculate inverse document frequency for all terms
 */
function calculateIDF(games: LightGame[]): Map<string, number> {
  const docCount = new Map<string, number>();
  const totalDocs = games.length;
  
  // Count documents containing each term
  for (const game of games) {
    const uniqueTags = new Set(game.allTags);
    for (const tag of uniqueTags) {
      docCount.set(tag, (docCount.get(tag) || 0) + 1);
    }
  }
  
  // Calculate IDF: log(N / df)
  const idf = new Map<string, number>();
  for (const [term, df] of docCount) {
    idf.set(term, Math.log(totalDocs / df));
  }
  
  return idf;
}

/**
 * Calculate TF-IDF vector for a game
 */
function calculateTfIdf(tags: string[], idf: Map<string, number>): TfIdfVector {
  const tf = calculateTF(tags);
  const tfidf: TfIdfVector = {};
  
  for (const [term, tfValue] of tf) {
    const idfValue = idf.get(term) || 0;
    tfidf[term] = tfValue * idfValue;
  }
  
  return tfidf;
}

/**
 * Calculate vector magnitude (for cosine similarity)
 */
function calculateMagnitude(vector: TfIdfVector): number {
  let sum = 0;
  for (const value of Object.values(vector)) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(v1: TfIdfVector, m1: number, v2: TfIdfVector, m2: number): number {
  if (m1 === 0 || m2 === 0) return 0;
  
  let dotProduct = 0;
  
  // Only iterate over terms that exist in v1
  for (const term in v1) {
    if (term in v2) {
      dotProduct += v1[term] * v2[term];
    }
  }
  
  return dotProduct / (m1 * m2);
}

/**
 * Build game vectors using TF-IDF
 */
function buildGameVectors(games: LightGame[], idf: Map<string, number>): GameVector[] {
  console.log('Building TF-IDF vectors...');
  
  const vectors: GameVector[] = [];
  
  for (const game of games) {
    if (game.allTags.length === 0) continue;
    
    const vector = calculateTfIdf(game.allTags, idf);
    const magnitude = calculateMagnitude(vector);
    
    vectors.push({
      appId: game.appId,
      name: game.name,
      vector,
      magnitude,
    });
  }
  
  return vectors;
}

/**
 * Find similar games for a given game
 */
function findSimilarGames(
  targetId: number,
  vectors: GameVector[],
  topK: number = 20
): SimilarGame[] {
  const target = vectors.find(v => v.appId === targetId);
  if (!target) return [];
  
  const similarities: SimilarGame[] = [];
  
  for (const other of vectors) {
    if (other.appId === targetId) continue;
    
    const similarity = cosineSimilarity(
      target.vector, target.magnitude,
      other.vector, other.magnitude
    );
    
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
  vectors: GameVector[],
  topK: number = 20
): Map<number, SimilarGame[]> {
  console.log(`Building similarity index for ${vectors.length} games...`);
  console.log('This may take a few minutes...\n');
  
  const index = new Map<number, SimilarGame[]>();
  const startTime = Date.now();
  
  for (let i = 0; i < vectors.length; i++) {
    const game = vectors[i];
    const similar = findSimilarGames(game.appId, vectors, topK);
    index.set(game.appId, similar);
    
    // Progress update every 1000 games
    if ((i + 1) % 1000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (vectors.length - i - 1) / rate;
      console.log(`  Processed ${i + 1}/${vectors.length} (${remaining.toFixed(0)}s remaining)`);
    }
  }
  
  return index;
}

/**
 * Save the recommender data
 */
function saveRecommenderData(
  vectors: GameVector[],
  index: Map<number, SimilarGame[]>,
  idf: Map<string, number>
): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  // Save IDF values (needed for new game lookups)
  const idfPath = path.join(OUTPUT_DIR, 'idf.json');
  fs.writeFileSync(idfPath, JSON.stringify(Object.fromEntries(idf), null, 2));
  console.log(`✓ Saved IDF values to: ${idfPath}`);
  
  // Save similarity index
  const indexPath = path.join(OUTPUT_DIR, 'similarity-index.json');
  const indexObj = Object.fromEntries(index);
  fs.writeFileSync(indexPath, JSON.stringify(indexObj, null, 2));
  console.log(`✓ Saved similarity index to: ${indexPath}`);
  
  // Save compact vectors (for runtime recommendations)
  const compactVectors = vectors.map(v => ({
    appId: v.appId,
    name: v.name,
    magnitude: v.magnitude,
    // Only keep top terms to reduce file size
    topTerms: Object.entries(v.vector)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([term, weight]) => ({ term, weight })),
  }));
  
  const vectorsPath = path.join(OUTPUT_DIR, 'vectors.json');
  fs.writeFileSync(vectorsPath, JSON.stringify(compactVectors, null, 2));
  console.log(`✓ Saved vectors to: ${vectorsPath}`);
}

/**
 * Demo: Show recommendations for popular games
 */
function demoRecommendations(
  vectors: GameVector[],
  index: Map<number, SimilarGame[]>
): void {
  // Popular game IDs
  const demoGames = [
    { id: 730, name: 'Counter-Strike 2' },
    { id: 570, name: 'Dota 2' },
    { id: 440, name: 'Team Fortress 2' },
    { id: 292030, name: 'The Witcher 3' },
  ];
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              SAMPLE RECOMMENDATIONS                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  for (const demo of demoGames) {
    const similar = index.get(demo.id);
    if (!similar || similar.length === 0) {
      // Try to find the game by partial name match
      const found = vectors.find(v => v.name.toLowerCase().includes(demo.name.toLowerCase()));
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
  
  // Load processed games
  if (!fs.existsSync(GAMES_FILE)) {
    console.error(`❌ Processed data not found: ${GAMES_FILE}`);
    console.log('\nRun the processor first:');
    console.log('  npx ts-node src/scripts/process-dataset.ts');
    process.exit(1);
  }
  
  console.log(`Loading games from: ${GAMES_FILE}`);
  const games: LightGame[] = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf-8'));
  console.log(`Loaded ${games.length} games\n`);
  
  // Filter games with tags
  const gamesWithTags = games.filter(g => g.allTags.length > 0);
  console.log(`Games with tags: ${gamesWithTags.length}\n`);
  
  // Calculate IDF
  console.log('Calculating IDF values...');
  const idf = calculateIDF(gamesWithTags);
  console.log(`Vocabulary size: ${idf.size} terms\n`);
  
  // Build TF-IDF vectors
  const vectors = buildGameVectors(gamesWithTags, idf);
  console.log(`Built vectors for ${vectors.length} games\n`);
  
  // Build similarity index
  const index = buildSimilarityIndex(vectors, 20);
  
  // Save data
  console.log('\nSaving recommender data...');
  saveRecommenderData(vectors, index, idf);
  
  // Show demo recommendations
  demoRecommendations(vectors, index);
  
  console.log('\n✓ Recommendation engine built successfully!');
  console.log('\nThe recommendation data is ready to be used by the API.');
}

main().catch((err) => {
  console.error('Error building recommender:', err);
  process.exit(1);
});
