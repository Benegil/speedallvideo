/* SpeedAllVideo — options : vitesse, pas de réglage (Speed Step), Force 1x */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const speedEl = $('speed');
    const slider = $('slider');
    const stepInput = $('stepInput');
    const forceOneX = $('forceOneX');
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

    function setSpeed(s) {
        current = round2(clamp(s));
        render();
        browser.runtime.sendMessage({ action: 'setSpeed', speed: current });
        flash('✓ Speed updated', 750);
    }

    // Le pas pilote les boutons ±, le slider ET les descriptions S/D.
    function applyStep() {
        const s = parseFloat(stepInput.value);
        if (s > 0 && s <= MAX) {
            step = round2(s);
            slider.step = String(step);
            $('slowDesc').textContent = `Slow down (−${step}x)`;
            $('fastDesc').textContent = `Speed up (+${step}x)`;
        }
    }

    // Chargement initial depuis le stockage sync (lu par les content scripts)
    browser.storage.sync.get(['speedStep', 'forceOneX']).then(res => {
        if (res.speedStep !== undefined && res.speedStep !== '') {
            stepInput.value = res.speedStep;
            applyStep();
        }
        forceOneX.checked = !!res.forceOneX;
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
    let t;
    function commitStep() {
        const v = parseFloat(stepInput.value);
        if (!(v > 0 && v <= MAX)) {
            stepInput.value = String(step); // invalide → on restaure l'ancienne valeur
            flash('Invalid step (use 0.01 – 4)', 1200);
            return;
        }
        browser.storage.sync.set({ speedStep: String(v) });
        applyStep();
        flash('✓ Speed Step saved', 750);
    }
    stepInput.addEventListener('blur', commitStep);
    stepInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(commitStep, 1000); });
    stepInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commitStep(); }
    });

    // Force 1x : sauvegarde dans le stockage sync (lu par les content scripts)
    forceOneX.addEventListener('change', () => {
        browser.storage.sync.set({ forceOneX: forceOneX.checked });
        flash(forceOneX.checked ? '✓ Force 1x enabled' : 'Force 1x disabled', 750);
    });

    // Reset : retour à l'état « rien de forcé » — vitesse 1x ET Force 1x désactivé.
    $('reset').addEventListener('click', () => {
        setSpeed(1.0);
        browser.storage.sync.set({ forceOneX: false });
    });
});
