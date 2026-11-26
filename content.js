let currentSpeed = 1.0;

/* ================= Anti double-injection =================
   À chaque rechargement de l'extension, Firefox ré-exécute ce script dans les
   onglets déjà ouverts SANS tuer l'ancienne instance : les deux cohabitent et
   affichent chacune son overlay (le « fantôme » qui garde la vitesse en cours
   au moment du rechargement). On repère l'instance active par une marque sur
   <html> ; les instances obsolètes s'éteignent seules (timers, listeners,
   overlays qu'elles possèdent). */
const SAV_INSTANCE = Symbol('sav-instance');
document.documentElement.setAttribute('data-sav-active', String(SAV_INSTANCE));

const _savIntervals = [];
const _savListeners = [];
let _savDead = false;

function savInterval(fn, ms) {
    const id = setInterval(() => { if (!_savDead) fn(); }, ms);
    _savIntervals.push(id);
    return id;
}
function savListener(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    _savListeners.push([target, type, fn, opts]);
}

// L'instance qui se sait dépassée s'éteint : plus rien d'elle ne tourne.
savInterval(() => {
    if (_savDead || document.documentElement.getAttribute('data-sav-active') === String(SAV_INSTANCE)) return;
    _savDead = true;
    console.log('SpeedAllVideo : instance obsolète, désactivation');
    _savIntervals.forEach(id => clearInterval(id));
    _savListeners.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
    // On ne supprime que ce qui est À CETTE instance (les overlays sont
    // partagés via video._savOverlay avec l'instance qui prend la suite).
    document.querySelectorAll('.sav-overlay').forEach(el => {
        if (el.getAttribute('data-sav-owner') === String(SAV_INSTANCE)) el.remove();
    });
    const st = document.getElementById(STYLE_ID);
    if (st && st.getAttribute('data-sav-owner') === String(SAV_INSTANCE)) st.remove();
}, 250);

/* ================= Styles injectés (overlay de vitesse) ================= */

const STYLE_ID = 'sav-style';
if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-sav-owner', String(SAV_INSTANCE));
    style.textContent = `
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
        /* État "flash" : gros, au centre */
        .sav-label.sav-flash {
            font-size: clamp(28px, 7vw, 72px);
            font-weight: 800;
            letter-spacing: 1px;
            text-shadow: 0 2px 14px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6);
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        }
        /* État "permanent" : 10px en haut à droite, fusion avec le fond */
        .sav-label.sav-persistent {
            font-size: 10px;
            font-weight: 600;
            opacity: 0.85;
            mix-blend-mode: difference; /* la "fusion" : texte toujours lisible sur n'importe quel fond */
            left: auto;
            right: 6px;
            top: 6px;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

/* ================= Gestion des overlays ================= */

function getOverlay(video) {
    let overlay = video._savOverlay;
    // Overlay hérité d'une instance morte : on le reprend en propre.
    if (overlay && overlay.getAttribute('data-sav-owner') !== String(SAV_INSTANCE)) {
        overlay.setAttribute('data-sav-owner', String(SAV_INSTANCE));
        const label = overlay.querySelector('.sav-label');
        video._savLabel = label;
    }
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sav-overlay';
        overlay.setAttribute('data-sav-owner', String(SAV_INSTANCE));
        overlay.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;overflow:hidden;';

        const label = document.createElement('span');
        label.className = 'sav-label sav-persistent';
        overlay.appendChild(label);
        (document.body || document.documentElement).appendChild(overlay);
        video._savOverlay = overlay;
        video._savLabel = label;
    }
    return overlay;
}

// Recadre l'overlay sur la vidéo (le positionnement du label est géré par CSS).
function positionOverlay(video) {
    const overlay = video._savOverlay;
    if (!overlay || overlay.style.display === 'none') return;
    const rect = video.getBoundingClientRect();
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
}

// Recadre tous les overlays (appelé par l'intervalle + au scroll/resize).
function positionAllOverlays() {
    const videos = document.getElementsByTagName('video');
    Array.from(videos).forEach(video => {
        if (video._savOverlay) positionOverlay(video);
    });
}

/* ================= Badge global (aucune <video> visible, mais un lecteur) =
   Ex : YouTube n'insère son élément <video> qu'au clic sur Play. Tant qu'il
   n'y a pas de vidéo VISIBLE mais qu'un conteneur de lecteur connu existe,
   on affiche la vitesse en haut à droite DE CE CONTENEUR (pas de l'écran, pour
   ne pas polluer les pages sans vidéo). Dès qu'une vidéo apparaît, le badge
   par-vidéo prend le relais. */
const PLAYER_SELECTORS = [
    '#movie_player',              // YouTube
    '.html5-video-player',        // YouTube (repli)
    '.video-js',                  // Video.js
    '.player_vimeo_video',        // Vimeo
    'div[class*="video-player"]'  // lecteurs génériques
];

function findPlayerContainer() {
    for (const sel of PLAYER_SELECTORS) {
        let els;
        try { els = document.querySelectorAll(sel); } catch (e) { continue; }
        for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return el;
        }
    }
    return null;
}

function updateGlobalBadge(speed) {
    // Une « vidéo visible » = un <video> avec une surface réelle.
    const hasVideo = Array.from(document.getElementsByTagName('video')).some(v => {
        const r = v.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    });
    const container = hasVideo ? null : findPlayerContainer();
    let badge = document.getElementById('sav-global');

    if (!container) {
        if (badge && badge.style.display !== 'none') badge.style.display = 'none';
        return;
    }
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'sav-global';
        badge.className = 'sav-overlay';
        badge.setAttribute('data-sav-owner', String(SAV_INSTANCE));
        badge.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;overflow:hidden;';
        const label = document.createElement('span');
        label.className = 'sav-label sav-persistent';
        badge.appendChild(label);
        (document.body || document.documentElement).appendChild(badge);
    }
    // Recadrage sur le conteneur + texte
    const r = container.getBoundingClientRect();
    badge.style.width = r.width + 'px';
    badge.style.height = r.height + 'px';
    badge.style.top = r.top + 'px';
    badge.style.left = r.left + 'px';
    const label = badge.querySelector('.sav-label');
    const text = `Speed ${speed}x`;
    if (label.textContent !== text) label.textContent = text;
    if (badge.style.display !== 'block') badge.style.display = 'block';
}

// Recadre le badge global au scroll/resize (le conteneur peut bouger).
function positionGlobalBadge() {
    const badge = document.getElementById('sav-global');
    if (!badge || badge.style.display === 'none') return;
    const container = findPlayerContainer();
    if (!container) { badge.style.display = 'none'; return; }
    const r = container.getBoundingClientRect();
    badge.style.width = r.width + 'px';
    badge.style.height = r.height + 'px';
    badge.style.top = r.top + 'px';
    badge.style.left = r.left + 'px';
}

savListener(window, 'scroll', () => { positionAllOverlays(); positionGlobalBadge(); }, { passive: true });
savListener(window, 'resize', () => { positionAllOverlays(); positionGlobalBadge(); });

/* ================= Application de la vitesse ================= */

function setVideoSpeed(speed, video) {
    if (video.playbackRate !== speed) {
        try {
            video.playbackRate = speed;
            console.log(`Set playback rate for video to ${speed}`);
            return true; // la vitesse a changé
        } catch (error) {
            console.error(`Error setting playback rate for video to ${speed}`, error);
        }
    }
    return false;
}

function applySpeedToAllVideos(speed, showFlash = false) {
    const videos = document.getElementsByTagName('video');
    let changed = 0;
    Array.from(videos).forEach(video => {
        if (setVideoSpeed(speed, video)) changed++;
        updateLabel(video, speed, showFlash);
    });
    if (changed) console.log(`Applying playback speed ${speed} to ${changed}/${videos.length} video(s)`);
    positionAllOverlays();
    updateGlobalBadge(speed); // badge sur le lecteur tant qu'aucune vidéo visible n'existe
}

// Met à jour l'affichage de la vitesse pour une vidéo.
// Le badge est TOUJOURS visible (même à 1x) : dans un nouvel onglet on sait
// immédiatement à quelle vitesse tourne la vidéo.
function updateLabel(video, speed, flash) {
    const overlay = getOverlay(video);
    const label = video._savLabel;
    const text = `Speed ${speed}x`;

    if (overlay.style.display !== 'block') overlay.style.display = 'block';
    if (label.textContent !== text) label.textContent = text; // évite de re-mutuer le DOM pour rien

    if (flash) {
        // Flash central pendant 500 ms, puis migration en haut à droite
        label.classList.remove('sav-persistent');
        label.classList.add('sav-flash');
        positionOverlay(video); // recentre le label immédiatement
        clearTimeout(video._savFlashTimer);
        video._savFlashTimer = setTimeout(() => {
            label.classList.remove('sav-flash');
            label.classList.add('sav-persistent');
            positionOverlay(video);
        }, 500);
    } else if (!label.classList.contains('sav-flash')) {
        // Simple mise à jour du badge permanent (pas de flash)
        label.classList.add('sav-persistent');
    }
}

/* ================= Boucle & observation ================= */

// Continuously apply speed to all videos
savInterval(() => {
    applySpeedToAllVideos(currentSpeed);
}, 1000);  // Check every second

// Observe DOM changes to catch new video elements.
// On ignore les mutations causées par nos propres overlays (sinon boucle de
// microtâches qui ralentit le navigateur) et on regroupe avec rAF pour ne pas
// réappliquer la vitesse à chaque mutation isolée sur une page animée.
let pendingObserve = false;
const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m => {
        const t = m.target;
        return !(t instanceof Element && t.closest('.sav-overlay'));
    });
    if (!relevant || pendingObserve) return;
    pendingObserve = true;
    requestAnimationFrame(() => {
        pendingObserve = false;
        applySpeedToAllVideos(currentSpeed);
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from the background script
browser.runtime.onMessage.addListener(message => {
    console.log("Received message in content script:", JSON.stringify(message));
    if (message && message.action === 'setSpeed') {
        currentSpeed = message.speed;
        applySpeedToAllVideos(currentSpeed, true); // flash sur chaque changement de vitesse
    }
});

// Initialize on script load
browser.runtime.sendMessage({action: 'getCurrentSpeed'}, (response) => {
    if (response && response.speed) {
        currentSpeed = response.speed;
        applySpeedToAllVideos(currentSpeed); // pas de flash au chargement
    }
});

// Raccourcis clavier (comme Video Speed Controller) :
//   D = accélérer, S = ralentir, R = reset 1.0x
// Gérés ici (et non en "commands" globaux) pour ne pas déclencher
// quand on tape dans un champ de formulaire.
const SPEED_STEP = 0.25;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;

function clampSpeed(s) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}

function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

savListener(document, 'keydown', (e) => {
    // On ignore si un modificateur est tenu (Ctrl/Alt/Meta) ou si on tape dans un champ.
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (isTypingTarget(e.target)) return;

    let newSpeed = null;
    switch (e.key.toLowerCase()) {
        case 'd': newSpeed = clampSpeed(currentSpeed + SPEED_STEP); break;
        case 's': newSpeed = clampSpeed(currentSpeed - SPEED_STEP); break;
        case 'r': newSpeed = 1.0; break;
        default: return;
    }

    e.preventDefault();
    // On notifie le background qui re-diffuse à tous les onglets (et met à jour l'icône + le stockage).
    browser.runtime.sendMessage({ action: 'setSpeed', speed: newSpeed });
}, true);

// Reapply speed when the page becomes visible
savListener(document, 'visibilitychange', () => {
    if (!document.hidden) {
        applySpeedToAllVideos(currentSpeed);
    }
});
