// Build, serve, and verify the native worker route without writing database data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const next = path.join(root, 'node_modules/next/dist/bin/next');
const log = path.join(root, 'worker-verification.log');
const fd = fs.openSync(log, 'w');
const build = spawnSync(process.execPath, [next, 'build'], { cwd: root, stdio: ['ignore', fd, fd] });
fs.closeSync(fd);
if (build.status !== 0) { console.error(fs.readFileSync(log, 'utf8')); process.exit(1); }
console.log('PASS: production build');
const server = spawn(process.execPath, [next, 'start', '-p', '3187', '-H', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
const base = 'http://127.0.0.1:3187';
(async () => {
  try {
    let response;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error(serverLog);
      try { response = await fetch(base + '/worker'); if (response.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(response?.status, 200, serverLog);
    const html = await response.text();
    fs.writeFileSync(path.join(root, 'worker-rendered.html'), html);
    assert.doesNotMatch(html, /<iframe\b/i);
    assert.doesNotMatch(html, /src=["']\/worker-profile\.html/i);
    for (const label of ['About Yourself', 'Describe the work', 'Resume', 'Upload Your Works', 'My Skills', 'Featured At', 'My Documents', 'Social Media', 'Profession', 'Open work status']) assert.ok(html.includes(label), 'Missing native markup: ' + label);
    assert.equal((html.match(/<option /g) || []).length, 148);
    assert.match(html, /<head>[\s\S]*font-awesome\/6\.4\.0\/css\/all\.min\.css[\s\S]*<\/head>/);
    console.log('PASS: HTTP 200; native sections; 148 professions; no iframe; icon stylesheet in head');
    const stylesheetUrls = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^\"]*)"/g)].map(match => match[1]).filter(url => url.startsWith('/'));
    assert.ok(stylesheetUrls.length);
    let styles = '';
    for (const url of stylesheetUrls) { const css = await fetch(base + url.replaceAll('&amp;', '&')); assert.equal(css.status, 200); styles += await css.text(); }
    assert.ok(styles.includes('profile-body-section'));
    assert.ok(styles.includes('modal-body'));
    assert.ok(!styles.includes('a_clean_modern_widescreen_app_profile_header_ui.png'));
    console.log('PASS: compiled styles served; profile and modal styles present; no missing cover reference');
    const profile = await fetch(base + '/api/worker/profile');
    assert.equal(profile.status, 200); assert.deepEqual(await profile.json(), { profile: null });
    const business = await fetch(base + '/business');
    assert.equal(business.status, 200);
    console.log('PASS: anonymous worker profile read and business page respond');
    if (process.argv.includes('--live-backend')) await require('./verify-worker-api.cjs')(base, root);
    if (process.argv.includes('--browser')) await require('./verify-worker-browser.cjs')(base, root);
    if (process.argv.includes('--business-local')) await require('./verify-business-local.cjs')(base);
    console.log('Smoke checks complete. Live backend and browser checks run only with their explicit flags.');
  } finally { server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
