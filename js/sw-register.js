// Register the offline service worker (lets PDF Private work without internet
// and be installed as an app). It only caches this site's own files.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}
