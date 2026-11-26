document.addEventListener('DOMContentLoaded', function() {
    const slider = document.getElementById('speedSlider');
    const speedDisplay = document.getElementById('currentSpeed');
    const minusBtn = document.getElementById('minusBtn');
    const plusBtn = document.getElementById('plusBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusEl = document.getElementById('status');
    const presetBtns = document.querySelectorAll('.preset-btn');

    const MIN_SPEED = 0.25;
    const MAX_SPEED = 4;
    let STEP = 0.25; // pas de réglage, chargé depuis le stockage

    function clampSpeed(s) {
        return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
    }

    // Le pas est celui défini dans les options (stockage sync).
    browser.storage.sync.get('speedStep').then(result => {
        const step = parseFloat(result.speedStep);
        if (step > 0 && step <= MAX_SPEED) {
            STEP = step;
            slider.step = String(step);
        }
    });

    function updateDisplay(speed) {
        speedDisplay.textContent = speed.toFixed(2) + 'x';
        slider.value = speed;
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

    // Charger la vitesse actuelle depuis le background script
    browser.runtime.sendMessage({ action: 'getCurrentSpeed' }, (response) => {
        if (response && response.speed) {
            updateDisplay(response.speed);
        }
    });

    // Slider
    slider.addEventListener('input', function() {
        setSpeed(parseFloat(this.value));
    });

    // Boutons +/-
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
});
