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

    function setSpeed(s) {
        current = round2(clamp(s));
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
