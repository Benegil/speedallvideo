importScripts('compat.js');
/* SpeedAllVideo — background : vitesse courante, icône dynamique, diffusion aux onglets */
const MIN = 0.25;
const MAX = 4;

let speed = 1.0;   // vitesse courante (partagée par tous les onglets)
let chosen = false; // une vitesse a-t-elle déjà été choisie ? (sinon : neutre, 1re install)
let iconSpeed = 1; // lue à chaque image de l'animation → suit les changements en direct

const clamp = s => Math.min(MAX, Math.max(MIN, s));
const round2 = s => Math.round(s * 100) / 100;

/* ---------- Icône : cadre blanc arrondi plein cadre, label centré ou défilant ---------- */
function drawIcon(size, spd, off) {
    const c = new OffscreenCanvas(size, size); // pas de document dans un service worker
    c.width = c.height = size;
    const x = c.getContext('2d');
    const r = Math.max(2, Math.round(size * 0.15));
    const box = () => {
        x.beginPath();
        if (x.roundRect) x.roundRect(0.5, 0.5, size - 1, size - 1, r);
        else x.rect(0.5, 0.5, size - 1, size - 1);
    };
    box(); x.fillStyle = '#1e1e1e'; x.fill();
    box(); x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke();

    const label = `${spd}x`;
    x.font = `bold ${Math.max(4, size - 2)}px sans-serif`; // hauteur = cadre − 1px haut/bas
    const tw = x.measureText(label).width;
    x.save(); box(); x.clip();
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
    if (label.length <= 2) {
        x.fillText(label, (size - tw) / 2, size / 2); // court : centré, statique
    } else {
        const inner = size - 2, period = tw + inner;
        let px = inner - (off % period);
        if (px < -tw) px += period;
        x.fillText(label, px, size / 2); // long : défilement continu dans le cadre
    }
    x.restore();
    return x.getImageData(0, 0, size, size);
}

let iconTimer = null;
let phase = 0;

function setIcon(spd) {
    const label = `${spd}x`;
    if (label.length <= 2 && iconTimer) { // statique : on stoppe l'animation
        clearInterval(iconTimer);
        iconTimer = null;
    }
    if (!iconTimer && label.length > 2) {
        iconTimer = setInterval(() => {
            phase += 1.4;
            setIcon(iconSpeed); // ~20 img/s, toujours la vitesse courante
        }, 50);
    }
    try {
        browser.action.setIcon({ imageData: {
            16: drawIcon(16, spd, phase),
            32: drawIcon(32, spd, phase),
            48: drawIcon(48, spd, phase)
        } }).catch(() => {});
    } catch (e) { /* onglet en cours de fermeture etc. */ }
}

/* ---------- Diffusion à tous les onglets ---------- */
function broadcast() {
    browser.tabs.query({}).then(tabs => Promise.all(
        tabs.map(t => browser.tabs.sendMessage(t.id, { action: 'setSpeed', speed })
            .catch(() => {}))
    )).catch(() => {});
}

/* ---------- Messages ---------- */
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    loaded.then(() => {
        if (msg.action === 'setSpeed') {
            speed = clamp(msg.speed);
            chosen = true;
            broadcast();
            browser.storage.sync.set({ defaultSpeed: speed });
            iconSpeed = round2(speed);
            setIcon(iconSpeed);
        } else if (msg.action === 'getCurrentSpeed') {
            sendResponse({ speed });
        }
    });
    return msg.action === 'getCurrentSpeed'; // true = réponse asynchrone (obligatoire en Chrome)
});

/* Init (à chaque réveil du service worker) : on recharge la vitesse du stockage
   puis on redessine TOUJOURS l'icône. « loaded » permet de répondre juste. */
const loaded = browser.storage.sync.get('defaultSpeed').then(res => {
    if (res.defaultSpeed) {
        speed = clamp(res.defaultSpeed);
        chosen = true;
    }
    iconSpeed = round2(speed);
    setIcon(iconSpeed);
});

/* À l'installation ou à la mise à jour, on diffuse une fois */
browser.runtime.onInstalled.addListener(() => loaded.then(() => { if (chosen) broadcast(); }));

/* Vitesse initiale pour les nouveaux onglets */
browser.tabs.onCreated.addListener(tab => {
    loaded.then(() => {
        if (!chosen) return; // 1re install : pas de 1x imposé aux nouveaux onglets
        browser.tabs.sendMessage(tab.id, { action: 'setSpeed', speed }).catch(() => {});
    });
});
