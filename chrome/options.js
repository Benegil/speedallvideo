/* SpeedAllVideo — options : vitesse, pas de réglage (Speed Step), Force 1x, affichage */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const speedEl = $('speed');
    const slider = $('slider');
    const stepInput = $('stepInput');
    const forceOneX = $('forceOneX');
    const hideBadge = $('hideBadge');
    const hideFlash = $('hideFlash');
    const soundFx = $('soundFx');
    const withAudio = $('withAudio');
    const status = $('status');
    const presets = [...document.querySelectorAll('.preset')];

    const MIN = 0.25;
    const MAX = 4;
    let step = 0.25; // pas de réglage
    let current = 1.0;

    const clamp = s => Math.min(MAX, Math.max(MIN, s));
    const round2 = s => Math.round(s * 100) / 100;

    function render() {
        speedEl.textContent = current.toFixed(2) + 'x';
        slider.value = current;
        presets.forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - current) < 0.001));
    }

    function flash(msg, ms) {
        status.textContent = msg;
        setTimeout(() => { status.textContent = ''; }, ms);
    }

    // Raccourcis : glisser une lettre sur une autre échange les deux (keymap.js)
    initKeyDrag(() => { if (soundFx.checked) blip(current, current); });

    function setSpeed(s) {
        const prev = current;
        current = round2(clamp(s));
        if (soundFx.checked && current !== prev) blip(current, prev); // case « Signal sonore »
        render();
        browser.runtime.sendMessage({ action: 'setSpeed', speed: current }).catch(() => {}); // pas de réponse attendue (Chrome rejette sinon)
        flash(t('speedUpdated'), 750);
    }

    // Le pas pilote les boutons ±, le slider ET les descriptions S/D.
    function applyStep() {
        const s = parseFloat(stepInput.value);
        if (s > 0 && s <= MAX) {
            step = round2(s);
            slider.step = String(step);
            $('slowDesc').textContent = t('slowDown', step);
            $('fastDesc').textContent = t('speedUp', step);
        }
    }

    // Chargement initial depuis le stockage sync (lu par les content scripts)
    applyStep(); // descriptions S/D traduites dès l'ouverture
    browser.storage.sync.get(['speedStep', 'forceOneX', 'hideBadge', 'hideFlash', 'soundFx', 'withAudio']).then(res => {
        if (res.speedStep !== undefined && res.speedStep !== '') {
            stepInput.value = res.speedStep;
            applyStep();
        }
        forceOneX.checked = !!res.forceOneX;
        hideBadge.checked = !!res.hideBadge;
        hideFlash.checked = !!res.hideFlash;
        soundFx.checked = res.soundFx !== false; // activé par défaut
        withAudio.checked = !!res.withAudio;     // désactivé par défaut
    });

    // Vitesse actuelle depuis le background
    browser.runtime.sendMessage({ action: 'getCurrentSpeed' }, res => {
        if (res && res.speed) {
            current = res.speed;
            render();
        }
    });

    slider.addEventListener('input', () => setSpeed(parseFloat(slider.value)));

    $('minus').addEventListener('click', () => setSpeed(current - step));
    $('plus').addEventListener('click', () => setSpeed(current + step));

    presets.forEach(b => b.addEventListener('click', () => setSpeed(parseFloat(b.dataset.speed))));

    // Pas de vitesse : commit au blur, à la validation (Enter) ou après 1 s sans frappe.
    let stepTimer;
    function commitStep() {
        const v = parseFloat(stepInput.value);
        if (!(v > 0 && v <= MAX)) {
            stepInput.value = String(step); // invalide → on restaure l'ancienne valeur
            flash(t('invalidStep'), 1200);
            return;
        }
        browser.storage.sync.set({ speedStep: String(v) });
        applyStep();
        flash(t('stepSaved'), 750);
    }
    stepInput.addEventListener('blur', commitStep);
    stepInput.addEventListener('input', () => { clearTimeout(stepTimer); stepTimer = setTimeout(commitStep, 1000); });
    stepInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitStep(); }
    });

    // Force 1x : sauvegarde dans le stockage sync (lu par les content scripts)
    forceOneX.addEventListener('change', () => {
        browser.storage.sync.set({ forceOneX: forceOneX.checked });
        flash(t(forceOneX.checked ? 'force1xOn' : 'force1xOff'), 750);
    });

    // Affichage : badge permanent / flash central — stockés sync, lus en live par content.js
    hideBadge.addEventListener('change', () => {
        browser.storage.sync.set({ hideBadge: hideBadge.checked });
        flash(t(hideBadge.checked ? 'hideBadgeOn' : 'hideBadgeOff'), 750);
    });
    hideFlash.addEventListener('change', () => {
        browser.storage.sync.set({ hideFlash: hideFlash.checked });
        flash(t(hideFlash.checked ? 'hideFlashOn' : 'hideFlashOff'), 750);
    });

    // Synchro avec l'icône haut-parleur du popup (même réglage)
    browser.storage.onChanged.addListener(ch => { if (ch.soundFx) soundFx.checked = ch.soundFx.newValue !== false; });
    soundFx.addEventListener('change', () => {
        browser.storage.sync.set({ soundFx: soundFx.checked });
        if (soundFx.checked) blip(current, current); // aperçu du son
        flash(t(soundFx.checked ? 'soundFxOn' : 'soundFxOff'), 750);
    });

    withAudio.addEventListener('change', () => {
        browser.storage.sync.set({ withAudio: withAudio.checked });
        flash(t(withAudio.checked ? 'withAudioOn' : 'withAudioOff'), 750);
    });

    // Reset : retour à l'état « rien de forcé » — vitesse 1x ET Force 1x désactivé.
    $('reset').addEventListener('click', () => {
        setSpeed(1.0);
        browser.storage.sync.set({ forceOneX: false });
    });
});
