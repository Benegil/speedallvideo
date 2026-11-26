let currentSpeed = 1.0;

const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const SPEED_STEP = 0.25; // pas des raccourcis clavier

function clampSpeed(s) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
}

// Ajuste la vitesse d'un incrément (dir: +1 ou -1), arrondit au quart.
function adjustSpeed(dir) {
    currentSpeed = Math.round(clampSpeed(currentSpeed + dir * SPEED_STEP) * 4) / 4;
    broadcastSpeedToAllTabs();
    browser.storage.sync.set({ defaultSpeed: currentSpeed });
    updateActionIcon();
}

/* ---------- Icône dynamique : affiche la vitesse quand elle n'est pas 1x ---------- */

const iconCache = {}; // vitesse -> {32, 48} (data URLs)

function drawSpeedIcon(size, speed) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const base = new Image();
    base.src = browser.runtime.getURL(`icon${size}.png`);
    return new Promise(resolve => {
        base.onload = () => {
            ctx.drawImage(base, 0, 0, size, size);
            const label = String(speed); // plus de "x" : l'icône en est déjà une
            // Taille doublée par rapport à la v1 ; rétrécie si le texte déborde.
            let fontSize = Math.floor(size * 0.84);
            ctx.font = `bold ${fontSize}px sans-serif`;
            const pad = Math.max(2, Math.floor(fontSize * 0.2));
            let textWidth = ctx.measureText(label).width;
            const maxW = size - pad * 2 - 2;
            if (textWidth > maxW) {
                fontSize = Math.max(8, Math.floor(fontSize * maxW / textWidth));
                ctx.font = `bold ${fontSize}px sans-serif`;
                textWidth = ctx.measureText(label).width;
            }
            const boxW = textWidth + pad * 2;
            const boxH = fontSize + pad;

            // Fond sombre semi-transparent en bas à droite pour la lisibilité
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(size - boxW - 1, size - boxH - 1, boxW + 1, boxH + 1);

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(label, size - pad, size - pad);
            resolve(canvas.toDataURL('image/png'));
        };
    });
}

async function updateActionIcon() {
    const speed = Math.round(currentSpeed * 100) / 100;
    if (speed === 1.0) {
        // Vitesse normale : icône d'origine, pas de badge
        await browser.browserAction.setIcon({ path: { 32: 'icon32.png', 48: 'icon48.png' } });
        return;
    }
    if (!iconCache[speed]) {
        iconCache[speed] = {
            32: await drawSpeedIcon(32, speed),
            48: await drawSpeedIcon(48, speed)
        };
    }
    await browser.browserAction.setIcon({ path: { 32: iconCache[speed][32], 48: iconCache[speed][48] } });
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

/* ---------- Raccourcis clavier : Super+Alt+Fleche droite / gauche ---------- */

browser.commands.onCommand.addListener(command => {
    if (command === 'speed-up') adjustSpeed(1);
    else if (command === 'speed-down') adjustSpeed(-1);
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
