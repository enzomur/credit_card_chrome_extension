// CardCompare Service Worker
// Handles background tasks and extension lifecycle events

// Log extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('CardCompare extension installed');
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    const prevVersion = details.previousVersion ?? 'unknown';
    console.log('CardCompare extension updated from ' + prevVersion);
  }
});

// Handle extension icon click (opens popup by default via manifest)
// This is here for future extensibility if needed

// Export empty object to make this a module
export {};
