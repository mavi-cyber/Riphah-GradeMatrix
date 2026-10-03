// Classic script, loaded in <head> so the saved theme applies before first paint.
(function () {
    var KEY = 'riphah_gradematrix_theme';
    var root = document.documentElement;

    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

    document.addEventListener('DOMContentLoaded', function () {
        var button = document.getElementById('themeToggle');
        if (!button) return;

        button.addEventListener('click', function () {
            var isDark = root.dataset.theme
                ? root.dataset.theme === 'dark'
                : window.matchMedia('(prefers-color-scheme: dark)').matches;
            var next = isDark ? 'light' : 'dark';
            root.dataset.theme = next;
            try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
        });
    });
})();
