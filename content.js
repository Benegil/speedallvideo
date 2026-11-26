let currentSpeed = 1.0;

function setVideoSpeed(speed, video) {
    if (video.playbackRate !== speed) {
        try {
            video.playbackRate = speed;
            console.log(`Set playback rate for video to ${speed}`);
        } catch (error) {
            console.error(`Error setting playback rate for video:`, error);
        }
    }
}

function applySpeedToAllVideos(speed) {
    const videos = document.getElementsByTagName('video');
    console.log(`Applying playback speed ${speed} to ${videos.length} video(s)`);
    Array.from(videos).forEach(video => setVideoSpeed(speed, video));
}

// Continuously apply speed to all videos
setInterval(() => {
    applySpeedToAllVideos(currentSpeed);
}, 1000);  // Check every second

// Observe DOM changes to catch new video elements
const observer = new MutationObserver(mutations => {
    applySpeedToAllVideos(currentSpeed);
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from the background script
browser.runtime.onMessage.addListener(message => {
    console.log("Received message in content script:", JSON.stringify(message));
    if (message && message.action === 'setSpeed') {
        currentSpeed = message.speed;
        applySpeedToAllVideos(currentSpeed);
    }
});

// Initialize on script load
browser.runtime.sendMessage({action: 'getCurrentSpeed'}, (response) => {
    if (response && response.speed) {
        currentSpeed = response.speed;
        applySpeedToAllVideos(currentSpeed);
    }
});

// Reapply speed when the page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('Page became visible, reapplying saved speed');
        applySpeedToAllVideos(currentSpeed);
    }
});