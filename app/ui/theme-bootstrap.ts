/**
 * Standalone theme bootstrap injected into the document head. It must run
 * before the body paints, so it is inlined rather than imported by a module
 * script. Kept as a string so the browser test executes exactly what Document
 * renders; keep the data-theme contract in sync with
 * app/ui/theme-toggle.browser.tsx.
 */
export const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem('theme');
    var cookie = /(?:^|;\\s*)theme=(dark|light)/.exec(document.cookie);
    var explicit = stored === 'dark' || stored === 'light' ? stored : (cookie && cookie[1]) || null;
    var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var apply = function (mode) {
      if (mode === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (mode === 'light' && explicit) {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };
    apply(explicit || (mql && mql.matches ? 'dark' : 'light'));
    if (!explicit && mql) {
      var onChange = function (event) {
        try {
          var storedNow = localStorage.getItem('theme');
          if (storedNow === 'dark' || storedNow === 'light') return;
        } catch (error) {}
        apply(event.matches ? 'dark' : 'light');
      };
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
  } catch (error) {}
})();`
