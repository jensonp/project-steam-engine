const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const content = fs.readFileSync(envPath, 'utf8');

const normalizeBackendUrl = (input) => {
  const raw = (input || '').trim();
  if (!raw) return 'http://localhost:3000';

  const hasHttpProtocol = /^https?:\/\//i.test(raw);
  const protocolRelative = /^\/\//.test(raw);
  let normalized = raw;

  if (!hasHttpProtocol && !protocolRelative && !raw.startsWith('/')) {
    normalized = `https://${raw}`;
  } else if (protocolRelative) {
    normalized = `https:${raw}`;
  }

  return normalized.replace(/\/+$/, '');
};

const backendUrl = normalizeBackendUrl(process.env.BACKEND_URL);
const updatedContent = content.replace(/apiUrl:\s*'[^']*'/, `apiUrl: '${backendUrl}'`);

if (updatedContent === content) {
  throw new Error('Failed to update environment.prod.ts apiUrl value.');
}

fs.writeFileSync(envPath, updatedContent);
console.log(`Updated environment.prod.ts with BACKEND_URL: ${backendUrl}`);
