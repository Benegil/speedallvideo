document.addEventListener('DOMContentLoaded', function() {
    const speedSlider = document.getElementById('speedSlider');
    const currentSpeedDisplay = document.getElementById('currentSpeed');

    // Initialize the slider with the current speed
    browser.runtime.sendMessage({action: 'getCurrentSpeed'}, (response) => {
        if (response && response.speed) {
            speedSlider.value = response.speed;
            currentSpeedDisplay.textContent = response.speed.toFixed(2);
        }
    });

    // Update speed when the slider changes
    speedSlider.addEventListener('input', function() {
        const newSpeed = parseFloat(this.value);
        currentSpeedDisplay.textContent = newSpeed.toFixed(2);
        browser.runtime.sendMessage({action: 'setSpeed', speed: newSpeed});
    });
});