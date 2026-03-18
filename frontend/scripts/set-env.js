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
const apiUrlPattern = /apiUrl:\s*'[^']*'/;
if (!apiUrlPattern.test(content)) {
  throw new Error('Failed to locate environment.prod.ts apiUrl field.');
}

const updatedContent = content.replace(apiUrlPattern, `apiUrl: '${backendUrl}'`);

if (updatedContent !== content) {
  fs.writeFileSync(envPath, updatedContent);
  console.log(`Updated environment.prod.ts with BACKEND_URL: ${backendUrl}`);
} else {
  console.log(`environment.prod.ts already uses BACKEND_URL: ${backendUrl}`);
}
