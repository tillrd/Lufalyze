 #!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

// Generate build info
const buildInfo = {
  VITE_VERSION: packageJson.version,
  VITE_BUILD_HASH: (() => {
    try {
      return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'dev';
    }
  })(),
  VITE_BUILD_DATE: new Date().toISOString(),
  VITE_BUILD_NUMBER: process.env.CI ? process.env.GITHUB_RUN_NUMBER : Math.floor(Date.now() / 1000)
};

// Write .env.local for development
const envContent = Object.entries(buildInfo)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');

fs.writeFileSync(path.join(__dirname, '..', '.env.local'), envContent);

console.log('🔧 Build information generated:');
Object.entries(buildInfo).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('📝 Written to .env.local for development'); 