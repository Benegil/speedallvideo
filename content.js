/* SpeedAllVideo — content : applique la vitesse aux vidéos, overlays, détection, raccourcis */
const MIN = 0.25;
const MAX = 4;

let speed = 1.0;      // vitesse courante (venue du stockage / des messages)
let step = 0.25;      // pas de réglage (options)
let force1x = false;  // option « Force 1x »
let ready = false;    // stockage chargé : avant ça, on n'écrase rien (fix rechargement → 1x)
let lastSet = 1.0;    // dernière vitesse posée par nous (anti-écho de la détection)
let lastForced = null;// dernière vitesse du site lue pendant le forcage

const clamp = s => Math.min(MAX, Math.max(MIN, s));
const round2 = s => Math.round(s * 100) / 100;
const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

/* ---------- Anti double-injection ----------
   À chaque rechargement de l'extension, Firefox ré-exécute ce script dans les
   onglets déjà ouverts SANS tuer l'ancienne instance : deux overlays
   cohabiteraient (le « fantôme » figé sur la vitesse du moment). L'instance
   active se marque sur <html> ; les instances obsolètes s'éteignent seules. */
const ME = Symbol('sav');
document.documentElement.setAttribute('data-sav-active', String(ME));

const timers = [];
const subs = [];
let dead = false;

function iv(fn, ms) { // setInterval qui meurt avec l'instance
    const id = setInterval(() => { if (!dead) fn(); }, ms);
    timers.push(id);
    return id;
}
function on(target, type, fn, opts) { // addEventListener enregistré pour le nettoyage
    target.addEventListener(type, fn, opts);
    subs.push([target, type, fn, opts]);
}

iv(() => {
    if (dead || document.documentElement.getAttribute('data-sav-active') === String(ME)) return;
    dead = true;
    console.log('SpeedAllVideo : instance obsolète, désactivation');
    timers.forEach(clearInterval);
    subs.forEach(([t, type, fn]) => t.removeEventListener(type, fn));
    document.querySelectorAll('.sav-overlay').forEach(el => { // ne supprime que ce qui est À CETTE instance
        if (el.getAttribute('data-sav-owner') === String(ME)) el.remove();
    });
    const st = document.getElementById('sav-style');
    if (st && st.getAttribute('data-sav-owner') === String(ME)) st.remove();
}, 250);

/* ---------- Styles des labels ---------- */
if (!document.getElementById('sav-style')) {
    const st = document.createElement('style');
    st.id = 'sav-style';
    st.setAttribute('data-sav-owner', String(ME));
    st.textContent = `
        .sav-label {
            position: absolute;
            top: 6px;
            left: 0;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            color: #fff;
            white-space: nowrap;
            pointer-events: none;
            transition: all 0.35s ease;
        }
        /* Flash central au changement de vitesse */
        .sav-label.sav-flash {
            font-size: clamp(28px, 7vw, 72px);
            font-weight: 800;
            letter-spacing: 1px;
            text-shadow: 0 2px 14px rgba(0,0,0,.9), 0 0 4px rgba(0,0,0,.6);
            left: 50%; top: 50%;
            transform: translate(-50%, -50%);
        }
        /* Badge permanent : 10px en haut à droite, lisible sur n'importe quel fond */
        .sav-label.sav-persistent {
            font-size: 10px;
            font-weight: 600;
            opacity: .85;
            mix-blend-mode: difference;
            left: auto; right: 6px; top: 6px;
        }
    `;
    (document.head || document.documentElement).appendChild(st);
}

/* ---------- Overlays par vidéo ---------- */
function overlayOf(v) {
    let o = v._savOverlay;
    if (o && o.getAttribute('data-sav-owner') !== String(ME)) { // hérité d'une instance morte : repris en propre
        o.setAttribute('data-sav-owner', String(ME));
        v._savLabel = o.querySelector('.sav-label');
    }
    if (!o) {
        o = document.createElement('div');
        o.className = 'sav-overlay';
        o.setAttribute('data-sav-owner', String(ME));
        o.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;overflow:hidden;';
        const l = document.createElement('span');
        l.className = 'sav-label sav-persistent';
        o.appendChild(l);
        (document.body || document.documentElement).appendChild(o);
        v._savOverlay = o;
        v._savLabel = l;
    }
    return o;
}

function fit(v) { // recadre l'overlay sur sa vidéo
    const o = v._savOverlay;
    if (!o || o.style.display === 'none') return;
    const r = v.getBoundingClientRect();
    o.style.width = r.width + 'px';
    o.style.height = r.height + 'px';
    o.style.top = r.top + 'px';
    o.style.left = r.left + 'px';
}

function fitAll() {
    document.getElementsByTagName('video').forEach(v => { if (v._savOverlay) fit(v); });
}

/* ---------- Badge global (aucune vidéo visible, mais un lecteur connu) ----------
   Ex : YouTube n'insère son <video> visible qu'au clic sur Play. Tant que
   seul un conteneur de lecteur existe, la vitesse s'affiche EN HAUT À DROITE
   DE CE CONTENEUR (pas au coin de l'écran). Dès qu'une vidéo apparaît, le
   badge par-vidéo prend le relais. */
const PLAYERS = [
    '.ytp-cued-thumbnail-overlay', // YouTube avant Play : l'overlay de vignette (meilleur ancrage)
    '#movie_player',               // YouTube
    '.html5-video-player',         // YouTube (repli)
    '.video-js',                   // Video.js
    '.player_vimeo_video',         // Vimeo
    'div[class*="video-player"]'   // lecteurs génériques
];

// Sur les pages watch, un <video> MASQUÉ existe déjà sous la vignette. L'overlay
// de vignette n'existe que tant que la vidéo ne joue pas : s'il est visible,
// on considère qu'aucune vidéo n'est « en cours » (c'était LA cause du badge
// absent au chargement chez Gilles).
function cuedVisible() {
    const el = document.querySelector('.ytp-cued-thumbnail-overlay');
    return !!el && visible(el);
}

function findPlayer() {
    for (const sel of PLAYERS) {
        let els;
        try { els = document.querySelectorAll(sel); } catch (e) { continue; }
        for (const el of els) if (visible(el)) return el;
    }
    return null;
}

function globalBadge(spd) {
    const hasVideo = !cuedVisible() &&
        Array.from(document.getElementsByTagName('video')).some(visible);
    const box = hasVideo ? null : findPlayer();
    let b = document.getElementById('sav-global');

    if (!box) {
        if (b && b.style.display !== 'none') b.style.display = 'none';
        return;
    }
    if (!b) {
        b = document.createElement('div');
        b.id = 'sav-global';
        b.className = 'sav-overlay';
        b.setAttribute('data-sav-owner', String(ME));
        b.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;overflow:hidden;';
        const l = document.createElement('span');
        l.className = 'sav-label sav-persistent';
        b.appendChild(l);
        (document.body || document.documentElement).appendChild(b);
    }
    const r = box.getBoundingClientRect();
    b.style.width = r.width + 'px';
    b.style.height = r.height + 'px';
    b.style.top = r.top + 'px';
    b.style.left = r.left + 'px';
    const l = b.querySelector('.sav-label');
    const text = `Speed ${spd}x`;
    if (l.textContent !== text) l.textContent = text;
    if (b.style.display !== 'block') b.style.display = 'block';
}

function placeBadge() { // recadrage au scroll/resize
    const b = document.getElementById('sav-global');
    if (!b || b.style.display === 'none') return;
    const box = findPlayer();
    if (!box) { b.style.display = 'none'; return; }
    const r = box.getBoundingClientRect();
    b.style.width = r.width + 'px';
    b.style.height = r.height + 'px';
    b.style.top = r.top + 'px';
    b.style.left = r.left + 'px';
}

on(window, 'scroll', () => { fitAll(); placeBadge(); }, { passive: true });
on(window, 'resize', () => { fitAll(); placeBadge(); });

/* ---------- Application de la vitesse ---------- */
function setRate(v, s) {
    if (v.playbackRate !== s) {
        try { v.playbackRate = s; return true; }
        catch (e) { console.error(`SpeedAllVideo : playbackRate ${s} refusé`, e); }
    }
    return false;
}

function show(v, s, flash) { // badge d'une vidéo : TOUJOURS visible (même à 1x)
    const o = overlayOf(v);
    const l = v._savLabel;
    const text = `Speed ${s}x`;
    if (o.style.display !== 'block') o.style.display = 'block';
    if (l.textContent !== text) l.textContent = text; // pas de re-mutation inutile

    if (flash) {
        l.classList.remove('sav-persistent');
        l.classList.add('sav-flash');
        fit(v); // recentre immédiatement
        clearTimeout(v._savFlashTimer);
        v._savFlashTimer = setTimeout(() => {
            l.classList.remove('sav-flash');
            l.classList.add('sav-persistent');
            fit(v);
        }, 500);
    } else if (!l.classList.contains('sav-flash')) {
        l.classList.add('sav-persistent');
    }
}

function apply(spd, flash = false) {
    const videos = document.getElementsByTagName('video');
    let changed = 0;
    Array.from(videos).forEach(v => {
        if (setRate(v, spd)) changed++;
        show(v, spd, flash);
    });
    lastSet = spd; // nos écritures ne doivent pas être « reprises » par la détection
    if (changed) console.log(`SpeedAllVideo : vitesse ${spd}x posée sur ${changed}/${videos.length} vidéo(s)`);
    fitAll();
    globalBadge(spd);
}

/* ---------- Détection de la vitesse choisie dans le lecteur du site ----------
   L'utilisateur change la vitesse depuis le menu du site (YouTube…) : on suit
   cette valeur, c'est elle qui sera restaurée à la désactivation de Force 1x.
   On ignore nos propres écritures (lastSet) pour éviter les allers-retours. */
function detect() {
    for (const v of Array.from(document.getElementsByTagName('video'))) {
        if (!visible(v)) continue;
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        if (v.seeking || v.paused) continue; // YouTube force 1x pendant un seek : états instables
        const r = round2(rate);
        if (Math.abs(r - lastSet) < 0.001) return; // on n'écrase pas ce qu'on vient de poser
        if (r >= MIN && r <= MAX) {
            speed = r;
            console.log(`SpeedAllVideo : vitesse réelle détectée ${speed}x`);
            browser.runtime.sendMessage({ action: 'setSpeed', speed, fromDetection: true }).catch(() => {});
        }
        return; // une seule vidéo de référence par cycle
    }
}

// Pendant le forcage 1x, la vitesse choisie dans le lecteur (ex : 2x) est
// écrasée avant qu'on puisse la lire : on lit ce que le site a posé AVANT de
// réappliquer 1x, et si ça change → l'utilisateur a touché au menu du site →
// on mémorise pour restaurer à la désactivation. Nos écritures (1x) sont
// ignorées via lastSet.
function trackForced() {
    for (const v of Array.from(document.getElementsByTagName('video'))) {
        if (!visible(v)) continue;
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        const r = round2(rate);
        if (Math.abs(r - lastSet) < 0.001) return;
        if (lastForced === null || Math.abs(r - lastForced) >= 0.001) {
            speed = r;
            console.log(`SpeedAllVideo : vitesse du site suivie pendant forcage → ${speed}x`);
            browser.runtime.sendMessage({ action: 'setSpeed', speed, fromDetection: true }).catch(() => {});
        }
        lastForced = r;
        return;
    }
}

/* ---------- Boucle & observation ---------- */
// La détection se fait AVANT l'application : sinon notre propre écriture
// écraserait la vitesse que le site vient de poser avant qu'on ne la lise.
iv(() => {
    if (!ready) return;
    if (force1x) { trackForced(); apply(1.0); }
    else { detect(); apply(speed); }
}, 1000);

// MutationObserver : capture les vidéos ajoutées dynamiquement. On ignore nos
// propres overlays (sinon boucle de microtâches) et on regroupe avec rAF pour
// ne pas réappliquer à chaque mutation isolée sur une page animée.
let pending = false;
const obs = new MutationObserver(ms => {
    const relevant = ms.some(m => !(m.target instanceof Element && m.target.closest('.sav-overlay')));
    if (!relevant || pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        if (ready) apply(force1x ? 1.0 : speed); // pas avant le chargement du stockage
    });
});
obs.observe(document.body, { childList: true, subtree: true });

/* ---------- Messages du background ---------- */
browser.runtime.onMessage.addListener(msg => {
    if (msg && msg.action === 'setSpeed') {
        speed = msg.speed;
        // Pendant le forcage 1x : mise à jour SANS application (la boucle gère
        // l'affichage, la vidéo reste à 1.0x). fromDetection : écho de notre
        // propre détection → silencieux (pas de flash).
        if (!force1x && !msg.fromDetection) apply(speed, true);
    }
});

/* ---------- Init depuis le stockage ----------
   La vitesse est lue DIRECTEMENT du stockage plutôt qu'au background : au
   rechargement de l'extension, le background peut répondre avant d'avoir lui-
   même chargé son stockage → il renvoyait 1.0 et la vidéo (ex : à 0.25x)
   passait « tout de suite à 1x ». ready est levé ICI ; en attendant, ni la
   boucle ni l'observer n'écrasent la vitesse réelle. */
browser.storage.sync.get(['forceOneX', 'speedStep', 'defaultSpeed']).then(res => {
    force1x = !!res.forceOneX;
    const s = parseFloat(res.speedStep);
    if (s > 0 && s <= MAX) step = s;
    if (res.defaultSpeed) speed = clamp(res.defaultSpeed);
    apply(force1x ? 1.0 : speed); // pas de flash au chargement
    ready = true;
});
setTimeout(() => { ready = true; }, 1500); // filet si le stockage échoue

on(browser.storage.onChanged, 'onChanged', changes => {
    if (changes.forceOneX) {
        force1x = !!changes.forceOneX.newValue;
        // Activation → 1.0x immédiatement ; désactivation → vitesse suivie rétablie sans attendre le tick.
        if (ready) apply(force1x ? 1.0 : speed);
    }
    if (changes.speedStep) {
        const s = parseFloat(changes.speedStep.newValue);
        if (s > 0 && s <= MAX) step = s;
    }
});

/* ---------- Raccourcis clavier : D = accélérer, S = ralentir, R = reset 1x ----------
   Gérés ici (pas en « commands » globaux) pour ne pas déclencher quand on tape
   dans un champ de formulaire ou avec un modificateur. */
function typing(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

on(document, 'keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (typing(e.target)) return;
    let next = null;
    switch (e.key.toLowerCase()) {
        case 'd': next = clamp(speed + step); break;
        case 's': next = clamp(speed - step); break;
        case 'r': next = 1.0; break;
        default: return;
    }
    e.preventDefault();
    browser.runtime.sendMessage({ action: 'setSpeed', speed: next }); // le background re-diffuse à tous les onglets
}, true);

/* Re-apply quand l'onglet redevient visible */
on(document, 'visibilitychange', () => {
    if (!document.hidden) apply(force1x ? 1.0 : speed);
});
