#!/usr/bin/env node
/**
 * deploy.js – Rezepte-App (PHP-Backend + React-SPA) auf all-inkl.com (KAS) deployen
 *
 * Architektur seit dem PHP-Umbau:
 *   - Frontend (Vite-Build)  → direkt in den Webroot
 *   - Backend (PHP)          → Webroot/api/  (Front-Controller, request-basiert)
 *   - .htaccess              → /api/* an PHP, sonst SPA-Fallback
 *   - KEIN Node, KEIN Keepalive, KEIN Watchdog, KEIN Reverse-Proxy mehr.
 *
 * Geheimnisse (DB, Google-OAuth) liest config.php aus der bereits vorhandenen
 * .app/backend/.env – es werden also keine Credentials neu hochgeladen.
 *
 * Aufruf:  node deploy.js            (deployt)
 *          node deploy.js --cleanup  (deployt + entfernt alte Node-Artefakte)
 */

'use strict';

const { Client } = require('ssh2');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const https = require('https');
const { execSync } = require('child_process');

// ─── Konfiguration ──────────────────────────────────────────────────────────

const ENV_FILE = path.join(__dirname, '.deploy.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}

const SSH_HOST = process.env.DEPLOY_SSH_HOST || 'w021a129.kasserver.com';
const SSH_USER = process.env.DEPLOY_SSH_USER || 'ssh-w021a129';
const SSH_KEY  = process.env.DEPLOY_SSH_KEY  || path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_ed25519');
const WEB_ROOT = process.env.DEPLOY_WEBROOT  || '/www/htdocs/w021a129/rezepte.familie-ebert.net';
const SITE     = 'https://rezepte.familie-ebert.net';
const CLEANUP  = process.argv.includes('--cleanup');

const LOCAL    = __dirname;
const PHP_SRC  = path.join(LOCAL, 'backend-php');
const FE_DIST  = path.join(LOCAL, 'frontend', 'dist');

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function log(msg) { console.log(`\n${'─'.repeat(60)}\n▶  ${msg}`); }
function ok(msg)  { console.log(`   ✓ ${msg}`); }
function err(msg) { console.error(`   ✗ ${msg}`); }

function run(conn, cmd, { silent = false } = {}) {
  return new Promise((resolve, reject) => {
    let out = '', errOut = '';
    conn.exec(cmd, (e, stream) => {
      if (e) return reject(e);
      stream.on('data', d => { out += d; if (!silent) process.stdout.write(d.toString()); });
      stream.stderr.on('data', d => { errOut += d; if (!silent) process.stderr.write(d.toString()); });
      stream.on('close', (code) => code !== 0 ? reject(new Error(`Exit ${code}: ${errOut.trim() || out.trim()}`)) : resolve(out.trim()));
    });
  });
}

function sftp(conn) { return new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s))); }
function put(s, local, remote) { return new Promise((res, rej) => s.fastPut(local, remote, e => e ? rej(e) : res())); }
function mkdir(s, remote) { return new Promise(r => s.mkdir(remote, () => r())); }

function writeRemote(s, content, remote) {
  const tmp = path.join(os.tmpdir(), `deploy_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  return put(s, tmp, remote).finally(() => fs.unlinkSync(tmp));
}

async function uploadDir(s, localDir, remoteDir) {
  await mkdir(s, remoteDir);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    const lp = path.join(localDir, entry.name);
    const rp = remoteDir + '/' + entry.name;
    if (entry.isDirectory()) await uploadDir(s, lp, rp);
    else await put(s, lp, rp);
  }
}

function httpGet(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 12000 }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body: body.trim() }));
    }).on('error', e => resolve({ status: 0, body: String(e) }))
      .on('timeout', function () { this.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

function connect() {
  const conn = new Client();
  return new Promise((res, rej) => {
    conn.on('ready', () => res(conn)).on('error', rej);
    const opts = { host: SSH_HOST, port: 22, username: SSH_USER, readyTimeout: 20000 };
    if (fs.existsSync(SSH_KEY)) { opts.privateKey = fs.readFileSync(SSH_KEY); ok(`SSH-Key: ${SSH_KEY}`); }
    else if (process.env.DEPLOY_SSH_PASSWORD) { opts.password = process.env.DEPLOY_SSH_PASSWORD; ok('SSH-Passwort aus Umgebung'); }
    else return rej(new Error(`SSH-Key nicht gefunden: ${SSH_KEY}`));
    conn.connect(opts);
  });
}

// ─── Deploy-Ablauf ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Rezepte-App Deployment (PHP-Backend)\n');

  // 1. Frontend bauen
  log('Frontend bauen...');
  execSync('npm run build --workspace=frontend', { cwd: LOCAL, stdio: 'inherit' });
  if (!fs.existsSync(path.join(FE_DIST, 'index.html'))) throw new Error('frontend/dist/index.html fehlt nach Build');
  ok('Frontend gebaut');

  if (!fs.existsSync(path.join(PHP_SRC, 'index.php'))) throw new Error('backend-php/index.php fehlt');

  // 2. SSH
  log('SSH-Verbindung aufbauen...');
  const conn = await connect();
  ok(`Verbunden mit ${SSH_USER}@${SSH_HOST}`);
  const s = await sftp(conn);

  try {
    // 3. .env-Check (config.php benötigt .app/backend/.env)
    log('Prod-Konfiguration prüfen (.app/backend/.env)...');
    const envExists = await run(conn, `test -f ${WEB_ROOT}/.app/backend/.env && echo yes || echo no`, { silent: true });
    if (envExists.trim() === 'yes') ok('.app/backend/.env vorhanden (DB/OAuth-Quelle)');
    else err('.app/backend/.env FEHLT! config.php kann DB/OAuth nicht lesen → bitte anlegen.');

    // 4. PHP-Backend hochladen → webroot/api/
    log('PHP-Backend hochladen (api/)...');
    await mkdir(s, `${WEB_ROOT}/api`);
    await mkdir(s, `${WEB_ROOT}/api/lib`);
    await put(s, path.join(PHP_SRC, 'index.php'),  `${WEB_ROOT}/api/index.php`);
    await put(s, path.join(PHP_SRC, 'config.php'), `${WEB_ROOT}/api/config.php`);
    for (const f of fs.readdirSync(path.join(PHP_SRC, 'lib'))) {
      await put(s, path.join(PHP_SRC, 'lib', f), `${WEB_ROOT}/api/lib/${f}`);
    }
    ok('api/ hochgeladen');

    // 5. .htaccess hochladen
    log('.htaccess hochladen...');
    await put(s, path.join(PHP_SRC, 'webroot.htaccess'), `${WEB_ROOT}/.htaccess`);
    ok('.htaccess aktiv (PHP-Routing + SPA-Fallback)');

    // 6. Frontend hochladen (Webroot; .app/.bin/api nicht anfassen)
    log('Frontend hochladen (Webroot)...');
    const skip = new Set(['api', '.htaccess']);
    for (const entry of fs.readdirSync(FE_DIST, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
      const lp = path.join(FE_DIST, entry.name);
      const rp = `${WEB_ROOT}/${entry.name}`;
      if (entry.isDirectory()) await uploadDir(s, lp, rp);
      else await put(s, lp, rp);
    }
    ok('Frontend hochgeladen');

    // 7. Optionale Bereinigung alter Node-Artefakte
    if (CLEANUP) {
      log('Alte Node-/Keepalive-/Watchdog-Artefakte entfernen...');
      // .env in .app/backend/ bleibt erhalten (config.php liest sie)!
      await run(conn,
        `rm -f ${WEB_ROOT}/watchdog.php ${WEB_ROOT}/.keepalive.sh ${WEB_ROOT}/.keepalive.pid ${WEB_ROOT}/watchdog.log ${WEB_ROOT}/_diag.php ${WEB_ROOT}/_transition.php 2>/dev/null; echo done`,
        { silent: true });
      ok('Watchdog/Keepalive-Dateien entfernt');
      console.log('   ℹ  Bitte den 1-/5-Minuten-Watchdog-Cron im KAS-Adminpanel löschen (ruft watchdog.php auf).');
      console.log('   ℹ  .app/backend/dist (Node-Code) bleibt vorerst – .app/backend/.env wird von config.php benötigt.');
    }

    // 8. Verifikation
    log('Verifikation...');
    const front = await httpGet(`${SITE}/`);
    front.status === 200 ? ok('Frontend erreichbar (200)') : err(`Frontend: HTTP ${front.status}`);

    const me = await httpGet(`${SITE}/api/auth/me`);
    if (me.status === 401) ok('API /auth/me erreichbar (401 = nicht angemeldet, korrekt)');
    else err(`API /auth/me: HTTP ${me.status} ${me.body}`);

    const recipes = await httpGet(`${SITE}/api/recipes`);
    if (recipes.status === 401) ok('API /recipes verlangt Login (401, korrekt)');
    else err(`API /recipes: HTTP ${recipes.status} ${recipes.body.slice(0, 120)}`);

    console.log('\n✅  Deployment abgeschlossen.');
    console.log('   Login testen:  ' + SITE + '  → "Mit Google anmelden"');
    if (!CLEANUP) console.log('   Tipp: nach erfolgreichem Test  "node deploy.js --cleanup"  für die Bereinigung.');

  } finally {
    conn.end();
  }
}

main().catch(e => { console.error('\n❌  Deployment fehlgeschlagen:', e.message); process.exit(1); });
