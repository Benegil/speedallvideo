#!/usr/bin/env node
/* SpeedAllVideo — régénère les captures de la fiche AMO (amo/screenshots/,
   1280×800, fr + en) : grand affichage sur une vidéo, badge + popup, options.
   Usage : npm run screenshots
   Requiert ffmpeg (fond : amo/screenshot-bg.jpg, libre de droits ; sinon dégradé)
   et Google Chrome / Chromium (variable CHROME pour un autre chemin). */
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const R = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_URL = pathToFileURL(R).href;
const OUT = join(R, 'amo', 'screenshots');
const SH = fs.mkdtempSync(join(os.tmpdir(), 'sav-shots-'));

let pw;
try { pw = await import('playwright-core'); }
catch {
    if (!process.env.PLAYWRIGHT) { console.error('playwright-core introuvable : lancer « npm install » (ou définir PLAYWRIGHT).'); process.exit(2); }
    pw = await import(pathToFileURL(process.env.PLAYWRIGHT).href);
}
const chromium = pw.chromium || pw.default.chromium;
const exe = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
if (!exe) { console.error('Chrome/Chromium introuvable : définir CHROME=/chemin/vers/chrome'); process.exit(2); }

// Vidéo de démonstration : amo/screenshot-bg.jpg (image libre de droits) mise
// en vidéo de 6 s ; à défaut, un dégradé animé généré.
const BGIMG = join(R, 'amo', 'screenshot-bg.jpg');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    ...(fs.existsSync(BGIMG)
        ? ['-loop', '1', '-i', BGIMG, '-t', '6', '-r', '30', '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720']
        : ['-f', 'lavfi', '-i', 'gradients=s=1280x720:c0=0x0f2027:c1=0x203a43:c2=0x2c5364:c3=0xf2733d:nb_colors=4:x0=0:y0=0:x1=1280:y1=720:speed=0.02:duration=6:rate=30']),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(SH, 'demo.mp4')]);

// Pages de mise en scène
fs.writeFileSync(join(SH, 's1.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#14171c 0%,#1d2733 55%,#2b2320 100%);display:flex;align-items:center;justify-content:center;overflow:hidden">
<video id="v" src="demo.mp4" width="1120" height="630" muted autoplay loop style="border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.55);display:block"></video>
<script src="${ROOT_URL}/sound.js"></script><script src="${ROOT_URL}/content.js"></script></body>`);
fs.writeFileSync(join(SH, 's2.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#14171c 0%,#1d2733 55%,#2b2320 100%);position:relative;overflow:hidden">
<video id="v" src="demo.mp4" width="800" height="450" muted autoplay loop style="border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.55);display:block;position:absolute;left:56px;top:175px"></video>
<iframe src="${ROOT_URL}/popup.html" style="position:absolute;right:56px;top:100px;width:364px;height:600px;border:0;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.55);background:#e9eaec"></iframe>
<script src="${ROOT_URL}/sound.js"></script><script src="${ROOT_URL}/content.js"></script></body>`);
fs.writeFileSync(join(SH, 's3.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:800px;background:linear-gradient(135deg,#14171c 0%,#1d2733 55%,#2b2320 100%);display:flex;gap:48px;align-items:center;justify-content:center;overflow:hidden">
<iframe id="a" src="${ROOT_URL}/options.html" style="width:400px;height:720px;border:0;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.55)"></iframe>
<iframe id="b" src="${ROOT_URL}/options.html" style="width:400px;height:720px;border:0;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.55)"></iframe></body>`);

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
for (const lang of ['fr', 'en']) {
  const msgs = JSON.parse(fs.readFileSync(join(R, '_locales', lang, 'messages.json'), 'utf8'));
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: lang });
  await ctx.addInitScript(([msgs, lang]) => {
    window.AudioContext = class { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; } resume() {}
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; } };
    const store = { defaultSpeed: 1.5, speedStep: '0.25', soundFx: true };
    const ocl = [];
    window.browser = {
      i18n: { getUILanguage: () => lang, getMessage: (k, a = []) => { const m = msgs[k]; if (!m) return ''; let s = m.message;
        for (const [n, d] of Object.entries(m.placeholders || {})) s = s.replace(new RegExp('\\$' + n + '\\$', 'gi'), d.content.replace(/\$(\d)/, (_, i) => a[i - 1] ?? '')); return s; } },
      storage: { sync: { get: async keys => { const o = {}; [].concat(keys).forEach(k => { if (k in store) o[k] = store[k]; }); return o; },
        set: async obj => { const ch = {}; for (const k in obj) { ch[k] = { newValue: obj[k] }; store[k] = obj[k]; } ocl.forEach(f => f(ch)); } },
        onChanged: { addListener: f => ocl.push(f) } },
      runtime: { onMessage: { addListener() {} }, sendMessage: (m, cb) => { if (m.speed) store.defaultSpeed = m.speed; cb && cb({ speed: store.defaultSpeed }); return Promise.resolve({ speed: store.defaultSpeed }); } },
    };
  }, [msgs, lang]);
  const p = await ctx.newPage();
  // 1. Grand affichage au changement de vitesse
  await p.goto(pathToFileURL(join(SH, 's1.html')).href); await p.waitForTimeout(1800);
  await p.keyboard.press('d'); await p.waitForTimeout(420);
  await p.screenshot({ path: join(OUT, '1-video-' + lang + '.png') });
  // 2. Badge permanent + popup
  await p.goto(pathToFileURL(join(SH, 's2.html')).href); await p.waitForTimeout(1800);
  // cadre du popup = taille réelle du popup (largeur 340, hauteur du contenu)
  const ph = await p.frameLocator('iframe').locator('body').evaluate(b => Math.ceil(b.getBoundingClientRect().height));
  await p.evaluate(h => { const f = document.querySelector('iframe'); f.style.width = '340px'; f.style.height = h + 'px'; f.style.top = Math.round((800 - h) / 2) + 'px'; }, ph);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(OUT, '2-popup-' + lang + '.png') });
  // 3. Options (deux colonnes : haut / bas de la page)
  await p.goto(pathToFileURL(join(SH, 's3.html')).href); await p.waitForTimeout(800);
  // colonne gauche : jusqu'à la carte « Affichage » ; colonne droite : à partir d'elle
  const cut = await p.frameLocator('#a').locator('body').evaluate(() => { const c = document.querySelector('[data-i18n="displayTitle"]').closest('.card'); return Math.round(c.getBoundingClientRect().top + scrollY); });
  const total = await p.frameLocator('#b').locator('body').evaluate(() => document.documentElement.scrollHeight);
  await p.evaluate(([cut, total]) => { const a = document.getElementById('a'), b = document.getElementById('b');
    a.style.height = (cut - 4) + 'px'; b.style.height = Math.min(720, total - cut + 12) + 'px'; a.style.width = b.style.width = '380px'; }, [cut, total]);
  await p.frameLocator('#b').locator('body').evaluate((b, cut) => window.scrollTo(0, cut - 12), cut);
  await p.waitForTimeout(200);
  await p.screenshot({ path: join(OUT, '3-options-' + lang + '.png') });
  await ctx.close();
}
await b.close();
fs.rmSync(SH, { recursive: true, force: true });
console.log(fs.readdirSync(OUT).map(f => 'amo/screenshots/' + f).join('\n'));
