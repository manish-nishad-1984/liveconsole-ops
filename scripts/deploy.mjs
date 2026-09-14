/**
 * Deploy to the Windows/IIS host over FTP.
 *
 *   npm run deploy                 build → migrate + seed → sync → health check
 *   npm run deploy -- --skip-build reuse the existing dist folders
 *   npm run deploy -- --skip-db    do not touch the database
 *   npm run deploy -- --dry-run    show what would be uploaded, change nothing
 *
 * Configuration (a file locally, environment variables in CI):
 *   .env.deploy                FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_ROOT, SITE_URL
 *   apps/api/.env.production   the server's runtime .env (or PRODUCTION_ENV in CI)
 *
 * Server layout:
 *   /web.config          static site + rewrites (rewritten every deploy → recycles Node)
 *   /index.html, /assets the Vite build
 *   /app/server.cjs      the bundled API, run by iisnode
 *   /app/.env            runtime config
 *   /app/node_modules    Prisma client + Windows query engine only
 *
 * Only files whose hash differs from the last deploy are uploaded. The manifest of
 * hashes lives at /app/.deploy-manifest.json, which the root web.config blocks from
 * the web. Files the deploy never created (iisnode logs, future uploads) are never
 * deleted.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import { Client } from 'basic-ftp';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

const MANIFEST_PATH = 'app/.deploy-manifest.json';

const log = (message) => console.log(`\x1b[36m[deploy]\x1b[0m ${message}`);
const fail = (message) => {
  console.error(`\x1b[31m[deploy] ${message}\x1b[0m`);
  process.exit(1);
};

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const readIfExists = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);

const deployFile = readIfExists(path.join(root, '.env.deploy'));
const deployEnv = { ...(deployFile ? dotenv.parse(deployFile) : {}), ...process.env };

for (const key of ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'SITE_URL']) {
  if (!deployEnv[key]) fail(`${key} is not set (add it to .env.deploy or the environment)`);
}

const ftpRoot = (deployEnv.FTP_ROOT || '/').replace(/\/?$/, '/');
const siteUrl = deployEnv.SITE_URL.replace(/\/$/, '');

const runtimeEnvText =
  process.env.PRODUCTION_ENV ?? readIfExists(path.join(root, 'apps/api/.env.production'));
if (!runtimeEnvText) fail('apps/api/.env.production is missing (or set PRODUCTION_ENV)');
const runtimeEnv = dotenv.parse(runtimeEnvText);

/* ------------------------------------------------------------------ */
/* Build and database                                                  */
/* ------------------------------------------------------------------ */

const run = (command, env = {}) => {
  log(`$ ${command}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`"${command}" exited with ${result.status}`);
};

if (!args.has('--skip-build')) run('npm run build');

if (!args.has('--skip-db') && !dryRun) {
  // The seed is idempotent and must run on every release: new modules add
  // permission rows, and without them the new screens 403.
  run('npm run db:deploy', runtimeEnv);
  run('npm run db:seed', runtimeEnv);
}

/* ------------------------------------------------------------------ */
/* Staging                                                             */
/* ------------------------------------------------------------------ */

/** remote path → { source: absolute path | Buffer, hash } */
const files = new Map();

const hashOf = (content) => createHash('sha1').update(content).digest('hex');

const add = (remotePath, source) => {
  const content = Buffer.isBuffer(source) ? source : fs.readFileSync(source);
  files.set(remotePath, { source, size: content.length, hash: hashOf(content) });
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const addTree = (localDir, remoteDir, include = () => true) => {
  if (!fs.existsSync(localDir)) fail(`${path.relative(root, localDir)} does not exist — build first`);
  for (const file of walk(localDir)) {
    const relative = path.relative(localDir, file).split(path.sep).join('/');
    if (include(relative)) add(`${remoteDir}${relative}`, file);
  }
};

const notTypesOrMaps = (relative) => !/\.(d\.ts|map)$/.test(relative);

addTree(path.join(root, 'apps/web/dist'), '', notTypesOrMaps);
add('maintenance.html', path.join(root, 'deploy/iis/maintenance.html'));

add('app/server.cjs', path.join(root, 'apps/api/dist/server.cjs'));
add('app/web.config', path.join(root, 'deploy/iis/app.web.config'));
add('app/.env', Buffer.from(runtimeEnvText));

addTree(path.join(root, 'node_modules/@prisma/client'), 'app/node_modules/@prisma/client/', notTypesOrMaps);
addTree(
  path.join(root, 'node_modules/.prisma/client'),
  'app/node_modules/.prisma/client/',
  // Production is Windows: other platforms' engines are dead weight.
  (relative) =>
    notTypesOrMaps(relative) &&
    !relative.startsWith('deno/') &&
    !/(libquery_engine|query_engine)-(?!windows).*\.node$/.test(relative),
);

const gitSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' });
const buildId = `${new Date().toISOString()} ${gitSha.status === 0 ? gitSha.stdout.trim() : 'no-git'}`;
const rootWebConfig = Buffer.from(
  fs.readFileSync(path.join(root, 'deploy/iis/web.config'), 'utf8').replace('__BUILD_ID__', buildId),
);

/* ------------------------------------------------------------------ */
/* Sync                                                                */
/* ------------------------------------------------------------------ */

const client = new Client(60_000);
const createdDirs = new Set();

const remote = (relative) => `${ftpRoot}${relative}`;

const download = async (relative) => {
  const chunks = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  try {
    await client.downloadTo(sink, remote(relative));
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
};

const upload = async (relative, source) => {
  const dir = path.posix.dirname(relative);
  if (dir !== '.' && !createdDirs.has(dir)) {
    await client.ensureDir(remote(dir));
    await client.cd(ftpRoot);
    createdDirs.add(dir);
  }
  const input = Buffer.isBuffer(source) ? Readable.from(source) : fs.createReadStream(source);
  await client.uploadFrom(input, remote(relative));
};

const formatBytes = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const healthCheck = async () => {
  const url = `${siteUrl}/api/v1/health/ready`;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (response.ok) return true;
      log(`health check ${attempt}/12: HTTP ${response.status}`);
    } catch (error) {
      log(`health check ${attempt}/12: ${error.message}`);
    }
    await sleep(5_000);
  }
  return false;
};

try {
  log(`connecting to ${deployEnv.FTP_HOST}`);
  await client.access({
    host: deployEnv.FTP_HOST,
    user: deployEnv.FTP_USER,
    password: deployEnv.FTP_PASSWORD,
    secure: deployEnv.FTP_SECURE !== 'false',
    secureOptions: { rejectUnauthorized: false },
  });
  await client.cd(ftpRoot);

  const previousText = await download(MANIFEST_PATH);
  const previous = previousText ? JSON.parse(previousText.toString('utf8')).files : {};

  const changed = [...files.entries()].filter(([relative, file]) => previous[relative] !== file.hash);
  const removed = Object.keys(previous).filter((relative) => !files.has(relative));
  const bytes = changed.reduce((sum, [, file]) => sum + file.size, 0);

  log(`${files.size} files staged, ${changed.length} changed (${formatBytes(bytes)}), ${removed.length} to remove`);

  if (dryRun) {
    for (const [relative] of changed) console.log(`  + ${relative}`);
    for (const relative of removed) console.log(`  - ${relative}`);
    log('dry run — nothing uploaded');
    process.exit(0);
  }

  // The running Node process holds the Prisma engine open, and Windows will not
  // let a locked file be overwritten. Swap in a web.config that routes nothing to
  // Node, give iisnode a moment to exit, then replace the engine.
  const replacesLockedFiles = changed.some(
    ([relative]) => relative.startsWith('app/node_modules/') && previous[relative],
  );
  if (replacesLockedFiles) {
    log('Prisma files changed — switching the site to maintenance mode');
    await upload('maintenance.html', path.join(root, 'deploy/iis/maintenance.html'));
    await upload('web.config', path.join(root, 'deploy/iis/maintenance.web.config'));
    await sleep(10_000);
  }

  // Server first, then assets, then index.html, so a browser never gets an
  // index.html that points at chunks which are not there yet.
  const rank = ([relative]) =>
    relative.startsWith('app/') ? 0 : relative === 'index.html' ? 2 : 1;
  changed.sort((a, b) => rank(a) - rank(b));

  let done = 0;
  for (const [relative, file] of changed) {
    await upload(relative, file.source);
    done += 1;
    if (done % 25 === 0 || done === changed.length) log(`uploaded ${done}/${changed.length}`);
  }

  for (const relative of removed) {
    await client.remove(remote(relative)).catch(() => {});
  }

  const manifest = {
    buildId,
    files: Object.fromEntries([...files.entries()].map(([relative, file]) => [relative, file.hash])),
  };
  await upload(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest, null, 2)));

  // Last: the new root web.config recycles the app and takes the site live.
  await upload('web.config', rootWebConfig);
  log(`uploaded web.config — build ${buildId}`);
} catch (error) {
  fail(`FTP sync failed: ${error.message}`);
} finally {
  client.close();
}

log(`waiting for ${siteUrl}/api/v1/health/ready`);
if (!(await healthCheck())) fail('the site did not become healthy — check /app/iisnode logs over FTP');
log(`\x1b[32mlive at ${siteUrl}\x1b[0m`);
