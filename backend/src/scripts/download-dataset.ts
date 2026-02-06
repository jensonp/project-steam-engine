/**
 * Dataset Download Helper
 * 
 * This script provides instructions for downloading the Steam dataset.
 * Due to Kaggle's authentication requirements, automatic download requires setup.
 * 
 * Usage: npx ts-node src/scripts/download-dataset.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const DATA_DIR = path.join(__dirname, '../../data/raw');
const STEAM_CSV = path.join(DATA_DIR, 'steam.csv');

// Alternative: Direct download from a mirror (if available)
const BACKUP_URL = 'https://raw.githubusercontent.com/datasets/steam-250/main/data/steam.csv';

async function checkExistingData(): Promise<boolean> {
  if (fs.existsSync(STEAM_CSV)) {
    const stats = fs.statSync(STEAM_CSV);
    const sizeMB = stats.size / (1024 * 1024);
    console.log(`✓ Dataset already exists: ${STEAM_CSV}`);
    console.log(`  Size: ${sizeMB.toFixed(2)} MB`);
    return true;
  }
  return false;
}

function printManualInstructions(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           STEAM DATASET DOWNLOAD INSTRUCTIONS                  ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Option 1: Manual Download (Recommended)                       ║
║  ────────────────────────────────────────                      ║
║  1. Go to: https://www.kaggle.com/datasets/nikdavis/steam-store-games
║  2. Click "Download" (requires free Kaggle account)            ║
║  3. Extract the ZIP file                                       ║
║  4. Copy 'steam.csv' to:                                       ║
║     ${DATA_DIR}/steam.csv
║                                                                ║
║  Option 2: Kaggle CLI                                          ║
║  ────────────────────────────────────────                      ║
║  1. Install: pip install kaggle                                ║
║  2. Setup API key: https://www.kaggle.com/docs/api             ║
║  3. Run:                                                       ║
║     kaggle datasets download nikdavis/steam-store-games        ║
║     unzip steam-store-games.zip -d ${DATA_DIR}
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
  `);
}

async function downloadFromUrl(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`Attempting download from: ${url}`);
    
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(dest);
          downloadFromUrl(redirectUrl, dest).then(resolve);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        console.log(`Download failed: HTTP ${response.statusCode}`);
        file.close();
        fs.unlinkSync(dest);
        resolve(false);
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded to: ${dest}`);
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      console.log(`Download error: ${err.message}`);
      resolve(false);
    });
  });
}

async function main(): Promise<void> {
  console.log('Steam Dataset Downloader\n');
  
  // Ensure data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });
  
  // Check if data already exists
  if (await checkExistingData()) {
    console.log('\nDataset is ready! Run the processor next:');
    console.log('  npx ts-node src/scripts/process-dataset.ts');
    return;
  }
  
  console.log('Dataset not found. Checking alternative sources...\n');
  
  // Try backup URL (usually won't work for Kaggle data due to size)
  // const downloaded = await downloadFromUrl(BACKUP_URL, STEAM_CSV);
  
  // For now, just print manual instructions
  printManualInstructions();
}

main().catch(console.error);
