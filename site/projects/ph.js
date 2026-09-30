// PostHog for suph.app (project 631302, shared with suphian.com; filter by $host).
// The official snippet loads the SDK from /ingest/static/array.js and sends to /ingest,
// both proxied same-origin by vercel.json. Only the production host sends anything:
// previews, *.vercel.app and local servers never load the SDK.
(function () {
  'use strict';

  // Custom events go through this helper. It is a no-op when PostHog is absent
  // (other hosts, blocked script) and never throws into the page.
  window.suphTrack = function (event, props) {
    try {
      var ph = window.posthog;
      if (ph && typeof ph.capture === 'function') ph.capture(event, props || {});
    } catch (error) { /* analytics must never break the page */ }
  };

  if (location.hostname !== 'suph.app') return;

  // Legacy /?room=... and /?theme=... links are replaced by an inline script on the gallery
  // page (they land on /Toga), so the redirect itself must not count as a pageview.
  if (location.pathname === '/' && /[?&](room|theme)=/.test(location.search)) return;

  // Toga invitation links carry a private room id (/Toga?room=<id>&theme=...). Strip `room` and
  // `theme` from every URL-shaped property before an event leaves the browser: $current_url,
  // $referrer, $initial_referrer, $initial_current_url, $session_entry_* and the $set/$set_once
  // copies. Other query parameters are left alone.
  var PRIVATE_PARAMS = /^(room|theme)$/i;
  function stripPrivateParams(value) {
    if (typeof value !== 'string' || value.indexOf('?') === -1) return value;
    var m = /^([^?#]*)\?([^#]*)(#[\s\S]*)?$/.exec(value);
    if (!m) return value;
    var kept = m[2].split('&').filter(function (pair) {
      return pair && !PRIVATE_PARAMS.test(pair.split('=')[0].replace(/\+/g, ' '));
    });
    return m[1] + (kept.length ? '?' + kept.join('&') : '') + (m[3] || '');
  }
  function scrub(bag) {
    if (!bag || typeof bag !== 'object') return;
    Object.keys(bag).forEach(function (key) {
      if (/url|referrer/i.test(key)) bag[key] = stripPrivateParams(bag[key]);
    });
  }
  function beforeSend(cap) {
    try {
      if (cap) { scrub(cap.properties); scrub(cap.$set); scrub(cap.$set_once); }
    } catch (error) { /* never drop an event because scrubbing failed */ }
    return cap;
  }

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetGroupPropertiesForFlags resetPersonPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init('phc_rd4iSE4nLz5RbL3Nskbbm8YCKYdx7u2zz9SQmQF3wdZ7', {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    capture_performance: { web_vitals: true },
    capture_exceptions: true,
    autocapture: false,
    disable_session_recording: true,
    disable_surveys: true, // no survey widgets or survey network calls on a gallery + game
    person_profiles: 'identified_only',
    before_send: beforeSend
  });
})();
