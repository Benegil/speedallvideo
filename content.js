let currentSpeed = 1.0;

/* ================= Styles injectés (overlay de vitesse) ================= */

const STYLE_ID = 'sav-style';
if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
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
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sav-overlay';
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

window.addEventListener('scroll', positionAllOverlays, { passive: true });
window.addEventListener('resize', positionAllOverlays);

/* ================= Application de la vitesse ================= */

function setVideoSpeed(speed, video) {
    if (video.playbackRate !== speed) {
        try {
            video.playbackRate = speed;
            console.log(`Set playback rate for video to ${speed}`);
            return true; // la vitesse a changé
        } catch (error) {
            console.error(`Error setting playback rate for video:`, error);
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
}

// Met à jour l'affichage de la vitesse pour une vidéo.
function updateLabel(video, speed, flash) {
    if (speed === 1) {
        // Vitesse normale : pas d'overlay du tout (zéro coût DOM/layout)
        if (video._savOverlay && video._savOverlay.style.display !== 'none') {
            video._savOverlay.style.display = 'none';
        }
        return;
    }
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
setInterval(() => {
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

document.addEventListener('keydown', (e) => {
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
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        applySpeedToAllVideos(currentSpeed);
    }
});

