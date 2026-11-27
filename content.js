/* SpeedAllVideo — content : applique la vitesse aux vidéos, overlays, détection, raccourcis */
const MIN = 0.25;
const MAX = 4;

let speed = 1.0;      // vitesse courante (venue du stockage / des messages)
let step = 0.25;      // pas de réglage (options)
let force1x = false;  // option « Force 1x »
let ready = false;    // stockage chargé : avant ça, on n'écrase rien (fix rechargement → 1x)
let lastSet = 1.0;    // dernière vitesse posée par nous (anti-écho de la détection)
let lastForced = null;// dernière vitesse du site lue pendant le forcage
let neutral = true;   // aucune vitesse encore choisie (1re install) : on n'écrit RIEN sur les vidéos

const clamp = s => Math.min(MAX, Math.max(MIN, s));
const round2 = s => Math.round(s * 100) / 100;
const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

/* ---------- Anti double-injection ----------
   À chaque rechargement de l'extension, Firefox ré-exécute ce script dans les
   onglets déjà ouverts SANS tuer l'ancienne instance : deux overlays
   cohabiteraient (le « fantôme » figé sur la vitesse du moment). L'instance
   active se marque sur <html> ; les instances obsolètes s'éteignent seules. */
// Marqueur déjà présent = ré-injection (rechargement d'extension) : la vitesse
// actuelle des vidéos vient alors de NOUS, pas du site.
const REINJ = document.documentElement.hasAttribute('data-sav-active');
const ME = Math.random().toString(36).slice(2); // marqueur UNIQUE par instance (pas Symbol : deux Symbol('sav') s'afficheraient pareils)
document.documentElement.setAttribute('data-sav-active', ME);

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
        /* L'overlay est un conteneur CSS : les tailles en cqw/cqh se
           rapportent à LA VIDÉO, pas à la fenêtre (vw débordait des petites
           vidéos, ex : fil d'actualité). */
        .sav-overlay { container-type: size; }
        /* Flash central au changement de vitesse : « Speed 1.75x » (11 car.)
           tient dans ~90 % de la largeur à 13cqw, et dans la hauteur à 40cqh. */
        .sav-label.sav-flash {
            font-size: clamp(12px, min(13cqw, 40cqh), 72px);
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
    if (o && !o.isConnected) o = null; // supprimé (orphelin) : on en recrée un
    if (o && o.getAttribute('data-sav-owner') !== String(ME)) { // hérité d'une instance morte : repris en propre
        o.setAttribute('data-sav-owner', String(ME));
        o._savVideo = v;
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
        o._savVideo = v; // lien retour : l'overlay meurt avec sa vidéo (cf. fitAll)
    }
    return o;
}

/* Haut VISIBLE de la cible : un en-tête fixe/collant du site (barre de
   navigation…) peut recouvrir le haut de la vidéo quand on défile. Notre
   overlay est au-dessus de tout (z-index max) → le badge s'affichait PAR-
   DESSUS cet en-tête. On sonde le point où se trouve le badge (coin haut-
   droit) : tant qu'un élément fixed/sticky étranger à la vidéo le couvre, on
   descend sous lui. Nos overlays ont pointer-events:none → ignorés par la sonde. */
function visibleTop(target, r) {
    const x = Math.min(r.right, innerWidth) - 24;
    let y = Math.max(r.top, 0) + 4;
    for (let i = 0; i < 4 && y < r.bottom; i++) {
        const el = document.elementFromPoint(x, y);
        if (!el || el === target || target.contains(el)) break;
        let cover = null;
        for (let a = el; a && a !== document.body; a = a.parentElement) {
            if (a.contains(target)) break; // conteneur de la vidéo (lecteur…) : pas un masque
            const p = getComputedStyle(a).position;
            if (p === 'fixed' || p === 'sticky') { cover = a; break; }
        }
        if (!cover) break;
        y = cover.getBoundingClientRect().bottom + 1;
    }
    return Math.max(r.top, y - 4);
}

function place(o, target) { // cale l'overlay sur la partie visible de la cible
    const r = target.getBoundingClientRect();
    const top = visibleTop(target, r);
    const h = r.bottom - top;
    o.style.visibility = h < 20 ? 'hidden' : ''; // cible entièrement masquée : pas de badge
    o.style.width = r.width + 'px';
    o.style.height = Math.max(0, h) + 'px';
    o.style.top = top + 'px';
    o.style.left = r.left + 'px';
}

function fit(v) { // recadre l'overlay sur sa vidéo
    const o = v._savOverlay;
    if (!o || o.style.display === 'none') return;
    place(o, v);
}

function fitAll() {
    // Overlays orphelins : le site (YouTube : aperçus au survol, miniplayer,
    // navigation) retire ou remplace ses <video>, mais l'overlay est dans
    // <body> → il restait figé avec l'ancienne vitesse (« Speed » en double au
    // défilement). On le supprime dès que sa vidéo n'est plus dans le document.
    document.querySelectorAll('.sav-overlay').forEach(o => {
        if (o.id === 'sav-global' || o.getAttribute('data-sav-owner') !== String(ME)) return;
        const v = o._savVideo;
        if (v && v.isConnected && v._savOverlay === o) return;
        if (v && v._savOverlay === o) { v._savOverlay = null; v._savLabel = null; }
        o.remove();
    });
    Array.from(document.getElementsByTagName('video')).forEach(v => { if (v._savOverlay) fit(v); });
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
    place(b, box);
    const l = b.querySelector('.sav-label');
    const text = `Speed ${spd}x`;
    if (l.textContent !== text) l.textContent = text;
    if (b.style.display !== 'block') b.style.display = 'block';
}

// globalBadge (pas un simple recadrage) : il se masque si une vidéo
// visible a pris le relais, sinon deux « Speed » s'affichaient au défilement.
on(window, 'scroll', () => { fitAll(); globalBadge(lastSet); }, { passive: true });
on(window, 'resize', () => { fitAll(); globalBadge(lastSet); });

/* ---------- Application de la vitesse ---------- */
function setRate(v, s) {
    // On écrit TOUJOURS (même si déjà à cette valeur) : sinon l'événement
    // ratechange ne se déclenche pas et le lecteur du site ne met pas à jour
    // son état interne — ex : YouTube affichait alors dans son menu de vitesse
    // sa dernière valeur (0.55) au lieu de la nôtre (1x).
    if (v.playbackRate !== s) {
        try { v.playbackRate = s; return true; }
        catch (e) { console.error(`SpeedAllVideo : playbackRate ${s} refusé`, e); }
    } else {
        // Valeur déjà posée : on ré-affirme avec une écriture « aller-retour »
        // (le navigateur n'émet pas d'événement pour une écriture identique).
        // v._savHold : nos propres écritures instantanées ne sont pas
        // « vitesse du site » (sinon le hook ratechange suivrait le 1.01).
        v._savHold = true;
        try { v.playbackRate = Math.min(MAX, s + 0.01); v.playbackRate = s; }
        catch (e) {}
        v._savHold = false;
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
    const passive = neutral && !force1x; // neutre : on affiche sans écrire
    Array.from(videos).forEach(v => {
        if (passive) { hookRate(v); show(v, round2(v.playbackRate), flash); return; }
        if (setRate(v, spd)) changed++;
        hookRate(v); // réaction immédiate si le site change la vitesse pendant un forcage
        show(v, spd, flash);
    });
    lastSet = spd; // nos écritures ne doivent pas être « reprises » par la détection
    if (changed) console.log(`SpeedAllVideo : vitesse ${spd}x posée sur ${changed}/${videos.length} vidéo(s)`);
    fitAll();
    globalBadge(spd);
}

/* ---------- Vitesse choisie par le site ----------
   Mémorise la vitesse posée par le lecteur (YouTube…) pour la restaurer à la
   désactivation de Force 1x. Appelé par le hook ratechange (immédiat) et par
   trackForced (boucle 1 s, filet). Nos propres écritures (lastSet) sont
   ignorées pour éviter les allers-retours. */
function noteSiteRate(r) {
    if (Math.abs(r - lastSet) < 0.001) return;
    if (lastForced === null || Math.abs(r - lastForced) >= 0.001) {
        speed = r;
        console.log(`SpeedAllVideo : vitesse du site suivie → ${speed}x`);
        browser.runtime.sendMessage({ action: 'setSpeed', speed, fromDetection: true }).catch(() => {});
    }
    lastForced = r;
}

/* Pendant le forcage 1x, le site (YouTube…) peut ré-asserter sa vitesse à tout
   moment ; la boucle de 1 s serait trop lente → on ré-applique immédiatement
   via l'événement ratechange. Nos propres écritures (à 1.0) ne déclenchent rien. */
function hookRate(v) {
    if (v._savRC === ME) return;
    if (v._savRCFn) v.removeEventListener('ratechange', v._savRCFn);
    v._savRCFn = () => {
        if (dead || !force1x || v._savHold) return;
        if (Math.abs(v.playbackRate - 1) < 0.001) return; // notre propre écriture 1.0 → pas de boucle
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        noteSiteRate(round2(rate));
        // On ré-écrase APRÈS la fin de l'événement en cours : une écriture
        // synchrone serait annulée par le navigateur (la valeur posée par le
        // site n'est pas encore « engagée » pendant son propre ratechange).
        const t = setTimeout(() => { if (!dead && force1x) apply(1.0); }, 0);
        timers.push(t);
    };
    v._savRC = ME;
    on(v, 'ratechange', v._savRCFn);
}

/* ---------- Détection de la vitesse choisie dans le lecteur du site ----------
   L'utilisateur change la vitesse depuis le menu du site (YouTube…) : on suit
   cette valeur, c'est elle qui sera restaurée à la désactivation de Force 1x.
   On ignore nos propres écritures récentes (lastSet) pour éviter les
   allers-retours. Renvoie la vitesse à appliquer : celle détectée si le site
   en a posé une, sinon lastSet — jamais l'ancienne valeur mémoire qui
   écraserait un changement clavier encore frais. */
function detect() {
    for (const v of Array.from(document.getElementsByTagName('video'))) {
        if (!visible(v)) continue;
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        if (v.seeking) continue; // YouTube force 1x pendant un seek : état instable
        const r = round2(rate);
        // Notre propre valeur posée récemment → pas de re-détection. Au-delà
        // de la fenêtre, une même valeur lue est considérée comme venue du site.
        if (Math.abs(r - lastSet) < 0.001) return lastSet; // notre propre valeur : rien à détecter
        if (r >= MIN && r <= MAX) {
            speed = r;
            neutral = false; // le site a choisi : on suit désormais
            console.log(`SpeedAllVideo : vitesse réelle détectée ${speed}x`);
            browser.runtime.sendMessage({ action: 'setSpeed', speed, fromDetection: true }).catch(() => {});
        }
        return r; // la boucle l'applique (une seule écriture par cycle)
    }
    return lastSet;
}

// Filet de la boucle : le hook ratechange gère déjà l'instantané ; ici on
// capture seulement ce que le site aurait posé sans événement (rare).
function trackForced() {
    for (const v of Array.from(document.getElementsByTagName('video'))) {
        if (!visible(v)) continue;
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        noteSiteRate(round2(rate));
        return; // une seule vidéo de référence par cycle
    }
}

/* ---------- Boucle & observation ---------- */
// La détection se fait AVANT l'application : sinon notre propre écriture
// écraserait la vitesse que le site vient de poser avant qu'on ne la lise.
iv(() => {
    if (!ready) return;
    if (force1x) { trackForced(); apply(1.0); }
    else apply(detect()); // détection + application : une seule écriture par cycle
}, 1000);

// MutationObserver : capture les vidéos ajoutées dynamiquement. On ignore nos
// propres overlays (sinon boucle de microtâches) et on regroupe avec rAF pour
// ne pas réappliquer à chaque mutation isolée sur une page animée.
let pending = false;
const obs = new MutationObserver(ms => {
    // Seul l'AJOUT d'une vidéo compte : une page qui mute sans arrêt (YouTube,
    // compteurs…) ré-appliquerait sinon `speed` en boucle et écraserait la
    // vitesse que le site vient de poser avant que detect() ne la lise.
    const hasVideo = n => n.nodeType === 1 && !(n.classList && n.classList.contains('sav-overlay')) &&
        (n.tagName === 'VIDEO' || n.getElementsByTagName('video').length);
    if (ms.some(m => Array.from(m.removedNodes).some(hasVideo))) fitAll(); // vidéo retirée → overlay orphelin nettoyé
    const relevant = ms.some(m => Array.from(m.addedNodes).some(n => hasVideo(n) && !n.closest('.sav-overlay')));
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
    if (dead) return; // instance obsolète (rechargement d'extension)
    if (msg && msg.action === 'setSpeed') {
        speed = msg.speed;
        neutral = false; // une vitesse a été choisie (ici ou dans un autre onglet)
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
    // 1re install (aucune vitesse mémorisée) : neutre, on ne force pas 1x.
    neutral = !res.defaultSpeed && !force1x;
    // Chargement de page : si le site a DÉJÀ posé sa vitesse (YouTube restaure
    // la sienne, ex : 0.25x), on l'adopte au lieu de l'écraser avec la mémoire.
    if (!REINJ && !force1x) {
        const v = Array.from(document.getElementsByTagName('video'))
            .find(v => Math.abs(v.playbackRate - 1) >= 0.001 && v.playbackRate >= MIN && v.playbackRate <= MAX);
        if (v && Math.abs(round2(v.playbackRate) - speed) >= 0.001) {
            speed = round2(v.playbackRate);
            console.log(`SpeedAllVideo : vitesse du site au chargement conservée → ${speed}x`);
            browser.runtime.sendMessage({ action: 'setSpeed', speed, fromDetection: true }).catch(() => {});
        }
    }
    apply(force1x ? 1.0 : speed); // pas de flash au chargement
    ready = true;
});
setTimeout(() => { ready = true; }, 1500); // filet si le stockage échoue

/* onChanged est un objet WebExtension (addListener), pas un EventTarget : */
browser.storage.onChanged.addListener(changes => {
    if (dead) return; // instance obsolète (rechargement d'extension)
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
    if (dead) return; // instance obsolète (rechargement d'extension)
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
    neutral = false;
    browser.runtime.sendMessage({ action: 'setSpeed', speed: next }); // le background re-diffuse à tous les onglets
    apply(next, true); // on pose la valeur MAINTENANT : sinon la boucle la verrait comme « posée par le site »
}, true);

/* Re-apply quand l'onglet redevient visible */
on(document, 'visibilitychange', () => {
    if (!dead && !document.hidden) apply(force1x ? 1.0 : speed);
});
