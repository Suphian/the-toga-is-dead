(function () {
  'use strict';
  const root = document.getElementById('suph-home-concept');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settings = { texture: 'Dither', motion: !reduced, grain: 'Fine' };
  const players = [
    window.createSuphVideoCard('/assets/projects/toga.mp4', { cropX: .52, cropY: .48, gamma: .72, contrast: 1.04, feather: .035, redAccent: true }),
    window.createSuphVideoCard('/assets/projects/quran.mp4', { cropX: .63, cropY: .48, gamma: .88, contrast: 1.13, feather: .035 }),
    window.createSuphVideoCard('/assets/projects/coming.mp4', { gamma: .72, whitePoint: .78, contrast: 1.1, feather: .035, redAccent: true })
  ];
  const videoStatus = ['toga', 'quran', 'coming'].map(function (name) { return root.querySelector('[data-video-status="' + name + '"]'); });
  let frameRequest = 0, lastDraw = 0;
  function scheduleDraw() {
    if (!frameRequest && !document.hidden && root.isConnected) frameRequest = requestAnimationFrame(frame);
  }
  function applySettings() {
    const playing = settings.motion && !document.hidden;
    players.forEach(function (player) {
      // Autoplay failures leave a still image; other cards can continue normally.
      Promise.resolve(player.setPlaying(playing)).then(scheduleDraw, scheduleDraw);
    });
    if (document.hidden && frameRequest) { cancelAnimationFrame(frameRequest); frameRequest = 0; }
    scheduleDraw();
  }
  document.addEventListener('visibilitychange', applySettings);
  const canvases = ['suph-toga-canvas', 'suph-quran-canvas', 'suph-future-canvas'].map(function (id) {
    const canvas = root.querySelector('#' + id);
    return { canvas: canvas, ctx: canvas.getContext('2d'), dirty: true, hasFrame: false, time: -1 };
  });
  players.forEach(function (player, index) {
    ['loadeddata', 'canplay', 'playing', 'pause', 'seeked', 'error'].forEach(function (event) {
      player.video.addEventListener(event, function () {
        canvases[index].dirty = true;
        scheduleDraw();
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
    if (settings.motion && players.some(function (player) { return player.ready && !player.video.paused && !player.video.ended; })) scheduleDraw();
  }
  resize(); applySettings();
})();
