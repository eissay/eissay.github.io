/**
 * PostHog Session Replay — Crisp Charts (static site, no bundler).
 *
 * Built configuration comes from the page: window.CC_POSTHOG = {apiKey, apiHost},
 * written by tools/build_site.py from config.json → posthog. Without a project key
 * the script is never served to visitors, so the site keeps its zero-analytics state.
 *
 * Rules this file keeps:
 *  - Consent first: the SDK is downloaded only after the visitor presses "Allow replays".
 *    Before that nothing leaves the browser (opt_out_capturing_by_default).
 *  - Do Not Track / Global Privacy Control keep the SDK from loading at all.
 *  - Masking: every input value is masked, [data-ph-mask] text is masked,
 *    [data-ph-block] subtrees are dropped from the recording, no canvas, no fonts.
 *  - Journey events (print, search, cook mode, guide answer, …) are captured into the
 *    same session, so each replay is attached to what the visitor actually did.
 *  - Existing page scripts are untouched: no autocapture, no page changes.
 *
 * The SDK itself lives in posthog-client.js (imported posthog-js, initialized there)
 * and is only fetched once the visitor has allowed replays.
 */

const CONSENT_KEY = 'cc-replay-consent';
const CONSENT_GRANTED = 'granted';
const CONSENT_DENIED = 'denied';

/* Interaction → event. Delegated on purpose: the markup stays as the generator writes it. */
const JOURNEY_CLICKS = [
  ['.float-print, [data-print-charts]', 'chart_printed'],
  ['[data-cook-open]', 'cook_mode_opened'],
  ['[data-act="3d"]', 'cook3d_opened'],
  ['.nav-search', 'search_opened'],
  ['.search-hit', 'search_result_clicked'],
  ['a.card', 'chart_opened'],
  ['[data-share]', 'page_shared'],
];

const cfg = window.CC_POSTHOG || {};
const apiKey = String(cfg.apiKey || '').trim();
const apiHost = String(cfg.apiHost || 'https://us.i.posthog.com').replace(/\/+$/, '');

let client = null;
let starting = null;

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch (e) {
    return null;
  }
}

function saveConsent(state) {
  try {
    localStorage.setItem(CONSENT_KEY, state);
  } catch (e) {
    /* private mode — the choice just does not survive the visit */
  }
}

function privacySignal() {
  const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  return navigator.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
}

function journeyProps(el) {
  const link = el.closest('a');
  return {
    path: location.pathname,
    target: (link && link.getAttribute('href')) || '',
  };
}

function bindJourneys(ph) {
  document.addEventListener('click', function (e) {
    const node = e.target;
    if (!node || typeof node.closest !== 'function') return;
    for (let i = 0; i < JOURNEY_CLICKS.length; i++) {
      const el = node.closest(JOURNEY_CLICKS[i][0]);
      if (el) {
        ph.capture(JOURNEY_CLICKS[i][1], journeyProps(el));
        return;
      }
    }
  }, true);
}

function startClient() {
  if (client) return Promise.resolve(client);
  if (starting) return starting;
  starting = import('./posthog-client.js').then(function (mod) {
    const ph = mod.initPosthog(apiKey, apiHost);
    if (!ph) return null;
    client = ph;
    bindJourneys(ph);
    return ph;
  }).catch(function (err) {
    starting = null;
    if (window.console) console.warn('[posthog] replay unavailable:', err && err.message ? err.message : err);
    return null;
  });
  return starting;
}

function removeBanner() {
  const el = document.getElementById('cc-replay-consent');
  if (el) el.remove();
}

const BANNER_CSS = `
.cc-consent {
  position: fixed; left: 16px; right: 16px; bottom: 16px; z-index: 90;
  max-width: 560px; margin: 0 auto; padding: 14px 16px;
  background: var(--card, #fffdf7); color: var(--ink, #272019);
  border: 1px solid var(--line, #e8dcc2); border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .18);
  font-family: Poppins, system-ui, sans-serif; font-size: .9rem; line-height: 1.45;
}
.cc-consent p { margin: 0 0 10px; }
.cc-consent a { color: var(--gold, #a24e0c); text-decoration: underline; }
.cc-consent-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.cc-consent button {
  font: inherit; font-weight: 600; cursor: pointer; padding: 8px 14px;
  border-radius: 999px; border: 1px solid var(--line-strong, #d3c09a);
  background: var(--bg-2, #fffdf7); color: var(--ink, #272019);
}
.cc-consent .cc-consent-yes {
  background: var(--accent, #b45a16); border-color: var(--accent, #b45a16);
  color: var(--accent-ink-contrast, #fffdf7);
}
.cc-consent button:focus-visible { outline: 2px solid var(--gold, #a24e0c); outline-offset: 2px; }
@media print { .cc-consent { display: none !important; } }
`;

function showBanner() {
  if (document.getElementById('cc-replay-consent') || !document.body) return;
  if (!document.getElementById('cc-replay-consent-css')) {
    const style = document.createElement('style');
    style.id = 'cc-replay-consent-css';
    style.textContent = BANNER_CSS;
    document.head.appendChild(style);
  }
  const box = document.createElement('div');
  box.id = 'cc-replay-consent';
  box.className = 'cc-consent';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Session replay consent');
  box.innerHTML =
    '<p>Help us see which charts and tools are hard to use. With your permission we record ' +
    'anonymous session replays — every keystroke is masked. ' +
    '<a href="/p/privacy-policy.html">Privacy</a></p>' +
    '<div class="cc-consent-btns">' +
    '<button type="button" class="cc-consent-yes">Allow replays</button>' +
    '<button type="button" class="cc-consent-no">No thanks</button>' +
    '</div>';
  document.body.appendChild(box);
  box.querySelector('.cc-consent-yes').addEventListener('click', function () {
    saveConsent(CONSENT_GRANTED);
    removeBanner();
    startClient();
  });
  box.querySelector('.cc-consent-no').addEventListener('click', function () {
    saveConsent(CONSENT_DENIED);
    removeBanner();
    if (client) client.opt_out_capturing();
  });
}

/* Public helpers: the guide generator and other tools report journey steps here. */
window.ccTrack = function (event, props) {
  if (!client || !event) return;
  try {
    client.capture(String(event), props || {});
  } catch (e) {
    /* analytics must never break the page */
  }
};

window.ccConsent = {
  state: readConsent,
  allow: function () {
    saveConsent(CONSENT_GRANTED);
    removeBanner();
    return startClient();
  },
  deny: function () {
    saveConsent(CONSENT_DENIED);
    removeBanner();
    if (client) client.opt_out_capturing();
  },
  forget: function () {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch (e) {
      /* ignore */
    }
    if (client) client.opt_out_capturing();
    client = null;
    showBanner();
  },
};

function boot() {
  if (!apiKey || privacySignal()) return;
  const state = readConsent();
  if (state === CONSENT_GRANTED) {
    startClient();
    return;
  }
  if (state === CONSENT_DENIED) return;
  showBanner();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
