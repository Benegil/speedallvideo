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
        }
        /* État "permanent" : 10px en haut à droite, fusion avec le fond */
        .sav-label.sav-persistent {
            font-size: 10px;
            font-weight: 600;
            opacity: 0.85;
            mix-blend-mode: difference; /* la "fusion" : texte toujours lisible sur n'importe quel fond */
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

// Recadre l'overlay sur la vidéo et recentre le label s'il est en mode flash.
function positionOverlay(video) {
    const overlay = video._savOverlay;
    if (!overlay) return;
    const rect = video.getBoundingClientRect();
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';

    const label = video._savLabel;
    if (label.classList.contains('sav-flash')) {
        // centré tant que le flash est actif
        label.style.left = '50%';
        label.style.top = '50%';
        label.style.transform = 'translate(-50%, -50%)';
    } else {
        // coin haut-droit, 10px
        label.style.left = '';
        label.style.right = '6px';
        label.style.top = '6px';
        label.style.transform = '';
    }
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
        } catch (error) {
            console.error(`Error setting playback rate for video:`, error);
        }
    }
}

function applySpeedToAllVideos(speed, showFlash = false) {
    const videos = document.getElementsByTagName('video');
    console.log(`Applying playback speed ${speed} to ${videos.length} video(s)`);
    Array.from(videos).forEach(video => {
        setVideoSpeed(speed, video);
        updateLabel(video, speed, showFlash);
    });
    positionAllOverlays();
}

// Met à jour l'affichage de la vitesse pour une vidéo.
function updateLabel(video, speed, flash) {
    const overlay = getOverlay(video);
    const label = video._savLabel;
    const text = `Speed ${speed}x`;

    if (speed === 1) {
        // Vitesse normale : on masque tout
        overlay.style.display = 'none';
        return;
    }
    overlay.style.display = 'block';
    label.textContent = text;

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

// Observe DOM changes to catch new video elements
const observer = new MutationObserver(mutations => {
    applySpeedToAllVideos(currentSpeed);
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

// Reapply speed when the page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('Page became visible, reapplying saved speed');
        applySpeedToAllVideos(currentSpeed);
    }
});
