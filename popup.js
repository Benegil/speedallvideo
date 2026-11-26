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
    const STEP = 0.25;

    function clampSpeed(s) {
        return Math.min(MAX_SPEED, Math.max(MIN_SPEED, s));
    }

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
