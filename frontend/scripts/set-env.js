const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const content = fs.readFileSync(envPath, 'utf8');

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
const updatedContent = content.replace('BACKEND_URL_PLACEHOLDER', backendUrl);

fs.writeFileSync(envPath, updatedContent);
console.log(`Updated environment.prod.ts with BACKEND_URL: ${backendUrl}`);
