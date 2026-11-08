import { MOBILE_BREAKPOINT_PX, VIEWPORT_COOKIE } from '../utils/viewport-class.ts'

/**
 * Standalone viewport bootstrap injected into the document head.
 *
 * The server cannot measure a viewport, so the browser reports it: this script
 * mirrors the layout breakpoint into a `viewport` cookie that the server reads
 * on every request (app/middleware/viewport-class.ts). It runs inline, before
 * the body paints, so the cookie is already set for the first frame
 * navigation — a module-scoped client entry would only run after the app
 * bundle has loaded.
 *
 * The media query matches the CSS breakpoint the shared `table.mobileCards`
 * mixin uses, so "mobile" means the same thing here and in the stylesheet.
 * Kept as a string so the browser test executes exactly what Document renders.
 */
export const viewportBootstrapScript = `(function () {
  try {
    var COOKIE = ${JSON.stringify(VIEWPORT_COOKIE)};
    var MEDIA = '(max-width: ${MOBILE_BREAKPOINT_PX}px)';
    var mql = window.matchMedia ? window.matchMedia(MEDIA) : null;
    if (!mql) return;
    var current = /(?:^|;\\s*)viewport=(mobile|desktop)/.exec(document.cookie);
    var write = function (isMobile) {
      var value = isMobile ? 'mobile' : 'desktop';
      if (current && current[1] === value) return;
      current = [null, value];
      document.cookie = COOKIE + '=' + value + '; path=/; max-age=31536000; SameSite=Lax';
    };
    write(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', function (event) { write(event.matches); });
    }
  } catch (error) {}
})();`
