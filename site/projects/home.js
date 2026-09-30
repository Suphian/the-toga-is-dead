(function () {
  'use strict';
  const root = document.getElementById('suph-home-concept');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settings = { texture: 'Dither', motion: !reduced, grain: 'Fine' };
  // MP4 first: the H.264 set is ~78 KB smaller in total than the VP9 WebM set (1,155,311 vs 1,233,868 B).
  const clip = name => ['/assets/projects/' + name + '.mp4', '/assets/projects/' + name + '.webm'];
  const projects = ['toga', 'quran', 'coming'];
  const videoStatus = projects.map(function (name) { return root.querySelector('[data-video-status="' + name + '"]'); });

  // Analytics via /projects/ph.js; a no-op unless PostHog runs on suph.app. No personal data.
  function track(event, props) { if (typeof window.suphTrack === 'function') window.suphTrack(event, props); }
  root.addEventListener('click', function (event) {
    const card = event.target.closest('a.suph-project[href]');
    const status = card && card.querySelector('[data-video-status]');
    if (status) track('project_card_clicked', { project: status.getAttribute('data-video-status') });
  });

  // Players are created after first paint and an idle moment (1.5 s at the latest) so the
  // decode + dither setup stays off the load path.
  let started = false;
  function start() {
    if (started) return;
    started = true;
    init();
  }
  function whenIdle() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 1500 });
    else setTimeout(start, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenIdle);
  else whenIdle();
  setTimeout(start, 1500);

  function init() {
  const players = [
    window.createSuphVideoCard(clip('toga'), { cropX: .52, cropY: .48, gamma: .72, contrast: 1.04, feather: .035, redAccent: true }),
    window.createSuphVideoCard(clip('quran'), { cropX: .63, cropY: .48, gamma: .88, contrast: 1.13, feather: .035 }),
    window.createSuphVideoCard(clip('coming'), { gamma: .72, whitePoint: .78, contrast: 1.1, feather: .035, redAccent: true })
  ];
  // Cards outside the viewport pause and stop drawing; the observer reports the real state on start.
  const onScreen = players.map(function () { return true; });
  let frameRequest = 0, lastDraw = 0;
  function scheduleDraw() {
    if (!frameRequest && !document.hidden && root.isConnected) frameRequest = requestAnimationFrame(frame);
  }
  function applyPlayer(index) {
    const playing = settings.motion && !document.hidden && onScreen[index];
    // Autoplay failures leave a still image; other cards can continue normally.
    Promise.resolve(players[index].setPlaying(playing)).then(scheduleDraw, scheduleDraw);
  }
  function applySettings() {
    players.forEach(function (player, index) { applyPlayer(index); });
    if (document.hidden && frameRequest) { cancelAnimationFrame(frameRequest); frameRequest = 0; }
    scheduleDraw();
  }
  document.addEventListener('visibilitychange', applySettings);
  const canvases = ['suph-toga-canvas', 'suph-quran-canvas', 'suph-future-canvas'].map(function (id) {
    const canvas = root.querySelector('#' + id);
    return { canvas: canvas, ctx: canvas.getContext('2d'), dirty: true, hasFrame: false, time: -1 };
  });
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const index = canvases.findIndex(function (item) { return item.canvas === entry.target; });
        if (index < 0 || onScreen[index] === entry.isIntersecting) return;
        onScreen[index] = entry.isIntersecting;
        if (entry.isIntersecting) canvases[index].dirty = true;
        applyPlayer(index);
      });
    });
    canvases.forEach(function (item) { visibility.observe(item.canvas); });
  }
  players.forEach(function (player, index) {
    ['loadeddata', 'canplay', 'playing', 'pause', 'seeked', 'error'].forEach(function (event) {
      player.video.addEventListener(event, function () {
        canvases[index].dirty = true;
        scheduleDraw();
      });
    });
    // Each card reports each playback state at most once per page view.
    const reported = {};
    [['playing', 'playing'], ['pause', 'paused'], ['error', 'error']].forEach(function (pair) {
      player.video.addEventListener(pair[0], function () {
        if (reported[pair[1]]) return;
        reported[pair[1]] = true;
        track('gallery_video_state', { project: projects[index], state: pair[1] });
      });
    });
  });
  function resize() {
    canvases.forEach(function (item) {
      const box = item.canvas.getBoundingClientRect();
      if (box.width < 1) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(box.width * ratio), height = Math.round(box.height * ratio);
      if (item.canvas.width === width && item.canvas.height === height) return;
      item.canvas.width = width;
      item.canvas.height = height;
      item.dirty = true;
      item.hasFrame = false;
    });
    scheduleDraw();
  }
  const observer = new ResizeObserver(resize);
  canvases.forEach(function (item) { observer.observe(item.canvas); });
  function frame(now) {
    frameRequest = 0;
    if (!root.isConnected) { observer.disconnect(); players.forEach(function (p) { p.setPlaying(false); }); return; }
    if (document.hidden) return;
    if (now - lastDraw < 40) { scheduleDraw(); return; }
    lastDraw = now;
    canvases.forEach(function (item, index) {
      if (!onScreen[index]) return;
      const w = item.canvas.width, h = item.canvas.height;
      if (w < 1 || h < 1) return;
      const player = players[index], time = player.video.currentTime;
      if (!item.dirty && item.hasFrame && item.time === time) return;
      // The renderer paints a complete frame. Keep the previous image if decoding stalls.
      const rendered = player.draw(item.ctx, w, h, time, { texture: settings.texture, coarse: settings.grain === 'Coarse' });
      item.dirty = false;
      if (rendered) { item.hasFrame = true; item.time = time; }
      videoStatus[index].hidden = item.hasFrame;
      if (!item.hasFrame) videoStatus[index].textContent = player.error ? 'Video unavailable' : 'Loading video';
    });
    if (settings.motion && players.some(function (player, index) { return onScreen[index] && player.ready && !player.video.paused && !player.video.ended; })) scheduleDraw();
  }
  resize(); applySettings();
  }
})();
