import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../', import.meta.url));
const archive = resolve(process.argv[2] ?? resolve(app, 'dist/site.zip'));
const releaseFiles = ['ads.txt', 'app-ads.txt', '.well-known/assetlinks.json'];
const { build: { base: { env: base } } } = JSON.parse(readFileSync(resolve(app, 'eas.json'), 'utf8'));
const sharedKeys = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_WEB_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
];
const env = { ...process.env, EXPO_NO_DOTENV: '1' };
const work = mkdtempSync(resolve(tmpdir(), 'paisa-web-'));
const output = resolve(work, 'web');

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`);
}

try {
  for (const name of sharedKeys) {
    if (!base[name]) throw new Error(`Missing ${name} in the EAS base profile`);
    env[name] = base[name];
  }
  run(process.execPath, ['node_modules/expo/bin/cli', 'export', '--platform', 'web', '--output-dir', output], app);
  if (!statSync(resolve(output, 'index.html')).size) throw new Error('Empty web entry point');
  for (const file of releaseFiles) {
    if (!readFileSync(resolve(output, file)).equals(readFileSync(resolve(app, 'public', file)))) {
      throw new Error(`Exported ${file} does not match the public file`);
    }
  }
  copyFileSync(resolve(app, '../../docs/hostinger.htaccess'), resolve(output, '.htaccess'));
  mkdirSync(dirname(archive), { recursive: true });
  const staging = mkdtempSync(resolve(dirname(archive), '.paisa-web-'));
  try {
    const zip = resolve(staging, 'site.zip');
    run('zip', ['-qr', zip, '.'], output);
    renameSync(zip, archive);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  console.log(`Hostinger release archive: ${archive}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
