let currentSpeed = 1.0;

function broadcastSpeedToAllTabs() {
    console.log("Broadcasting speed to all tabs:", currentSpeed);
    browser.tabs.query({})
        .then(allTabs => {
            return Promise.all(allTabs.map(tab =>
                browser.tabs.sendMessage(tab.id, {action: 'setSpeed', speed: currentSpeed})
                    .catch(err => console.log(`Error sending to tab ${tab.id}:`, err))
            ));
        })
        .then(() => console.log("Speed broadcast complete"))
        .catch(error => console.error("Error in speed broadcast:", error));
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setSpeed') {
        currentSpeed = message.speed;
        broadcastSpeedToAllTabs();
        // Store the speed in sync storage
        browser.storage.sync.set({defaultSpeed: currentSpeed});
    } else if (message.action === 'getCurrentSpeed') {
        sendResponse({speed: currentSpeed});
    }
});

// Initialize speed from storage
browser.storage.sync.get('defaultSpeed').then((result) => {
    if (result.defaultSpeed) {
        currentSpeed = result.defaultSpeed;
        broadcastSpeedToAllTabs();
    }
});

// Set initial speed for new tabs
browser.tabs.onCreated.addListener((tab) => {
    browser.tabs.sendMessage(tab.id, {action: 'setSpeed', speed: currentSpeed})
        .catch(err => console.log(`Error sending initial speed to new tab ${tab.id}:`, err));
});