/**
 * PostHog client — the only file that imports the SDK.
 *
 * `posthog-js` is a bare specifier, resolved by the import map that
 * tools/build_site.py writes into every page (pinned ESM build of the same
 * version declared in package.json → posthog-js). This module is imported
 * lazily by posthog-replay.js, so the SDK is not even downloaded — and nothing
 * is captured — until the visitor presses "Allow replays".
 */

import posthog from 'posthog-js';

/* Masking: every input value, explicitly marked text, and blocked subtrees. */
const SESSION_RECORDING = {
  maskAllInputs: true,
  maskInputOptions: {
    password: true,
    email: true,
    tel: true,
    text: true,
    textarea: true,
    search: true,
    number: true,
  },
  maskTextSelector: '[data-ph-mask]',
  blockSelector: '[data-ph-block]',
  recordCanvas: false,
  collectFonts: false,
};

export function initPosthog(apiKey, apiHost) {
  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: '2026-08-30',

    /* Nothing is captured until the visitor opts in (called below). */
    opt_out_capturing_by_default: true,
    respect_dnt: true,

    /* Keep existing behaviour: no autocapture, plain pageviews and page leaves. */
    autocapture: false,
    capture_pageview: 'history_change',
    capture_pageleave: 'if_capture_pageview',
    person_profiles: 'identified_only',
    persistence: 'localStorage+cookie',
    disable_session_recording: false,
    session_recording: SESSION_RECORDING,
  });

  /* Consent is already stored when this runs — turn recording on. */
  posthog.opt_in_capturing();
  return posthog;
}

export default posthog;
