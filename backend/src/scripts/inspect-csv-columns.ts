import * as fs from 'fs';

const path = process.env.GAMES_CSV ?? 'data/raw/games.csv';
const first = fs.readFileSync(path, 'utf-8').split('\n')[0];
const cols = first.split(',').map((c, i) => `${i + 1}. ${c.trim()}`);
console.log('Columns in CSV:\n' + cols.join('\n'));
