import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../site/projects/ph.js', import.meta.url), 'utf8');

// Runs site/projects/ph.js as the browser would, in a fresh context whose global is the fake
// `window`. `posthog: 'stub'` pre-installs a loaded PostHog (so the snippet leaves it alone) that
// records init options; `posthog: 'snippet'` lets the official snippet build its own queue stub.
function load(href, { posthog = 'stub' } = {}) {
  const url = new URL(href);
  const inserted = [];
  const inits = [];
  const captures = [];
  const context = {
    location: { href: url.href, protocol: url.protocol, host: url.host, hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash },
    document: {
      createElement: (tag) => ({ tagName: tag }),
      getElementsByTagName: () => [{ parentNode: { insertBefore: (node) => inserted.push(node) } }]
    },
    history: { replaceState() {}, pushState() {} },
    console
  };
  context.window = context;
  if (posthog === 'stub') {
    context.posthog = {
      __SV: 1,
      init: (token, options) => inits.push({ token, options }),
      capture: (event, props) => captures.push({ event, props })
    };
  }
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'ph.js' });
  return { window: context, inits, captures, inserted };
}

const initOptions = (href) => {
  const { inits } = load(href);
  assert.equal(inits.length, 1, `${href} initialises PostHog once`);
  return inits[0].options;
};

test('only the production host initialises PostHog', () => {
  for (const href of ['https://suph.app/', 'https://suph.app/Toga', 'https://suph.app/quran', 'https://suph.app/surah/al-fatihah/']) {
    assert.equal(load(href).inits.length, 1, href);
  }
  for (const href of ['https://www.suph.app/', 'https://ceoisdead.vercel.app/Toga', 'http://127.0.0.1:3104/Toga', 'http://localhost:3104/']) {
    assert.equal(load(href).inits.length, 0, href);
  }
});

test('legacy /?room= and /?theme= redirects skip init; the /Toga landing does not', () => {
  assert.equal(load('https://suph.app/?room=abc123').inits.length, 0);
  assert.equal(load('https://suph.app/?theme=roman').inits.length, 0);
  assert.equal(load('https://suph.app/?utm_source=x&room=abc').inits.length, 0);
  assert.equal(load('https://suph.app/Toga?room=abc123&theme=roman').inits.length, 1);
});

test('the official snippet queues init and loads the SDK from the same-origin proxy', () => {
  const { window, inserted } = load('https://suph.app/Toga', { posthog: 'snippet' });
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].src, '/ingest/static/array.js');
  assert.equal(window.posthog._i.length, 1);
  assert.equal(window.posthog._i[0][1].api_host, '/ingest');
  assert.equal(typeof window.posthog._i[0][1].before_send, 'function');
});

test('suphTrack is a no-op without PostHog and never throws', () => {
  for (const href of ['https://www.suph.app/', 'http://127.0.0.1:3104/Toga']) {
    const { window } = load(href, { posthog: 'none' });
    assert.equal(typeof window.suphTrack, 'function', href);
    assert.doesNotThrow(() => window.suphTrack('toga_game_started', { players: 2 }));
    assert.doesNotThrow(() => window.suphTrack());
  }

  const { window, captures } = load('https://suph.app/');
  window.suphTrack('project_card_clicked', { project: 'toga' });
  window.suphTrack('no_props');
  // JSON round-trip: the `{}` default is created inside the vm realm (different Object.prototype).
  assert.deepEqual(JSON.parse(JSON.stringify(captures)), [
    { event: 'project_card_clicked', props: { project: 'toga' } },
    { event: 'no_props', props: {} }
  ]);

  window.posthog.capture = () => { throw new Error('blocked'); };
  assert.doesNotThrow(() => window.suphTrack('project_card_clicked'));
});

test('init options: proxy, capture scope, and pinned privacy settings', () => {
  const options = initOptions('https://suph.app/Toga');
  assert.equal(options.api_host, '/ingest');
  assert.equal(options.capture_pageview, true);
  assert.equal(options.capture_pageleave, true);
  assert.equal(options.capture_exceptions, true);
  assert.equal(options.autocapture, false);
  assert.equal(options.disable_session_recording, true);
  assert.equal(options.disable_surveys, true);
  assert.equal(options.mask_personal_data_properties, true);
  assert.deepEqual([...options.custom_personal_data_properties].sort(), ['room', 'theme']);
  assert.equal(options.enable_heatmaps, false);
  assert.equal(options.capture_dead_clicks, false);
  assert.equal(typeof options.before_send, 'function');
});

const beforeSend = () => initOptions('https://suph.app/Toga?room=abc123&theme=roman').before_send;
const ROOM_URL = 'https://suph.app/Toga?room=abc123&theme=roman&utm_source=news';

test('before_send strips room/theme from $pageview and $pageleave URLs and keeps other params', () => {
  const send = beforeSend();
  for (const event of ['$pageview', '$pageleave']) {
    const cap = {
      event,
      properties: {
        $current_url: ROOM_URL,
        $referrer: 'https://suph.app/?room=abc123',
        $session_entry_url: 'https://suph.app/Toga?theme=roman&room=abc123#rules',
        $pathname: '/Toga',
        $host: 'suph.app'
      },
      $set: { $current_url: ROOM_URL },
      $set_once: { $initial_current_url: 'https://suph.app/Toga?Room=abc123&v=2' }
    };
    assert.equal(send(cap), cap, `${event} is returned`);
    assert.equal(cap.properties.$current_url, 'https://suph.app/Toga?utm_source=news');
    assert.equal(cap.properties.$referrer, 'https://suph.app/');
    assert.equal(cap.properties.$session_entry_url, 'https://suph.app/Toga#rules');
    assert.equal(cap.properties.$pathname, '/Toga');
    assert.equal(cap.$set.$current_url, 'https://suph.app/Toga?utm_source=news');
    assert.equal(cap.$set_once.$initial_current_url, 'https://suph.app/Toga?v=2');
  }
});

test('before_send strips room/theme from nested $web_vitals URLs', () => {
  const send = beforeSend();
  const cap = {
    event: '$web_vitals',
    properties: {
      $current_url: 'https://suph.app/Toga?room=<masked>&theme=<masked>&v=2',
      $web_vitals_LCP_event: {
        name: 'LCP',
        value: 1234,
        $current_url: 'https://suph.app/Toga?room=abc123&theme=roman&v=2',
        navigationURL: 'https://suph.app/Toga?room=abc123',
        attribution: { url: 'https://suph.app/assets/toga-cover.jpg?room=abc123&w=1200', target: 'img.welcome-art' },
        timestamp: 1
      },
      $web_vitals_LCP_value: 1234,
      $web_vitals_CLS_event: { name: 'CLS', value: 0.01, $current_url: ROOM_URL, entries: [{ sources: [{ node: 'x', url: ROOM_URL }] }] },
      $web_vitals_CLS_value: 0.01
    }
  };
  assert.equal(send(cap), cap);
  const lcp = cap.properties.$web_vitals_LCP_event;
  assert.equal(cap.properties.$current_url, 'https://suph.app/Toga?v=2');
  assert.equal(lcp.$current_url, 'https://suph.app/Toga?v=2');
  assert.equal(lcp.navigationURL, 'https://suph.app/Toga');
  assert.equal(lcp.attribution.url, 'https://suph.app/assets/toga-cover.jpg?w=1200');
  assert.equal(lcp.attribution.target, 'img.welcome-art');
  assert.equal(lcp.value, 1234);
  assert.equal(cap.properties.$web_vitals_CLS_event.$current_url, 'https://suph.app/Toga?utm_source=news');
  assert.equal(cap.properties.$web_vitals_CLS_event.entries[0].sources[0].url, 'https://suph.app/Toga?utm_source=news');
  assert.ok(!JSON.stringify(cap).includes('abc123'), 'no room id anywhere in the payload');
});

test('before_send rewrites own-host URLs anywhere, including object keys, and leaves the rest alone', () => {
  const send = beforeSend();
  const cap = {
    event: '$$heatmap',
    properties: {
      $heatmap_data: {
        'https://suph.app/Toga?room=abc123&x=1': [{ x: 1 }],
        'https://suph.app/Toga?x=1': [{ x: 2 }]
      },
      $exception_list: [{ stacktrace: { frames: [{ filename: 'https://suph.app/app.js?room=abc123' }] } }],
      path: '/Toga?theme=roman&tab=rules',
      other_site: 'https://example.com/?room=keep',
      note: 'room=abc123 is plain text'
    }
  };
  assert.equal(send(cap), cap);
  assert.deepEqual(Object.keys(cap.properties.$heatmap_data), ['https://suph.app/Toga?x=1']);
  assert.deepEqual(cap.properties.$heatmap_data['https://suph.app/Toga?x=1'].map((point) => point.x).sort(), [1, 2]);
  assert.equal(cap.properties.$exception_list[0].stacktrace.frames[0].filename, 'https://suph.app/app.js');
  assert.equal(cap.properties.path, '/Toga?tab=rules');
  assert.equal(cap.properties.other_site, 'https://example.com/?room=keep');
  assert.equal(cap.properties.note, 'room=abc123 is plain text');
});

test('before_send never throws and always returns the event', () => {
  const send = beforeSend();
  assert.equal(send(null), null);
  assert.equal(send(undefined), undefined);

  const cyclic = { event: '$pageview', properties: { $current_url: ROOM_URL } };
  cyclic.properties.self = cyclic.properties;
  assert.equal(send(cyclic), cyclic);
  assert.equal(cyclic.properties.$current_url, 'https://suph.app/Toga?utm_source=news');

  const hostile = { event: '$pageview', properties: {} };
  Object.defineProperty(hostile.properties, 'boom', { enumerable: true, get() { throw new Error('getter'); } });
  assert.equal(send(hostile), hostile);
});
