import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const packagePath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
const appVersion = packageJson.version;
const args = new Set(process.argv.slice(2));

if (!appVersion || typeof appVersion !== 'string') {
  throw new Error('package.json version is missing or invalid.');
}

const writeVersionModule = async (targetDir) => {
  const targetPath = path.join(projectRoot, targetDir, 'version.js');
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(
    targetPath,
    `// Generated from package.json by scripts/write-version.mjs.\nexport const APP_VERSION = '${appVersion}';\n`,
    'utf8'
  );
  console.log(`Wrote ${targetDir}/version.js for Airship One v${appVersion}`);
};

const writePublic = args.size === 0 || args.has('--public');
const writeDist = args.has('--dist');

if (!writePublic && !writeDist) {
  throw new Error('No valid targets provided. Use --public and/or --dist.');
}

if (writePublic) {
  await writeVersionModule('public');
}

if (writeDist) {
  await writeVersionModule('dist');
}

