#!/usr/bin/env node
/* SpeedAllVideo — lance toutes les pages de test automatiques (test/*.html)
   dans Chrome/Chromium headless et résume les résultats.
   Usage : npm test [-- nom-de-page …]   (ex : npm test -- index intent-test)
   Navigateur : Google Chrome / Chromium installé (H.264 requis pour
   test/video.mp4) ; autre chemin via la variable CHROME. */
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANUAL = new Set(['force-test.html', 'overlay-test.html']); // pas à pas, sans assertions
const VARIANTS = { 'startup-test.html': ['', '?install'] };          // une page, deux scénarios

let pw;
try { pw = await import('playwright-core'); }
catch {
    if (!process.env.PLAYWRIGHT) { console.error('playwright-core introuvable : lancer « npm install » (ou définir PLAYWRIGHT).'); process.exit(2); }
    pw = await import(pathToFileURL(process.env.PLAYWRIGHT).href);
}
const chromium = pw.chromium || pw.default.chromium;
const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!exe) { console.error('Chrome/Chromium introuvable : définir CHROME=/chemin/vers/chrome'); process.exit(2); }

const only = process.argv.slice(2).map(a => a.replace(/\.html$/, ''));
const runs = readdirSync(join(ROOT, 'test')).filter(f => f.endsWith('.html') && !MANUAL.has(f))
    .filter(f => !only.length || only.includes(f.replace(/\.html$/, '')))
    .flatMap(f => (VARIANTS[f] || ['']).map(q => ({ name: f + q, url: pathToFileURL(join(ROOT, 'test', f)).href + q })));

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const lineRe = / — (OK|ÉCHEC)/;

async function run({ name, url }) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    // Plein écran : exige un geste utilisateur → le test lève window.__wantFs, on clique.
    if (await page.$('#fsbtn')) {
        page.waitForFunction(() => window.__wantFs, null, { timeout: 30000 }).then(() => page.click('#fsbtn')).catch(() => {});
    }
    // Fin du test : plus de nouveau résultat pendant 5 s (ou ligne RÉSULTAT), 60 s max.
    const read = () => page.evaluate(re => [...document.querySelectorAll('li, .res')].map(l => l.textContent).filter(t => new RegExp(re).test(t)), lineRe.source);
    let lines = [], last = -1, since = Date.now();
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        await page.waitForTimeout(250);
        lines = [...new Set(await read())];
        if (lines.length !== last) { last = lines.length; since = Date.now(); }
        if (lines.some(l => l.includes('RÉSULTAT')) || (lines.length && Date.now() - since > 5000)) break;
    }
    await page.close();
    const fails = lines.filter(l => l.includes('ÉCHEC'));
    return { name, ok: lines.length > 0 && !fails.length && !errors.length, n: lines.length, fails, errors };
}

const results = [];
for (let i = 0; i < runs.length; i += 4) results.push(...await Promise.all(runs.slice(i, i + 4).map(run))); // 4 pages à la fois
await browser.close();

let bad = 0;
for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(28)} ${r.n - r.fails.length}/${r.n} OK`);
    if (!r.n) console.log('    aucun résultat (page bloquée ?)');
    r.fails.forEach(f => console.log('    ' + f));
    [...new Set(r.errors)].forEach(e => console.log('    erreur JS : ' + e));
    if (!r.ok) bad++;
}
console.log(bad ? `\n❌ ${bad} page(s) en échec sur ${results.length}` : `\n✅ ${results.length} pages, tout passe`);
process.exit(bad ? 1 : 0);
