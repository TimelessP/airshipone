import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const publicDir = path.join(projectRoot, 'public');

const args = new Set(process.argv.slice(2));
const prepareOnly = args.has('--prepare-only');

const packagePath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
const appVersion = packageJson.version;

if (!appVersion || typeof appVersion !== 'string') {
  throw new Error('package.json version is missing or invalid.');
}

const templatePath = path.join(projectRoot, 'scripts', 'sw.template.js');
const template = await fs.readFile(templatePath, 'utf8');

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const PRECACHE_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.json', '.webmanifest', '.png', '.svg', '.ico', '.woff2'
]);

async function collectPrecache(baseDir) {
  const result = new Set();

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(currentDir, entry.name);
      const rel = path.relative(baseDir, abs).split(path.sep).join('/');
      if (entry.isDirectory()) {
        await walk(abs);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (PRECACHE_EXTENSIONS.has(ext)) {
          result.add(`./${rel}`);
        }
      }
    }
  }

  await walk(baseDir);
  return Array.from(result).sort();
}

const defaultPrecache = ['./', './index.html', './manifest.webmanifest', './version.js'];

const writeSw = async (targetDir, precacheList) => {
  const swContent = template
    .replaceAll('__APP_VERSION__', appVersion)
    .replace('__PRECACHE_LIST__', JSON.stringify(precacheList, null, 2));
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, 'sw.js'), swContent, 'utf8');
};

await fs.mkdir(publicDir, { recursive: true });

if (prepareOnly || !(await exists(distDir))) {
  await writeSw(publicDir, defaultPrecache);
  console.log(`Prepared public/sw.js for Airship One v${appVersion}`);
  process.exit(0);
}

const distPrecache = await collectPrecache(distDir);
if (!distPrecache.includes('./index.html')) {
  distPrecache.push('./index.html');
}
if (!distPrecache.includes('./manifest.webmanifest')) {
  distPrecache.push('./manifest.webmanifest');
}
if (!distPrecache.includes('./version.js')) {
  distPrecache.push('./version.js');
}

await writeSw(distDir, Array.from(new Set(distPrecache)).sort());
console.log(`Built dist/sw.js for Airship One v${appVersion} with ${distPrecache.length} precache entries`);
