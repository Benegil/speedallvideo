/* SpeedAllVideo — content : applique la vitesse aux vidéos, overlays, détection, raccourcis */
const MIN = 0.25;
const MAX = 4;

let speed = 1.0;      // vitesse courante (venue du stockage / des messages)
let step = 0.25;      // pas de réglage (options)
let force1x = false;  // option « Force 1x »
let hideBadge = false;   // option : masquer le badge permanent en haut à droite
let hideFlash = false;   // option : masquer le flash central au changement
let soundFx = true;      // option : signal sonore au changement (activé par défaut)
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
        /* Badge permanent : 10px en haut à droite, lisible sur n'importe quel fond.
           Blanc cerclé de noir (contour 1px + halo) : lisible sur blanc, gris,
           noir. mix-blend-mode: difference rendait le texte invisible sur les
           gris moyens (128 − 128 ≈ 0). */
        .sav-label.sav-hidden { visibility: hidden; transition: none; }
        .sav-label.sav-persistent {
            font-size: 10px;
            font-weight: 600;
            opacity: .95;
            text-shadow: -1px -1px 0 rgba(0,0,0,.7), 1px -1px 0 rgba(0,0,0,.7),
                         -1px 1px 0 rgba(0,0,0,.7), 1px 1px 0 rgba(0,0,0,.7),
                         0 0 3px rgba(0,0,0,.9);
            left: auto; right: 6px; top: 6px;
        }
    `;
    (document.head || document.documentElement).appendChild(st);
}

/* ---------- Toutes les vidéos, y compris dans les Shadow DOM ----------
   Certains lecteurs (Web Components : Reddit…) cachent leur <video> dans un
   shadow root : getElementsByTagName ne le voit pas. On mémorise les shadow
   roots trouvés (même FERMÉS : Firefox expose openOrClosedShadowRoot aux
   extensions) et on les observe comme le document. */
const roots = new Set();
function scanRoots() {
    const visit = root => {
        for (const el of root.querySelectorAll('*')) {
            let sr = null;
            try { sr = el.openOrClosedShadowRoot || el.shadowRoot; } catch (e) {}
            if (sr && !roots.has(sr)) {
                roots.add(sr);
                if (typeof obs !== 'undefined') obs.observe(sr, { childList: true, subtree: true });
                visit(sr);
            }
        }
    };
    for (const r of roots) if (!r.host.isConnected) roots.delete(r);
    visit(document);
    for (const r of Array.from(roots)) visit(r);
}
function allVideos() {
    const out = Array.from(document.getElementsByTagName('video'));
    for (const r of roots) if (r.host.isConnected) out.push(...r.querySelectorAll('video'));
    return out;
}
// Parent « à travers » les shadow roots (parentElement s'arrête à leur bord).
const up = a => a.parentElement || (a.getRootNode && a.getRootNode().host) || null;
const holds = (a, t) => { for (let x = t; x; x = up(x)) if (x === a) return true; return false; };

/* ---------- Plein écran ----------
   Seul l'élément en plein écran (et son contenu) est affiché : nos overlays,
   posés dans <body>, devenaient invisibles. On les range DANS l'élément plein
   écran (sauf si c'est la <video> elle-même : rien ne peut s'y superposer). */
function host() {
    const fs = document.fullscreenElement;
    return fs && fs.tagName !== 'VIDEO' ? fs : (document.body || document.documentElement);
}
function rehome() {
    const h = host();
    document.querySelectorAll('.sav-overlay').forEach(o => {
        if (o.getAttribute('data-sav-owner') === String(ME) && o.parentNode !== h) h.appendChild(o);
    });
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
        host().appendChild(o);
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
        if (!el || el === target || holds(el, target) && el !== document.body || holds(target, el)) break;
        let cover = null;
        for (let a = el; a && a !== document.body; a = up(a)) {
            if (holds(a, target)) break; // conteneur de la vidéo (lecteur…) : pas un masque
            const p = getComputedStyle(a).position;
            if (p === 'fixed' || p === 'sticky') { cover = a; break; }
        }
        if (!cover) break;
        y = cover.getBoundingClientRect().bottom + 1;
    }
    return Math.max(r.top, y - 4);
}

/* Partie de la cible réellement visible : rognée par la fenêtre et par chaque
   ancêtre qui coupe son contenu (overflow ≠ visible). Ex : Civitai fait défiler
   un <div> interne sous son en-tête — la vidéo y est rognée, mais notre overlay
   (position:fixed) ne l'était pas et débordait sur l'en-tête. */
function clipRect(target) {
    const r = target.getBoundingClientRect();
    let top = Math.max(r.top, 0), left = Math.max(r.left, 0);
    let bottom = Math.min(r.bottom, innerHeight), right = Math.min(r.right, innerWidth);
    for (let a = up(target); a && a !== document.documentElement; a = up(a)) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const ar = a.getBoundingClientRect();
            if (cs.overflowY !== 'visible') { top = Math.max(top, ar.top); bottom = Math.min(bottom, ar.bottom); }
            if (cs.overflowX !== 'visible') { left = Math.max(left, ar.left); right = Math.min(right, ar.right); }
        }
        if (cs.position === 'fixed') break; // au-delà, les ancêtres ne rognent plus
    }
    return { top, left, bottom, right };
}

function place(o, target) { // cale l'overlay sur la partie visible de la cible
    const c = clipRect(target);
    const top = c.bottom > c.top ? visibleTop(target, c) : c.top;
    const h = c.bottom - top, w = c.right - c.left;
    o.style.visibility = h < 20 || w < 40 ? 'hidden' : ''; // cible (quasi) masquée : pas de badge
    o.style.width = Math.max(0, w) + 'px';
    o.style.height = Math.max(0, h) + 'px';
    o.style.top = top + 'px';
    o.style.left = c.left + 'px';
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
    allVideos().forEach(v => { if (v._savOverlay) fit(v); });
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
        allVideos().some(visible);
    const box = hasVideo ? null : findPlayer();
    let b = document.getElementById('sav-global');

    // Option « badge permanent » désactivée : même le badge du lecteur se masque.
    if (hideBadge) {
        if (b && b.style.display !== 'none') b.style.display = 'none';
        return;
    }
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
// Capture sur document : attrape AUSSI le défilement des conteneurs internes
// (scroll ne remonte pas). Regroupé par image (rAF) : un fil d'actualité peut
// compter des dizaines de vidéos.
let refitting = false;
const refit = () => {
    if (refitting) return;
    refitting = true;
    requestAnimationFrame(() => { refitting = false; if (!dead) { fitAll(); globalBadge(lastSet); } });
};
on(document, 'scroll', refit, { passive: true, capture: true });
on(window, 'resize', refit);

/* ---------- Application de la vitesse ---------- */
function setRate(v, s) {
    // Épisode suivant / nouvelle source : load() remet playbackRate à
    // defaultPlaybackRate (1 par défaut) → la détection prenait ce 1x pour un
    // choix du site. Avec defaultPlaybackRate = notre vitesse, elle survit.
    if (v.defaultPlaybackRate !== s) { try { v.defaultPlaybackRate = s; } catch (e) {} }
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

// Badge permanent masqué (option hideBadge) — jamais pendant un flash.
// Classe sans transition : la transition « all » du label retardait de 0,35 s
// le passage à visibility:hidden (le badge restait visible).
function badgeState(v) {
    const l = v._savLabel;
    if (l) l.classList.toggle('sav-hidden', hideBadge && !l.classList.contains('sav-flash'));
}

function endFlash(v) { // flash → badge permanent
    const l = v._savLabel;
    clearTimeout(v._savFlashTimer);
    if (!l) return;
    l.classList.remove('sav-flash');
    l.classList.add('sav-persistent');
    badgeState(v);
    fit(v);
}

function show(v, s, flash) { // badge d'une vidéo : visible selon l'option hideBadge
    const o = overlayOf(v);
    const l = v._savLabel;
    const text = `Speed ${s}x`;
    if (o.style.display !== 'block') o.style.display = 'block';
    if (l.textContent !== text) l.textContent = text; // pas de re-mutation inutile

    if (flash && !hideFlash) {
        l.classList.remove('sav-persistent');
        l.classList.add('sav-flash');
        fit(v); // recentre immédiatement
        clearTimeout(v._savFlashTimer);
        v._savFlashTimer = setTimeout(() => endFlash(v), 500);
    } else if (!l.classList.contains('sav-flash')) {
        l.classList.add('sav-persistent');
    }
    badgeState(v);
}

function apply(spd, flash = false) {
    const videos = allVideos();
    let changed = 0;
    const passive = neutral && !force1x; // neutre : on affiche sans écrire
    Array.from(videos).forEach(v => {
        if (ignored(v)) return;
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
        if (dead || v._savHold) return;
        if (!force1x) { // 1.0 autonome du lecteur : rétabli tout de suite (sinon jusqu'à 1 s à 1x)
            const r = round2(v.playbackRate);
            if (!neutral && ready && Math.abs(r - lastSet) >= 0.001 && !siteMayAdopt(v, r)) {
                const t = setTimeout(() => { if (!dead && !force1x) apply(lastSet); }, 0);
                timers.push(t);
            }
            return;
        }
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

/* ---------- Intention de l'utilisateur (idée reprise de Video Speed Controller) ----------
   Les lecteurs ÉCRIVENT 1.0 d'eux-mêmes en s'initialisant (bande-annonce
   Netflix au survol, nouvelle vidéo YouTube, pub…) : adopter ce 1.0 faisait
   passer TOUT le plugin à 1x. Règles :
   - vitesse ≠ 1.0 posée par le site → adoptée (aucun site ne passe seul à
     1.7x ; c'est aussi YouTube qui restaure la vitesse de l'utilisateur) ;
   - retour à exactement 1.0 → adopté seulement avec une preuve d'intention :
     touche du lecteur (ex : YouTube Maj+<) juste avant, ou DEUX clics
     rapprochés (menu de vitesse → « Normal ») hors réinitialisation du média ;
   - sinon : bruit d'initialisation → on rétablit notre vitesse. */
const INIT_GRACE_MS = 2000;   // après loadstart/loadedmetadata : 1.0 = bruit d'init
const GESTURE_MS = 1000;      // le changement doit suivre de près le geste
const CLICK_SEQ_MS = 5000;    // deux clics de menu en moins de 5 s
let lastClickAt = 0, prevClickAt = 0, lastKeyAt = 0;
on(document, 'pointerdown', () => { prevClickAt = lastClickAt; lastClickAt = performance.now(); }, true);
on(document, 'keydown', e => { if (!/^[sdr]$/i.test(e.key)) lastKeyAt = performance.now(); }, true); // pas nos raccourcis
const markInit = e => { if (e.target && e.target.tagName === 'VIDEO') e.target._savInitAt = performance.now(); };
['loadstart', 'loadedmetadata'].forEach(t => on(document, t, markInit, true));

function siteMayAdopt(v, r) {
    if (Math.abs(r - 1) >= 0.005) return true;
    const now = performance.now();
    if (now - lastKeyAt < GESTURE_MS) return true;
    const seq = now - lastClickAt < GESTURE_MS && lastClickAt - prevClickAt < CLICK_SEQ_MS && prevClickAt > 0;
    const init = now - (v._savInitAt || 0) < INIT_GRACE_MS;
    return seq && !init;
}

// Netflix : aperçus / bandes-annonces de la page d'accueil (comme VSC)
const ignored = v => location.hostname === 'www.netflix.com' &&
    (v.classList.contains('preview-video') || !!(v.parentElement && v.parentElement.classList.contains('billboard-row')));

/* ---------- Détection de la vitesse choisie dans le lecteur du site ----------
   L'utilisateur change la vitesse depuis le menu du site (YouTube…) : on suit
   cette valeur, c'est elle qui sera restaurée à la désactivation de Force 1x.
   On ignore nos propres écritures récentes (lastSet) pour éviter les
   allers-retours. Renvoie la vitesse à appliquer : celle détectée si le site
   en a posé une, sinon lastSet — jamais l'ancienne valeur mémoire qui
   écraserait un changement clavier encore frais. */
function detect() {
    for (const v of allVideos()) {
        if (!visible(v) || ignored(v)) continue;
        let rate = v.playbackRate;
        try { rate = v.getPlaybackRate ? v.getPlaybackRate() : rate; } catch (e) {}
        if (v.seeking) continue; // YouTube force 1x pendant un seek : état instable
        const r = round2(rate);
        // Notre propre valeur posée récemment → pas de re-détection. Au-delà
        // de la fenêtre, une même valeur lue est considérée comme venue du site.
        if (Math.abs(r - lastSet) < 0.001) return lastSet; // notre propre valeur : rien à détecter
        if (!siteMayAdopt(v, r)) return lastSet; // 1.0 de (ré)initialisation : on rétablit
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
    for (const v of allVideos()) {
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
    scanRoots(); // nouveaux lecteurs en Shadow DOM
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
        (n.tagName === 'VIDEO' || n.getElementsByTagName('video').length || n.shadowRoot);
    if (ms.some(m => Array.from(m.removedNodes).some(hasVideo))) fitAll(); // vidéo retirée → overlay orphelin nettoyé
    const relevant = ms.some(m => Array.from(m.addedNodes).some(n => hasVideo(n) && !n.closest('.sav-overlay')));
    if (!relevant || pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        scanRoots(); // un lecteur Web Component a pu apparaître
        if (ready) apply(force1x ? 1.0 : speed); // pas avant le chargement du stockage
    });
});
obs.observe(document.body, { childList: true, subtree: true });
scanRoots();

/* Vidéo créée ou chargée par JS sans passer par une mutation visible
   (lecteur recyclé, élément inséré puis rempli…) : ses événements de média
   arrivent en capture sur document → prise en charge immédiate, sans
   attendre le tour de boucle. Uniquement les vidéos pas encore vues : une
   reprise de lecture ne doit pas écraser une vitesse choisie par le site. */
const kick = e => {
    const v = e.target;
    if (dead || !ready || !v || v.tagName !== 'VIDEO' || v._savOverlay) return;
    apply(force1x ? 1.0 : speed);
};
['loadedmetadata', 'play', 'playing'].forEach(t => on(document, t, kick, true));
on(document, 'fullscreenchange', () => { rehome(); fitAll(); });

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
browser.storage.sync.get(['forceOneX', 'speedStep', 'defaultSpeed', 'hideBadge', 'hideFlash', 'soundFx']).then(res => {
    soundFx = res.soundFx !== false;
    force1x = !!res.forceOneX;
    hideBadge = !!res.hideBadge;
    hideFlash = !!res.hideFlash;
    const s = parseFloat(res.speedStep);
    if (s > 0 && s <= MAX) step = s;
    if (res.defaultSpeed) speed = clamp(res.defaultSpeed);
    // 1re install (aucune vitesse mémorisée) : neutre, on ne force pas 1x.
    neutral = !res.defaultSpeed && !force1x;
    // Chargement de page : si le site a DÉJÀ posé sa vitesse (YouTube restaure
    // la sienne, ex : 0.25x), on l'adopte au lieu de l'écraser avec la mémoire.
    if (!REINJ && !force1x) {
        const v = allVideos()
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
    if (changes.soundFx) soundFx = changes.soundFx.newValue !== false;
    if (changes.hideBadge || changes.hideFlash) {
        if (changes.hideBadge) {
            hideBadge = !!changes.hideBadge.newValue;
            // Activée pendant un flash : on l'arrête tout de suite (sinon il
            // laissait place au badge qu'on vient justement de masquer).
            if (hideBadge) allVideos().forEach(v => {
                if (v._savLabel && v._savLabel.classList.contains('sav-flash')) endFlash(v);
            });
        }
        if (changes.hideFlash) hideFlash = !!changes.hideFlash.newValue;
        // Ré-applique immédiatement : met à jour les labels, et si le badge
        // réapparaît pendant un flash en cours, celui-ci reste (le timer le
        // remettra en badge permanent).
        if (ready) apply(force1x ? 1.0 : speed);
    }
});

/* ---------- Signal sonore (façon jeu vidéo, cf. sound.js) ----------
   Un « blip » qui GLISSE de l'ancienne vitesse vers la nouvelle : la hauteur
   suit la vitesse (1x = la 440 Hz, 2x = octave au-dessus, 0.5x = en dessous).
   Repère quand rien ne peut s'afficher (la <video> elle-même en plein écran)
   ou si l'utilisateur l'a activé. Joué seulement sur un raccourci : c'est un
   geste utilisateur (sinon l'audio est bloqué) et une seule frame le reçoit. */
// blip() : défini dans sound.js (chargé avant content.js, cf. manifest)
const videoFullscreen = () => { const f = document.fullscreenElement; return !!f && f.tagName === 'VIDEO'; };

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
    if ((soundFx || videoFullscreen()) && typeof blip === 'function') blip(next, force1x ? 1.0 : speed);
    neutral = false;
    browser.runtime.sendMessage({ action: 'setSpeed', speed: next }); // le background re-diffuse à tous les onglets
    apply(next, true); // on pose la valeur MAINTENANT : sinon la boucle la verrait comme « posée par le site »
}, true);

/* Re-apply quand l'onglet redevient visible */
on(document, 'visibilitychange', () => {
    if (!dead && !document.hidden) apply(force1x ? 1.0 : speed);
});
