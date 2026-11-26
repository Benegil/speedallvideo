function saveOptions(e) {
    e.preventDefault();
    let speed = parseFloat(document.getElementById('defaultSpeed').value);
    browser.storage.sync.set({
        defaultSpeed: speed
    }).then(() => {
        let status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 750);

        // Notify background script to update speed
        browser.runtime.sendMessage({action: 'setSpeed', speed: speed});
    });
}

function restoreOptions() {
    browser.storage.sync.get('defaultSpeed').then((res) => {
        document.getElementById('defaultSpeed').value = res.defaultSpeed || 1;
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);