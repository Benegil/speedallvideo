/* SpeedAllVideo — compatibilité Chrome : browser.* = chrome.* (Promises en MV3) */
if (typeof globalThis.browser === 'undefined') globalThis.browser = chrome;
