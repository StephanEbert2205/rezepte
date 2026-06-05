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
 * Aufruf:
 *   node deploy.js                       – deployt (ohne Git-Commit)
 *   node deploy.js -m "Beschreibung"     – committed alles, pusht zu GitHub,
 *                                          generiert KI-Changelog-Entwurf, deployt
 *   node deploy.js --cleanup             – deployt + entfernt alte Node-Artefakte
 *   node deploy.js --migrate             – deployt + DB-Migration (Sharing)
 *   node deploy.js --migrate-invitations – legt account_invitations an
 *   node deploy.js --migrate-changelog   – legt changelog_entries an
 *   node deploy.js --migrate-changelog-read    – fügt lastChangelogReadAt hinzu
 *   node deploy.js --migrate-changelog-commits – legt changelog_commits an
 *   node deploy.js --migrate-changelog-ai      – fügt isAiGenerated hinzu
 *   node deploy.js --migrate --cleanup   – alles auf einmal
 *
 * KI-Changelog:
 *   Setzt GEMINI_API_KEY in Server-.env oder .deploy.env. Beim Deploy mit -m wird
 *   automatisch ein nutzerfreundlicher Changelog-Entwurf per Google Gemini generiert.
 *   Kostenlosen Key: https://aistudio.google.com (keine Kreditkarte nötig).
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

const SSH_HOST       = process.env.DEPLOY_SSH_HOST       || 'w021a129.kasserver.com';
const SSH_USER       = process.env.DEPLOY_SSH_USER       || 'ssh-w021a129';
const SSH_KEY        = process.env.DEPLOY_SSH_KEY        || path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_ed25519');
const SSH_PASSPHRASE = process.env.DEPLOY_SSH_PASSPHRASE || '';
const WEB_ROOT = process.env.DEPLOY_WEBROOT  || '/www/htdocs/w021a129/rezepte.familie-ebert.net';
const SITE     = 'https://rezepte.familie-ebert.net';
const CLEANUP              = process.argv.includes('--cleanup');
const MIGRATE              = process.argv.includes('--migrate');
const MIGRATE_INVITATIONS  = process.argv.includes('--migrate-invitations');
const MIGRATE_ADMIN        = process.argv.includes('--migrate-admin');
const MIGRATE_REPORTS      = process.argv.includes('--migrate-reports');
const MIGRATE_CHANGELOG         = process.argv.includes('--migrate-changelog');
const MIGRATE_CHANGELOG_READ    = process.argv.includes('--migrate-changelog-read');
const MIGRATE_CHANGELOG_COMMITS = process.argv.includes('--migrate-changelog-commits');
const MIGRATE_CHANGELOG_AI      = process.argv.includes('--migrate-changelog-ai');

// -m "Commit-Nachricht" → auto-commit + push + KI-Changelog
const COMMIT_MSG_IDX = process.argv.indexOf('-m');
const COMMIT_MSG     = COMMIT_MSG_IDX >= 0 ? (process.argv[COMMIT_MSG_IDX + 1] ?? null) : null;

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

/** Sendet einen HTTPS-POST und gibt den geparsten JSON-Body zurück. */
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(data) } },
      (res) => {
        let out = '';
        res.on('data', d => out += d);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
          catch { resolve({ status: res.statusCode, body: out }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Ruft die Google Gemini API auf und generiert einen nutzerfreundlichen
 * Changelog-Entwurf (Titel + Bullet-Points auf Deutsch) aus Commit-Nachrichten.
 * Gibt { title, body } zurück oder null bei Fehler / fehlendem API-Key.
 *
 * Kostenlosen API-Key unter https://aistudio.google.com besorgen (keine Kreditkarte nötig).
 */
async function generateChangelogDraft(commits, apiKey) {
  if (!apiKey || !commits.length) return null;

  // Nur nicht-triviale Commits für die KI (Merges / bumps herausfiltern)
  const relevant = commits.filter(c => !/^(merge|bump|chore|build|ci|style|wip|deploy)/i.test(c.message));
  if (!relevant.length) return null;

  const commitList = relevant.map(c => `- ${c.message}`).join('\n');

  const prompt =
    `Du schreibst kurze Changelog-Einträge für eine Familien-Rezepte-App namens "Rezeptsammlung".\n` +
    `Die Nutzer sind Familienmitglieder ohne technisches Vorwissen.\n\n` +
    `Folgende Änderungen wurden deployed:\n${commitList}\n\n` +
    `Schreibe einen knappen, freundlichen Changelog-Eintrag auf Deutsch:\n` +
    `- Einen kurzen, aussagekräftigen Titel (max. 60 Zeichen)\n` +
    `- 1–5 Bullet-Points, die beschreiben was sich für den Nutzer verändert hat\n` +
    `- Kein Fachjargon, keine technischen Details\n` +
    `- Formuliere aus Nutzersicht ("Rezepte von lecker.de können jetzt importiert werden")\n` +
    `- Ignoriere rein technische Commits ohne Nutzerauswirkung\n\n` +
    `Antworte ausschließlich im JSON-Format (kein Markdown drumherum):\n` +
    `{"title":"...","body":"• ...\\n• ..."}`;

  try {
    const res = await httpsPost(
      'generativelanguage.googleapis.com',
      `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      { 'Content-Type': 'application/json' },
      { contents: [{ parts: [{ text: prompt }] }] }
    );

    if (res.status !== 200) {
      err(`Gemini API Fehler ${res.status}: ${JSON.stringify(res.body)}`);
      return null;
    }

    const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // JSON aus Antwort extrahieren (Gemini schreibt manchmal Markdown-Backticks drumherum)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) { err('Gemini API: kein JSON in Antwort'); return null; }
    const draft = JSON.parse(match[0]);
    if (!draft.title || !draft.body) return null;
    return draft;
  } catch (e) {
    err(`Gemini API Ausnahme: ${e.message}`);
    return null;
  }
}

function connect() {
  const conn = new Client();
  return new Promise((res, rej) => {
    conn.on('ready', () => res(conn)).on('error', rej);
    const opts = { host: SSH_HOST, port: 22, username: SSH_USER, readyTimeout: 20000 };
    if (fs.existsSync(SSH_KEY)) {
      opts.privateKey = fs.readFileSync(SSH_KEY);
      if (SSH_PASSPHRASE) opts.passphrase = SSH_PASSPHRASE;
      ok(`SSH-Key: ${SSH_KEY}`);
    } else if (process.env.DEPLOY_SSH_PASSWORD) {
      opts.password = process.env.DEPLOY_SSH_PASSWORD;
      ok('SSH-Passwort aus Umgebung');
    } else {
      return rej(new Error(`SSH-Key nicht gefunden: ${SSH_KEY}`));
    }
    conn.connect(opts);
  });
}

// ─── Deploy-Ablauf ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Rezepte-App Deployment (PHP-Backend)\n');

  // 0. Auto-Commit + Push (nur wenn -m Flag gesetzt)
  if (COMMIT_MSG) {
    log(`Git: Änderungen committen und pushen...`);
    const status = execSync('git status --porcelain', { cwd: LOCAL }).toString().trim();
    if (status) {
      // Alle nicht ignorierten Änderungen stagen
      execSync('git add -A', { cwd: LOCAL, stdio: 'inherit' });
      // Commit-Nachricht in Temp-Datei schreiben (vermeidet Shell-Escaping-Probleme)
      const tmpMsg = path.join(os.tmpdir(), `deploy_msg_${Date.now()}.txt`);
      fs.writeFileSync(tmpMsg, COMMIT_MSG + '\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>', 'utf8');
      execSync(`git commit -F "${tmpMsg}"`, { cwd: LOCAL, stdio: 'inherit' });
      fs.unlinkSync(tmpMsg);
      ok(`Commit erstellt: ${COMMIT_MSG}`);
    } else {
      ok('Keine Änderungen zum Committen (Arbeitsverzeichnis sauber)');
    }
    execSync('git push origin master', { cwd: LOCAL, stdio: 'inherit' });
    ok('Push zu GitHub erfolgreich');
  }

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
    // 3. .env lesen (config.php + API-Keys)
    log('Prod-Konfiguration prüfen (.app/backend/.env)...');
    let serverEnvRaw = '';
    try {
      serverEnvRaw = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      ok('.app/backend/.env vorhanden (DB/OAuth-Quelle)');
    } catch {
      err('.app/backend/.env FEHLT! config.php kann DB/OAuth nicht lesen → bitte anlegen.');
    }

    // GEMINI_API_KEY: zuerst Server-.env, dann lokale .deploy.env
    const serverGeminiMatch = serverEnvRaw.match(/GEMINI_API_KEY=["']?([^\s"'\n]+)/);
    const anthropicKey = serverGeminiMatch?.[1] ?? process.env.GEMINI_API_KEY ?? '';
    if (anthropicKey) ok('GEMINI_API_KEY aus Server-.env geladen');
    else ok('GEMINI_API_KEY nicht gefunden – KI-Entwurf wird übersprungen');

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

    // 6a. Veraltete statische Dateien entfernen (würden SPA-Routing brechen)
    await run(conn,
      `rm -f ${WEB_ROOT}/anleitung ${WEB_ROOT}/anleitung.pdf ${WEB_ROOT}/anleitung.html 2>/dev/null; echo done`,
      { silent: true });

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

    // 7. Optionale DB-Migration
    if (MIGRATE) {
      log('DB-Migration ausführen (migrate-sharing.sql)...');
      // DB-Zugangsdaten aus der .env auf dem Server lesen
      const envRaw = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch = envRaw.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl  = new URL(dbUrlMatch[1]);
      const dbUser = decodeURIComponent(dbUrl.username);
      const dbPass = decodeURIComponent(dbUrl.password);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port || '3306';
      const dbName = dbUrl.pathname.replace(/^\//, '');
      // Migration hochladen und ausführen
      const migSql = path.join(LOCAL, 'setup', 'migrate-sharing.sql');
      await put(s, migSql, `${WEB_ROOT}/.migrate-sharing.sql`);
      await run(conn, `mysql -h ${dbHost} -P ${dbPort} -u '${dbUser}' -p'${dbPass}' ${dbName} < ${WEB_ROOT}/.migrate-sharing.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-sharing.sql`, { silent: true });
      ok('DB-Migration abgeschlossen');
    }

    // 7b. Optionale DB-Migration: account_invitations
    if (MIGRATE_INVITATIONS) {
      log('DB-Migration ausführen (migrate-invitations.sql)...');
      const envRaw2 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch2 = envRaw2.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch2) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl2  = new URL(dbUrlMatch2[1]);
      const dbUser2 = decodeURIComponent(dbUrl2.username);
      const dbPass2 = decodeURIComponent(dbUrl2.password);
      const dbHost2 = dbUrl2.hostname;
      const dbPort2 = dbUrl2.port || '3306';
      const dbName2 = dbUrl2.pathname.replace(/^\//, '');
      const migSql2 = path.join(LOCAL, 'setup', 'migrate-invitations.sql');
      await put(s, migSql2, `${WEB_ROOT}/.migrate-invitations.sql`);
      await run(conn, `mysql -h ${dbHost2} -P ${dbPort2} -u '${dbUser2}' -p'${dbPass2}' ${dbName2} < ${WEB_ROOT}/.migrate-invitations.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-invitations.sql`, { silent: true });
      ok('account_invitations-Tabelle angelegt');
    }

    // 7c. Optionale DB-Migration: isAdmin-Flag
    if (MIGRATE_ADMIN) {
      log('DB-Migration ausführen (migrate-admin.sql)...');
      const envRaw3 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch3 = envRaw3.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch3) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl3  = new URL(dbUrlMatch3[1]);
      const dbUser3 = decodeURIComponent(dbUrl3.username);
      const dbPass3 = decodeURIComponent(dbUrl3.password);
      const dbHost3 = dbUrl3.hostname;
      const dbPort3 = dbUrl3.port || '3306';
      const dbName3 = dbUrl3.pathname.replace(/^\//, '');
      const migSql3 = path.join(LOCAL, 'setup', 'migrate-admin.sql');
      await put(s, migSql3, `${WEB_ROOT}/.migrate-admin.sql`);
      await run(conn, `mysql -h ${dbHost3} -P ${dbPort3} -u '${dbUser3}' -p'${dbPass3}' ${dbName3} < ${WEB_ROOT}/.migrate-admin.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-admin.sql`, { silent: true });
      ok('isAdmin-Spalte angelegt');
    }

    // 7e. Optionale DB-Migration: changelog_entries
    if (MIGRATE_CHANGELOG) {
      log('DB-Migration ausführen (migrate-changelog.sql)...');
      const envRaw5 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch5 = envRaw5.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch5) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl5  = new URL(dbUrlMatch5[1]);
      const dbUser5 = decodeURIComponent(dbUrl5.username);
      const dbPass5 = decodeURIComponent(dbUrl5.password);
      const dbHost5 = dbUrl5.hostname;
      const dbPort5 = dbUrl5.port || '3306';
      const dbName5 = dbUrl5.pathname.replace(/^\//, '');
      const migSql5 = path.join(LOCAL, 'setup', 'migrate-changelog.sql');
      await put(s, migSql5, `${WEB_ROOT}/.migrate-changelog.sql`);
      await run(conn, `mysql -h ${dbHost5} -P ${dbPort5} -u '${dbUser5}' -p'${dbPass5}' ${dbName5} < ${WEB_ROOT}/.migrate-changelog.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-changelog.sql`, { silent: true });
      ok('changelog_entries-Tabelle angelegt');
    }

    // 7h. Optionale DB-Migration: isAiGenerated-Spalte
    if (MIGRATE_CHANGELOG_AI) {
      log('DB-Migration ausführen (migrate-changelog-ai.sql)...');
      const envRaw8 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch8 = envRaw8.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch8) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl8  = new URL(dbUrlMatch8[1]);
      const dbUser8 = decodeURIComponent(dbUrl8.username);
      const dbPass8 = decodeURIComponent(dbUrl8.password);
      const dbHost8 = dbUrl8.hostname;
      const dbPort8 = dbUrl8.port || '3306';
      const dbName8 = dbUrl8.pathname.replace(/^\//, '');
      const migSql8 = path.join(LOCAL, 'setup', 'migrate-changelog-ai.sql');
      await put(s, migSql8, `${WEB_ROOT}/.migrate-changelog-ai.sql`);
      await run(conn, `mysql -h ${dbHost8} -P ${dbPort8} -u '${dbUser8}' -p'${dbPass8}' ${dbName8} < ${WEB_ROOT}/.migrate-changelog-ai.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-changelog-ai.sql`, { silent: true });
      ok('isAiGenerated-Spalte angelegt');
    }

    // 7g. Optionale DB-Migration: changelog_commits
    if (MIGRATE_CHANGELOG_COMMITS) {
      log('DB-Migration ausführen (migrate-changelog-commits.sql)...');
      const envRaw7 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch7 = envRaw7.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch7) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl7  = new URL(dbUrlMatch7[1]);
      const dbUser7 = decodeURIComponent(dbUrl7.username);
      const dbPass7 = decodeURIComponent(dbUrl7.password);
      const dbHost7 = dbUrl7.hostname;
      const dbPort7 = dbUrl7.port || '3306';
      const dbName7 = dbUrl7.pathname.replace(/^\//, '');
      const migSql7 = path.join(LOCAL, 'setup', 'migrate-changelog-commits.sql');
      await put(s, migSql7, `${WEB_ROOT}/.migrate-changelog-commits.sql`);
      await run(conn, `mysql -h ${dbHost7} -P ${dbPort7} -u '${dbUser7}' -p'${dbPass7}' ${dbName7} < ${WEB_ROOT}/.migrate-changelog-commits.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-changelog-commits.sql`, { silent: true });
      ok('changelog_commits-Tabelle angelegt');
    }

    // 7f. Optionale DB-Migration: lastChangelogReadAt
    if (MIGRATE_CHANGELOG_READ) {
      log('DB-Migration ausführen (migrate-changelog-read.sql)...');
      const envRaw6 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch6 = envRaw6.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch6) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl6  = new URL(dbUrlMatch6[1]);
      const dbUser6 = decodeURIComponent(dbUrl6.username);
      const dbPass6 = decodeURIComponent(dbUrl6.password);
      const dbHost6 = dbUrl6.hostname;
      const dbPort6 = dbUrl6.port || '3306';
      const dbName6 = dbUrl6.pathname.replace(/^\//, '');
      const migSql6 = path.join(LOCAL, 'setup', 'migrate-changelog-read.sql');
      await put(s, migSql6, `${WEB_ROOT}/.migrate-changelog-read.sql`);
      await run(conn, `mysql -h ${dbHost6} -P ${dbPort6} -u '${dbUser6}' -p'${dbPass6}' ${dbName6} < ${WEB_ROOT}/.migrate-changelog-read.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-changelog-read.sql`, { silent: true });
      ok('lastChangelogReadAt-Spalte angelegt');
    }

    // 7d. Optionale DB-Migration: recipe_reports
    if (MIGRATE_REPORTS) {
      log('DB-Migration ausführen (migrate-reports.sql)...');
      const envRaw4 = await run(conn, `cat ${WEB_ROOT}/.app/backend/.env`, { silent: true });
      const dbUrlMatch4 = envRaw4.match(/DATABASE_URL=["']?(mysql:\/\/[^\s"'\n]+)/);
      if (!dbUrlMatch4) throw new Error('.app/backend/.env enthält keine DATABASE_URL');
      const dbUrl4  = new URL(dbUrlMatch4[1]);
      const dbUser4 = decodeURIComponent(dbUrl4.username);
      const dbPass4 = decodeURIComponent(dbUrl4.password);
      const dbHost4 = dbUrl4.hostname;
      const dbPort4 = dbUrl4.port || '3306';
      const dbName4 = dbUrl4.pathname.replace(/^\//, '');
      const migSql4 = path.join(LOCAL, 'setup', 'migrate-reports.sql');
      await put(s, migSql4, `${WEB_ROOT}/.migrate-reports.sql`);
      await run(conn, `mysql -h ${dbHost4} -P ${dbPort4} -u '${dbUser4}' -p'${dbPass4}' ${dbName4} < ${WEB_ROOT}/.migrate-reports.sql && echo "Migration OK"`);
      await run(conn, `rm -f ${WEB_ROOT}/.migrate-reports.sql`, { silent: true });
      ok('recipe_reports-Tabelle angelegt');
    }

    // 8. Optionale Bereinigung alter Node-Artefakte
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

    // 8. Git-Commits + optionaler KI-Entwurf hochladen
    log('Git-Commits für Changelog hochladen...');
    try {
      const deployTag = new Date().toISOString().slice(0, 16); // "2026-06-05T14:30"
      const gitLogRaw = execSync(
        'git log --format="%H|%h|%s|%ad|%an" --date=short -50',
        { cwd: LOCAL }
      ).toString().trim();
      const commits = gitLogRaw.split('\n').filter(Boolean).map((line) => {
        const parts   = line.split('|');
        return {
          hash:    parts[0] ?? '',
          short:   parts[1] ?? '',
          message: parts[2] ?? '',
          date:    parts[3] ?? '',
          author:  parts[4] ?? '',
        };
      });

      // KI-Entwurf generieren (nur beim Deploy mit -m und wenn API-Key vorhanden)
      let aiDraft = null;
      if (COMMIT_MSG && anthropicKey) {
        log('KI-Changelog-Entwurf generieren (Claude API)...');
        // Nur Commits seit dem vorherigen Deploy (die noch nicht in der DB sind)
        // Als Näherung: alle Commits der letzten 24h
        const since = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
        const newCommits = commits.filter(c => c.date >= since);
        aiDraft = await generateChangelogDraft(newCommits.length ? newCommits : commits.slice(0, 5), anthropicKey);
        if (aiDraft) {
          ok(`KI-Entwurf generiert: "${aiDraft.title}"`);
        } else {
          ok('KI-Entwurf: kein Ergebnis (Commits evtl. nur technischer Natur)');
        }
      } else if (COMMIT_MSG && !anthropicKey) {
        ok('KI-Entwurf übersprungen (GEMINI_API_KEY weder in Server-.env noch in .deploy.env)');
      }

      const payload = { deployTag, commits, ...(aiDraft ? { aiDraft } : {}) };
      await writeRemote(s, JSON.stringify(payload, null, 2), `${WEB_ROOT}/api/.pending-commits.json`);
      ok(`${commits.length} Commits hochgeladen (deployTag: ${deployTag}${aiDraft ? ', inkl. KI-Entwurf' : ''})`);
    } catch (e) {
      err(`Commits konnten nicht hochgeladen werden: ${e.message}`);
    }

    // 9. Verifikation
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
    if (!MIGRATE) console.log('   Tipp: einmalig  "node deploy.js --migrate"  ausführen um die DB-Migration (Sharing) einzuspielen.');
    if (!MIGRATE_INVITATIONS) console.log('   Tipp: einmalig  "node deploy.js --migrate-invitations"  ausführen um account_invitations anzulegen.');
    if (!MIGRATE_ADMIN)   console.log('   Tipp: einmalig  "node deploy.js --migrate-admin"  ausführen um das isAdmin-Flag anzulegen.');
    if (!MIGRATE_REPORTS)   console.log('   Tipp: einmalig  "node deploy.js --migrate-reports"    ausführen um recipe_reports anzulegen.');
    if (!MIGRATE_CHANGELOG)      console.log('   Tipp: einmalig  "node deploy.js --migrate-changelog"       ausführen um changelog_entries anzulegen.');
    if (!MIGRATE_CHANGELOG_READ)    console.log('   Tipp: einmalig  "node deploy.js --migrate-changelog-read"     ausführen um lastChangelogReadAt anzulegen.');
    if (!MIGRATE_CHANGELOG_COMMITS) console.log('   Tipp: einmalig  "node deploy.js --migrate-changelog-commits"  ausführen um changelog_commits anzulegen.');
    if (!MIGRATE_CHANGELOG_AI)      console.log('   Tipp: einmalig  "node deploy.js --migrate-changelog-ai"       ausführen um isAiGenerated-Spalte anzulegen.');
    if (COMMIT_MSG && !anthropicKey) {
      console.log('   Tipp: GEMINI_API_KEY in der Server-.env (.app/backend/.env) oder lokal in .deploy.env eintragen um KI-Changelog-Entwürfe zu aktivieren.');
      console.log('         Kostenlosen Key unter https://aistudio.google.com erstellen (keine Kreditkarte nötig).');
    }
    if (!CLEANUP) console.log('   Tipp: nach erfolgreichem Test  "node deploy.js --cleanup"  für die Bereinigung.');

  } finally {
    conn.end();
  }
}

main().catch(e => { console.error('\n❌  Deployment fehlgeschlagen:', e.message); process.exit(1); });
