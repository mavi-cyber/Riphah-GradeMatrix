// Classic script: registers the service worker and offers the Install button.
(function () {
    // On a local dev server the cache would keep serving old files while editing,
    // so offline support is only switched on there with ?pwa in the address.
    var isLocal = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1;
    var enabled = !isLocal || location.search.indexOf('pwa') !== -1;

    if (enabled && 'serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
        });
    }

    // Chrome on Android fires this when the app can be installed. The button stays
    // hidden on browsers that never fire it, and once the app is installed.
    var installPrompt = null;
    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        installPrompt = event;
        var button = document.getElementById('installBtn');
        if (button) button.hidden = false;
    });

    document.addEventListener('DOMContentLoaded', function () {
        var button = document.getElementById('installBtn');
        if (!button) return;
        button.addEventListener('click', function () {
            if (!installPrompt) return;
            installPrompt.prompt();
            installPrompt.userChoice.then(function () {
                installPrompt = null;
                button.hidden = true;
            });
        });
    });

    window.addEventListener('appinstalled', function () {
        var button = document.getElementById('installBtn');
        if (button) button.hidden = true;
    });
})();
