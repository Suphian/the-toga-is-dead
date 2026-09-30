import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const HOST_RULE = '(.*)\\.vercel\\.app';
const allHeaders = (source) => config.headers
  .filter((rule) => rule.source === source && !rule.has)
  .flatMap((rule) => rule.headers);
const headerValue = (list, key) => list.find((header) => header.key === key)?.value;

test('/Quran permanently redirects to /quran with a 308', () => {
  const rule = config.redirects.find((entry) => entry.source === '/Quran');
  assert.ok(rule, 'redirect for /Quran exists');
  assert.equal(rule.destination, '/quran');
  assert.equal(rule.statusCode, 308);
  assert.ok(!config.rewrites.some((entry) => entry.source === '/Quran'), 'no rewrite left for /Quran');
});

test('existing page rewrites are preserved', () => {
  const rewrites = Object.fromEntries(config.rewrites.map((entry) => [entry.source, entry.destination]));
  assert.equal(rewrites['/Toga'], '/Toga/index.html');
  assert.equal(rewrites['/toga'], '/Toga/index.html');
  assert.equal(rewrites['/quran'], '/quran/index.html');
  assert.equal(rewrites['/surah/:name'], '/surah/:name/index.html');
});

test('PostHog ingest rewrites: static, array, then catch-all', () => {
  const sources = config.rewrites.map((entry) => entry.source);
  const indexes = ['/ingest/static/:path(.*)', '/ingest/array/:path(.*)', '/ingest/:path(.*)'].map((source) => sources.indexOf(source));
  assert.ok(indexes.every((index) => index >= 0), 'all three ingest rewrites exist');
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b), 'ingest rewrites keep order');
  assert.equal(config.rewrites[indexes[0]].destination, 'https://us-assets.i.posthog.com/static/:path');
  assert.equal(config.rewrites[indexes[1]].destination, 'https://us-assets.i.posthog.com/array/:path');
  assert.equal(config.rewrites[indexes[2]].destination, 'https://us.i.posthog.com/:path');
});

test('vercel.app hosts are noindex via a host has-rule', () => {
  const rule = config.headers.find((entry) => entry.has?.some((cond) => cond.type === 'host' && cond.value === HOST_RULE));
  assert.ok(rule, 'host rule exists');
  assert.equal(headerValue(rule.headers, 'X-Robots-Tag'), 'noindex, nofollow');
  assert.ok(!allHeaders('/(.*)').some((header) => header.key === 'X-Robots-Tag'), 'production hosts are not noindexed');
});

test('security headers are present on every path', () => {
  const list = allHeaders('/(.*)');
  assert.equal(headerValue(list, 'X-Content-Type-Options'), 'nosniff');
  assert.equal(headerValue(list, 'Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(headerValue(list, 'Permissions-Policy'), /camera=\(\)/);
  assert.match(headerValue(list, 'Strict-Transport-Security'), /includeSubDomains/);
  assert.ok(headerValue(list, 'Content-Security-Policy-Report-Only'), 'report-only CSP present');
  assert.equal(headerValue(list, 'Content-Security-Policy'), undefined, 'CSP is not enforced');
});

test('CSP report-only allow-list', () => {
  const csp = headerValue(allHeaders('/(.*)'), 'Content-Security-Policy-Report-Only');
  for (const token of ['https://esm.sh', 'https://0.peerjs.com', 'wss://0.peerjs.com', 'blob:', 'data:', "'unsafe-inline'", "frame-ancestors 'self'", 'report-uri /ingest/report/?token=phc_']) {
    assert.ok(csp.includes(token), `CSP contains ${token}`);
  }

  // Fonts and three.js are self-hosted (/fonts, /vendor/three), so these hosts stay out.
  for (const host of ['https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    assert.ok(!csp.includes(host), `CSP no longer allows ${host}`);
  }
});

test('cache rules: 30 days + SWR for static media, 1 hour for js/css, never immutable', () => {
  const thirtyDays = 'public, max-age=2592000, stale-while-revalidate=604800';
  for (const source of ['/assets/(.*)', '/quran/(thumbs|artworks)/(.*)', '/fonts/(.*)', '/vendor/(.*)']) {
    assert.equal(headerValue(allHeaders(source), 'Cache-Control'), thirtyDays, source);
  }
  assert.equal(headerValue(allHeaders('/(.*)\\.(js|css)'), 'Cache-Control'), 'public, max-age=3600, stale-while-revalidate=86400');
  assert.ok(!JSON.stringify(config.headers).includes('immutable'));
});
