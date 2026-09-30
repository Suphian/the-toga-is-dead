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

  // Toga invitation links carry a private room id (/Toga?room=<id>&theme=...); hosts get it in
  // the address bar via history.replaceState. Two layers keep it out of PostHog:
  // 1. SDK masking (init options below): mask_personal_data_properties + custom_personal_data_properties
  //    make posthog-js write room=<masked> / theme=<masked> into $current_url, $initial_current_url,
  //    the nested $web_vitals_<metric>_event URLs and heatmap keys (it also masks ad click ids
  //    such as gclid/fbclid).
  // 2. before_send (below) then walks the whole event, plain objects and arrays up to MAX_DEPTH
  //    levels, and removes the room and theme parameters (any case, percent-decoded name) from
  //    every string that is a URL on this host (absolute or root-relative), from every string
  //    under a key containing "url" or "referrer" (any host), and from object keys that are URLs on
  //    this host. Other query parameters are kept. It never throws and always returns the event.
  var PRIVATE_PARAMS = /^(room|theme)$/i;
  var URL_KEY = /url|referrer/i;
  var MAX_DEPTH = 8;
  function paramName(pair) {
    var name = pair.split('=')[0].replace(/\+/g, ' ');
    try { return decodeURIComponent(name); } catch (error) { return name; }
  }
  function stripPrivateParams(value) {
    if (typeof value !== 'string' || value.indexOf('?') === -1) return value;
    var m = /^([^?#]*)\?([^#]*)(#[\s\S]*)?$/.exec(value);
    if (!m) return value;
    var kept = m[2].split('&').filter(function (pair) {
      return pair && !PRIVATE_PARAMS.test(paramName(pair));
    });
    return m[1] + (kept.length ? '?' + kept.join('&') : '') + (m[3] || '');
  }
  function isOwnUrl(value) {
    if (value.indexOf('?') === -1 || /\s/.test(value)) return false;
    if (/^\/(?!\/)/.test(value)) return true;
    var m = /^(?:https?:)?\/\/(?:[^@\/?#]*@)?([^\/?#:]*)/i.exec(value);
    return !!m && m[1].toLowerCase() === location.hostname;
  }
  function scrub(node, depth) {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return;
    var isArray = Array.isArray(node);
    if (!isArray && Object.prototype.toString.call(node) !== '[object Object]') return;
    Object.keys(node).forEach(function (key) {
      var value = node[key];
      if (typeof value === 'string') {
        if ((!isArray && URL_KEY.test(key)) || isOwnUrl(value)) node[key] = stripPrivateParams(value);
      } else {
        scrub(value, depth + 1);
      }
      if (isArray || !isOwnUrl(key)) return;
      var clean = stripPrivateParams(key);
      if (clean === key) return;
      var moved = node[key];
      delete node[key];
      if (!Object.prototype.hasOwnProperty.call(node, clean)) node[clean] = moved;
      else if (Array.isArray(node[clean]) && Array.isArray(moved)) node[clean] = node[clean].concat(moved);
    });
  }
  function beforeSend(cap) {
    try { scrub(cap, 0); } catch (error) { /* never drop an event because scrubbing failed */ }
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
    // Pinned here so the shared project's remote config can never switch these on.
    enable_heatmaps: false,
    capture_dead_clicks: false,
    mask_personal_data_properties: true,
    custom_personal_data_properties: ['room', 'theme'],
    person_profiles: 'identified_only',
    before_send: beforeSend
  });
})();
