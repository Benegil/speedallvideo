let currentSpeed = 1.0;

const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const SPEED_STEP = 0.25; // pas des raccourcis clavier

function clampSpeed(s) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}

/* ---------- Icône dynamique : chiffre en grand, taille animée ---------- */

let iconAnimTimer = null;
let animPhase = 0;
let animSpeed = 1;

function drawSpeedIcon(size, speed, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const base = new Image();
    base.src = browser.runtime.getURL(`icon${size}.png`);
    return new Promise(resolve => {
        base.onload = () => {
            ctx.drawImage(base, 0, 0, size, size);

            // Fond sombre sur tout le cercle : lisible même à 16px dans la barre.
            const r = size / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(r, r, r - Math.max(1, size * 0.03), 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(0, 0, size, size);
            ctx.restore();

            // Texte en grand au centre ; scale (0.55 → 1) anime la taille de police.
            const label = `${speed}x`; // ex: "2x", "0.75x"
            let fontSize = Math.floor(size * 0.85 * scale);
            ctx.font = `bold ${fontSize}px sans-serif`;
            const maxW = size * 0.8;
            const textW = ctx.measureText(label).width;
            if (textW > maxW) {
                fontSize = Math.max(6, Math.floor(fontSize * maxW / textW));
                ctx.font = `bold ${fontSize}px sans-serif`;
            }
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, size / 2, size / 2 + fontSize * 0.05);
            resolve(canvas.toDataURL('image/png'));
        };
    });
}

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
    animSpeed = speed;
    // La taille de police "défile" en douceur entre 55% et 100% :
    // même une valeur longue comme 0.75x passe régulièrement en grand.
    if (!iconAnimTimer) {
        iconAnimTimer = setInterval(async () => {
            animPhase += 0.12;
            const scale = 0.55 + 0.45 * (0.5 + 0.5 * Math.cos(animPhase));
            try {
                await browser.browserAction.setIcon({
                    path: {
                        32: await drawSpeedIcon(32, animSpeed, scale),
                        48: await drawSpeedIcon(48, animSpeed, scale)
                    }
                });
            } catch (e) { /* onglet en cours de fermeture etc. */ }
        }, 50); // ~20 images/s
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
