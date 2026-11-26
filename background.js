let currentSpeed = 1.0;

const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const SPEED_STEP = 0.25; // pas des raccourcis clavier

function clampSpeed(s) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}

/* ---------- Icône dynamique : cadre blanc arrondi, texte plein cadre ----------
   - Le cadre utilise TOUTE la surface (plus de cercle).
   - Cadre blanc 1px, léger border-radius.
   - Le texte occupe toute la hauteur du cadre moins 1px haut et bas.
   - Si le label fait plus de 2 caractères, il défile horizontalement dans le cadre. */

function drawSpeedIcon(size, speed, offset) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fond sombre sur toute la surface + cadre blanc 1px légèrement arrondi.
    const radius = Math.max(2, Math.round(size * 0.15));
    const path = () => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0.5, 0.5, size - 1, size - 1, radius);
        else ctx.rect(0.5, 0.5, size - 1, size - 1);
    };
    path();
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    path();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Texte : hauteur = cadre − 1px haut et bas.
    const label = `${speed}x`; // ex: "2x", "0.75x"
    let fontSize = Math.max(4, size - 2);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const metrics = ctx.measureText(label);
    const textW = metrics.width;

    ctx.save();
    path();
    ctx.clip(); // le texte défile à l'intérieur du cadre
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (label.length <= 2) {
        // Label court : centré, pas de défilement.
        ctx.fillText(label, (size - textW) / 2, size / 2);
    } else {
        // Défilement horizontal : le label traverse le cadre et recommence.
        const innerW = size - 2;
        const period = textW + innerW;
        let x = innerW - (offset % period);
        if (x < -textW) x += period;
        ctx.fillText(label, x, size / 2);
    }
    ctx.restore();
    return canvas.toDataURL('image/png');
}

let iconAnimTimer = null;
let iconAnimPhase = 0;

function stopIconAnim() {
    if (iconAnimTimer) { clearInterval(iconAnimTimer); iconAnimTimer = null; }
}

async function updateActionIcon() {
    const speed = Math.round(currentSpeed * 100) / 100;
    if (speed === 1.0) {
        // Vitesse normale : X simple, pas d'animation
        stopIconAnim();
        await browser.browserAction.setIcon({ path: { 32: 'icon32.png', 48: 'icon48.png' } });
        return;
    }
    const label = `${speed}x`;
    if (label.length <= 2) {
        // "2x", "4x"… : icône statique, pas de défilement.
        stopIconAnim();
        try {
            await browser.browserAction.setIcon({
                path: {
                    16: drawSpeedIcon(16, speed, 0),
                    32: drawSpeedIcon(32, speed, 0),
                    48: drawSpeedIcon(48, speed, 0)
                }
            });
        } catch (e) { /* onglet en cours de fermeture etc. */ }
        return;
    }
    // Label long : défilement continu dans le cadre (~20 img/s).
    if (!iconAnimTimer) {
        iconAnimTimer = setInterval(async () => {
            iconAnimPhase += 1.4;
            try {
                await browser.browserAction.setIcon({
                    path: {
                        16: drawSpeedIcon(16, speed, iconAnimPhase),
                        32: drawSpeedIcon(32, speed, iconAnimPhase),
                        48: drawSpeedIcon(48, speed, iconAnimPhase)
                    }
                });
            } catch (e) { /* onglet en cours de fermeture etc. */ }
        }, 50);
    }
}

/* ---------- Diffusion de la vitesse à tous les onglets ---------- */

function broadcastSpeedToAllTabs() {
    console.log("Broadcasting speed to all tabs:", currentSpeed);
    browser.tabs.query({})
        .then(allTabs => {
            return Promise.all(allTabs.map(tab =>
                browser.tabs.sendMessage(tab.id, {action: 'setSpeed', speed: currentSpeed})
                    .catch(err => console.log(`Error sending to tab ${tab.id}:`, err))
            ));
        })
        .then(() => console.log("Speed broadcast complete"))
        .catch(error => console.error("Error in speed broadcast:", error));
}

/* ---------- Messages ---------- */

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setSpeed') {
        currentSpeed = clampSpeed(message.speed);
        broadcastSpeedToAllTabs();
        // Store the speed in sync storage
        browser.storage.sync.set({defaultSpeed: currentSpeed});
        updateActionIcon();
    } else if (message.action === 'getCurrentSpeed') {
        sendResponse({speed: currentSpeed});
    }
});

// Initialize speed from storage
browser.storage.sync.get('defaultSpeed').then((result) => {
    if (result.defaultSpeed) {
        currentSpeed = clampSpeed(result.defaultSpeed); // au cas où une ancienne valeur > MAX_SPEED
        broadcastSpeedToAllTabs();
        updateActionIcon();
    }
});

// Set initial speed for new tabs
browser.tabs.onCreated.addListener((tab) => {
    browser.tabs.sendMessage(tab.id, {action: 'setSpeed', speed: currentSpeed})
        .catch(err => console.log(`Error sending initial speed to new tab ${tab.id}:`, err));
});
