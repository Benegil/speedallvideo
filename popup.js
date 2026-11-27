/* SpeedAllVideo — popup : vitesse courante, slider, presets, reset */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const speedEl = $('speed');
    const slider = $('slider');
    const status = $('status');
    const presets = [...document.querySelectorAll('.preset')];

    const MIN = 0.25;
    const MAX = 4;
    let step = 0.25; // pas de réglage (options)
    let current = 1.0;

    const clamp = s => Math.min(MAX, Math.max(MIN, s));
    const round2 = s => Math.round(s * 100) / 100;

    function stepDescs() { // descriptions S/D selon le pas réglé
        $('slowDesc').textContent = t('slowDown', step);
        $('fastDesc').textContent = t('speedUp', step);
    }
    stepDescs();

    function render() {
        speedEl.textContent = current.toFixed(2) + 'x';
        slider.value = current;
        presets.forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - current) < 0.001));
    }

    function flash(msg, ms) {
        status.textContent = msg;
        setTimeout(() => { status.textContent = ''; }, ms);
    }

    // Son : MÊME réglage que la case « Signal sonore » des options (soundFx),
    // activé par défaut ; l'icône haut-parleur le coupe / le rétablit.
    let sound = true;
    const mute = $('mute');
    function renderMute() {
        mute.classList.toggle('off', !sound);
        mute.setAttribute('aria-label', t(sound ? 'muteAria' : 'unmuteAria'));
        mute.title = t(sound ? 'muteAria' : 'unmuteAria');
    }
    renderMute();
    browser.storage.sync.get('soundFx').then(res => { sound = res.soundFx !== false; renderMute(); });
    browser.storage.onChanged.addListener(ch => { if (ch.soundFx) { sound = ch.soundFx.newValue !== false; renderMute(); } });
    mute.addEventListener('click', () => {
        sound = !sound;
        browser.storage.sync.set({ soundFx: sound });
        renderMute();
        if (sound) blip(current, current); // confirmation : on entend le son réactivé
    });

    // Raccourcis : glisser une lettre sur une autre échange les deux (keyMap, permutation de s/d/r)
    const keyEls = [...document.querySelectorAll('.key[data-act]')];
    let keyMap = { slow: 's', fast: 'd', reset: 'r' };
    function renderKeys() { keyEls.forEach(k => { k.textContent = keyMap[k.dataset.act].toUpperCase(); }); }
    browser.storage.sync.get('keyMap').then(res => {
        const m = res.keyMap;
        if (m && [m.slow, m.fast, m.reset].sort().join('') === 'drs') { keyMap = m; renderKeys(); }
    });
    let dragAct = null;
    keyEls.forEach(k => {
        k.addEventListener('dragstart', e => { dragAct = k.dataset.act; k.classList.add('dragging'); e.dataTransfer.setData('text/plain', dragAct); e.dataTransfer.effectAllowed = 'move'; });
        k.addEventListener('dragend', () => { dragAct = null; keyEls.forEach(x => x.classList.remove('dragging', 'over')); });
        k.addEventListener('dragover', e => { if (dragAct && dragAct !== k.dataset.act) { e.preventDefault(); k.classList.add('over'); } });
        k.addEventListener('dragleave', () => k.classList.remove('over'));
        k.addEventListener('drop', e => {
            e.preventDefault();
            const a = dragAct, b = k.dataset.act;
            if (!a || a === b) return;
            [keyMap[a], keyMap[b]] = [keyMap[b], keyMap[a]];
            keyMap = { ...keyMap };
            browser.storage.sync.set({ keyMap });
            renderKeys();
            if (sound) blip(current, current);
        });
    });

    // Engrenage : ouvre la page des paramètres de l'extension
    const gear = $('gear');
    gear.title = t('settingsAria');
    gear.addEventListener('click', () => { browser.runtime.openOptionsPage(); window.close(); });

    function setSpeed(s) {
        const prev = current;
        current = round2(clamp(s));
        if (sound && current !== prev) blip(current, prev);
        render();
        browser.runtime.sendMessage({ action: 'setSpeed', speed: current });
        flash(t('speedUpdated'), 750);
    }

    // Pas de réglage depuis le stockage (pilote les boutons ± et le slider)
    browser.storage.sync.get('speedStep').then(res => {
        const s = parseFloat(res.speedStep);
        if (s > 0 && s <= MAX) {
            step = s;
            slider.step = String(s);
            stepDescs();
        }
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

    // Reset : retour à l'état « rien de forcé » — vitesse 1x ET Force 1x désactivé.
    $('reset').addEventListener('click', () => {
        setSpeed(1.0);
        browser.storage.sync.set({ forceOneX: false });
    });
});
