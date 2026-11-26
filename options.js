document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('currentSpeed');
    const minusBtn = document.getElementById('minusBtn');
    const plusBtn = document.getElementById('plusBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusEl = document.getElementById('status');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const stepInput = document.getElementById('speedStep');
    const forceOneX = document.getElementById('forceOneX');
    const slowDesc = document.getElementById('slowDesc');
    const fastDesc = document.getElementById('fastDesc');

    const MIN_SPEED = 0.25;
    const MAX_SPEED = 4;
    let STEP = 0.25; // pas de réglage, chargé depuis le stockage

    function clampSpeed(s) {
        return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
    }

    function fmtStep(v) {
        return (Math.round(v * 100) / 100).toString();
    }

    // Applique le pas à tout ce qui en dépend : slider, boutons ±, texte des raccourcis.
    function applyStep(step) {
        STEP = step;
        slider.step = String(step);
        if (slowDesc) slowDesc.textContent = `Slow down (−${fmtStep(step)}x)`;
        if (fastDesc) fastDesc.textContent = `Speed up (+${fmtStep(step)}x)`;
    }

    function updateDisplay(speed) {
        speedDisplay.textContent = speed.toFixed(2) + 'x';
        slider.value = speed;
        // Mettre à jour le bouton actif des presets
        presetBtns.forEach(btn => {
            const val = parseFloat(btn.dataset.speed);
            btn.classList.toggle('active', Math.abs(val - speed) < 0.001);
        });
    }

    function setStatus(msg, duration) {
        statusEl.textContent = msg;
        if (duration) {
            setTimeout(() => { statusEl.textContent = ''; }, duration);
        }
    }

    function setSpeed(speed) {
        speed = clampSpeed(speed);
        // Arrondi à 2 décimales : évite les erreurs flottantes (0.30000000000000004…)
        speed = Math.round(speed * 100) / 100;
        updateDisplay(speed);
        browser.runtime.sendMessage({ action: 'setSpeed', speed: speed });
        setStatus('✓ Speed updated', 750);
    }

    // Charger la vitesse actuelle et le pas depuis le background / stockage
    browser.runtime.sendMessage({ action: 'getCurrentSpeed' }, (response) => {
        if (response && response.speed) {
            updateDisplay(response.speed);
        }
    });
    browser.storage.sync.get('speedStep').then(result => {
        const step = parseFloat(result.speedStep);
        if (step > 0 && step <= MAX_SPEED) {
            applyStep(step);
            stepInput.value = fmtStep(step);
        } else {
            applyStep(0.25);
        }
    });

    // Force 1x : coché si l'option est active dans le stockage
    browser.storage.sync.get('forceOneX').then(result => {
        forceOneX.checked = !!result.forceOneX;
    });

    // Slider
    slider.addEventListener('input', function() {
        setSpeed(parseFloat(this.value));
    });

    // Boutons +/- (utilisent le pas de réglage)
    minusBtn.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: 'getCurrentSpeed' }, (response) => {
            const current = response && response.speed ? response.speed : 1;
            setSpeed(current - STEP);
        });
    });

    plusBtn.addEventListener('click', () => {
        browser.runtime.sendMessage({ action: 'getCurrentSpeed' }, (response) => {
            const current = response && response.speed ? response.speed : 1;
            setSpeed(current + STEP);
        });
    });

    // Boutons presets
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            setSpeed(parseFloat(btn.dataset.speed));
        });
    });

    // Reset
    resetBtn.addEventListener('click', () => {
        setSpeed(1.0);
    });

    // Champ du pas : l'utilisateur peut taper 0.10, 0.25, 0.5…
    function commitStep() {
        let step = parseFloat(stepInput.value);
        if (isNaN(step) || step <= 0) step = 0.25;
        if (step > MAX_SPEED) step = MAX_SPEED;
        step = Math.round(step * 100) / 100;
        applyStep(step);
        stepInput.value = fmtStep(step);
        browser.storage.sync.set({ speedStep: step });
        setStatus('✓ Step updated', 750);
    }
    stepInput.addEventListener('change', commitStep);
    stepInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitStep(); }
    });

    // Force 1x : sauvegarde dans le stockage sync (lu par les content scripts)
    forceOneX.addEventListener('change', () => {
        browser.storage.sync.set({ forceOneX: forceOneX.checked });
        setStatus(forceOneX.checked ? '✓ Force 1x enabled' : 'Force 1x disabled', 750);
    });
});
