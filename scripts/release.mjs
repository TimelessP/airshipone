import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const appVersion = packageJson.version;

if (!appVersion || typeof appVersion !== 'string') {
  throw new Error('package.json version is missing or invalid.');
}

const run = (command) => {
  execSync(command, { stdio: 'inherit' });
};

console.log(`Releasing Airship One v${appVersion}`);

if (existsSync(path.join(projectRoot, 'package-lock.json'))) {
  run('npm ci');
} else {
  run('npm install');
}

run('npm run build');

const artifactDir = existsSync(path.join(projectRoot, 'dist')) ? 'dist' : 'public';
console.log(`Release assets prepared in ${artifactDir}/`);
console.log(`- Version source of truth: package.json (${appVersion})`);
console.log(`- Runtime version module: ${artifactDir}/version.js`);
console.log(`- Service worker: ${artifactDir}/sw.js`);
