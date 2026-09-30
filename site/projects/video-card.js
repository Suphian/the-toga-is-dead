(function () {
  'use strict';

  var BAYER_8 = [
     0,48,12,60, 3,51,15,63,
    32,16,44,28,35,19,47,31,
     8,56, 4,52,11,59, 7,55,
    40,24,36,20,43,27,39,23,
     2,50,14,62, 1,49,13,61,
    34,18,46,30,33,17,45,29,
    10,58, 6,54, 9,57, 5,53,
    42,26,38,22,41,25,37,21
  ];
  var GLYPHS = ' .,:;i!lI+tfLCG08@';
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function number(value, fallback) { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
  function ease(value) { value = clamp(value, 0, 1); return value * value * (3 - 2 * value); }
  function seeded(x, y) {
    var n = Math.imul(x + 17, 374761393) + Math.imul(y + 31, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  window.createSuphVideoCard = function (sourceUrl, options) {
    options = options || {};
    var video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.autoplay = true;
    video.preload = 'auto';
    video.playbackRate = 0.75;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    video.style.cssText = 'position:fixed;left:-4px;top:-4px;width:1px;height:1px;opacity:0;pointer-events:none;';

    var source = document.createElement('canvas');
    var sourceCtx = source.getContext('2d', { willReadFrequently: true });
    var output = document.createElement('canvas');
    var outCtx = output.getContext('2d');
    var outputImage = null;
    var tones = null;
    var lastFrameTime = -1;
    var lastSettingsKey = '';
    var playbackError = null;
    var wantsPlaying = true;
    var playRequest = 0;
    var hasRendered = false;
    var blackPoint = clamp(number(options.blackPoint, 0.055), 0, 0.8);
    var whitePoint = clamp(number(options.whitePoint, 0.98), blackPoint + 0.01, 1);
    var contrast = clamp(number(options.contrast, 1.08), 0.1, 3);
    var gamma = clamp(number(options.gamma, 0.96), 0.3, 3);
    var cropX = clamp(number(options.cropX, 0.5), 0, 1);
    var cropY = clamp(number(options.cropY, 0.5), 0, 1);
    var zoom = clamp(number(options.zoom, 1), 1, 8);
    var feather = clamp(number(options.feather, 0.035), 0, 0.3);

    function ready() {
      return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    }

    function play() {
      wantsPlaying = true;
      var request = ++playRequest;
      playbackError = null;
      try {
        var result = video.play();
        if (result && typeof result.then === 'function') {
          return result.then(function () {
            if (request === playRequest && wantsPlaying) playbackError = null;
            return true;
          }).catch(function (error) {
            if (request === playRequest && wantsPlaying && error.name !== 'AbortError') {
              playbackError = error.name === 'NotAllowedError'
                ? 'Playback requires a click or tap. Call setPlaying(true) from that interaction.'
                : 'Video playback failed: ' + (error.message || error.name || 'unknown error');
            }
            return false;
          });
        }
        return Promise.resolve(true);
      } catch (error) {
        playbackError = 'Video playback failed: ' + (error.message || 'unknown error');
        return Promise.resolve(false);
      }
    }

    video.addEventListener('error', function () {
      var code = video.error && video.error.code;
      var reasons = {
        1: 'Video loading was interrupted.',
        2: 'The video could not be downloaded.',
        3: 'The browser could not decode this video.',
        4: 'The video format or source URL is unsupported.'
      };
      playbackError = reasons[code] || playbackError || 'The video could not be loaded.';
    });
    video.addEventListener('loadeddata', function () {
      lastFrameTime = -1;
      if (wantsPlaying && video.paused) play();
    });
    video.addEventListener('seeked', function () { lastFrameTime = -1; });
    video.addEventListener('playing', function () { playbackError = null; });
    // sourceUrl is one URL or a list of URLs; the browser plays the first format it supports.
    var sourceUrls = Array.isArray(sourceUrl) ? sourceUrl : [sourceUrl];
    if (sourceUrls.length === 1) video.src = sourceUrls[0];
    else sourceUrls.forEach(function (url, index) {
      var element = document.createElement('source');
      element.src = url;
      if (/\.webm$/i.test(url)) element.type = 'video/webm; codecs="vp9"';
      else if (/\.mp4$/i.test(url)) element.type = 'video/mp4';
      // With <source> children, load failures surface on the last one, not on the video.
      if (index === sourceUrls.length - 1) element.addEventListener('error', function () {
        playbackError = 'The video format or source URL is unsupported.';
        // <source> errors do not bubble; re-signal on the video so listeners (home.js) redraw the status.
        video.dispatchEvent(new Event('error'));
      });
      video.appendChild(element);
    });
    (document.body || document.documentElement).appendChild(video);
    video.load();
    play();

    function resize(width, height) {
      if (source.width === width && source.height === height && outputImage && tones) return;
      source.width = output.width = width;
      source.height = output.height = height;
      outputImage = outCtx.createImageData(width, height);
      tones = new Float32Array(width * height);
      hasRendered = false;
      lastFrameTime = -1;
    }

    function renderFrame(width, height, texture, coarse) {
      var ratio = width / height;
      var cropWidth = video.videoWidth;
      var cropHeight = video.videoHeight;
      if (cropWidth / cropHeight > ratio) cropWidth = cropHeight * ratio;
      else cropHeight = cropWidth / ratio;
      cropWidth /= zoom;
      cropHeight /= zoom;
      var sx = (video.videoWidth - cropWidth) * cropX;
      var sy = (video.videoHeight - cropHeight) * cropY;
      sourceCtx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
      var pixels = sourceCtx.getImageData(0, 0, width, height).data;
      var x, y, index, light, edge;
      var edgeWidth = Math.max(1, Math.min(width, height) * feather);
      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          index = y * width + x;
          var offset = index * 4;
          light = (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
          if (options.invert) light = 1 - light;
          light = clamp((light - blackPoint) / (whitePoint - blackPoint), 0, 1);
          light = Math.pow(clamp((light - 0.5) * contrast + 0.5, 0, 1), gamma);
          if (feather > 0) {
            edge = ease(Math.min(x, width - 1 - x, y, height - 1 - y) / edgeWidth);
            light = 1 - (1 - light) * edge;
          }
          tones[index] = light;
        }
      }

      // Accent follows actual footage time; it does not suggest an event absent from the clip.
      var duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      var accentAt = clamp(number(options.redAccentAt, duration * 0.57), 0, Math.max(0, duration - 0.35));
      var accentActive = Boolean(options.redAccent) && video.currentTime >= accentAt && video.currentTime < accentAt + 0.35;
      function redAt(px, py, luminance) {
        return accentActive && luminance > 0.60 && luminance < 0.92 &&
          px > width * 0.1 && px < width * 0.9 && py > height * 0.1 && py < height * 0.9 &&
          seeded(px, py) < 0.004;
      }

      if (texture === 'ASCII') {
        outCtx.fillStyle = '#fff';
        outCtx.fillRect(0, 0, width, height);
        var cellWidth = coarse ? 5.1 : 4.45;
        var cellHeight = coarse ? 8 : 7;
        outCtx.font = (coarse ? 8 : 7.1) + 'px "Courier New", monospace';
        outCtx.textAlign = 'center';
        outCtx.textBaseline = 'middle';
        outCtx.fillStyle = '#111111';
        for (y = cellHeight / 2; y < height; y += cellHeight) {
          for (x = cellWidth / 2; x < width; x += cellWidth) {
            // Average each character's area so fine highlights remain stable in motion.
            var sum = 0, count = 0;
            for (var yy = Math.max(0, Math.floor(y - cellHeight * 0.4)); yy < Math.min(height, y + cellHeight * 0.4); yy += 2) {
              for (var xx = Math.max(0, Math.floor(x - cellWidth * 0.4)); xx < Math.min(width, x + cellWidth * 0.4); xx += 2) {
                sum += tones[yy * width + xx]; count++;
              }
            }
            light = count ? sum / count : 1;
            var glyph = GLYPHS[Math.round((1 - light) * (GLYPHS.length - 1))];
            if (glyph === ' ') continue;
            var redGlyph = accentActive && light > 0.60 && light < 0.92 && seeded(Math.floor(x), Math.floor(y)) < 0.03;
            outCtx.fillStyle = redGlyph ? '#e32626' : '#111111';
            outCtx.fillText(glyph, x, y);
          }
        }
      } else {
        var target = outputImage.data;
        for (y = 0; y < height; y++) {
          for (x = 0; x < width; x++) {
            index = y * width + x;
            light = tones[index];
            var value = texture === 'Film' ? Math.round(light * 255) : (light > (BAYER_8[(y & 7) * 8 + (x & 7)] + 0.5) / 64 ? 255 : 0);
            var outputOffset = index * 4;
            var red = redAt(x, y, light) && (texture === 'Film' || value === 0);
            target[outputOffset] = red ? 227 : value;
            target[outputOffset + 1] = red ? 38 : value;
            target[outputOffset + 2] = red ? 38 : value;
            target[outputOffset + 3] = 255;
          }
        }
        outCtx.putImageData(outputImage, 0, 0);
      }
      hasRendered = true;
    }

    var controller = {
      video: video,
      setPlaying: function (playing) {
        if (playing) return play();
        wantsPlaying = false;
        ++playRequest;
        video.pause();
        return Promise.resolve(true);
      },
      draw: function (ctx, w, h, t, settings) {
        settings = settings || {};
        if (!(w > 0 && h > 0)) return false;
        if (!ready()) return false;
        var texture = settings.texture === 'ASCII' || settings.texture === 'Film' ? settings.texture : 'Dither';
        var coarse = Boolean(settings.coarse);
        var maxWidth = coarse ? 300 : 420;
        var width = Math.max(1, Math.min(maxWidth, Math.round(w)));
        var height = Math.max(1, Math.round(width * h / w));
        resize(width, height);
        var settingsKey = texture + ':' + coarse + ':' + width + ':' + height;
        // Decode timing belongs to the native video; t intentionally does not seek or simulate motion.
        if (!hasRendered || settingsKey !== lastSettingsKey || Math.abs(video.currentTime - lastFrameTime) >= 1 / 32) {
          try {
            renderFrame(width, height, texture, coarse);
            lastFrameTime = video.currentTime;
            lastSettingsKey = settingsKey;
          } catch (error) {
            playbackError = 'Video frame processing failed: ' + (error.message || 'unknown error');
            return false;
          }
        }
        ctx.save();
        ctx.imageSmoothingEnabled = texture === 'Film';
        ctx.drawImage(output, 0, 0, w, h);
        ctx.restore();
        return true;
      }
    };
    Object.defineProperties(controller, {
      ready: { enumerable: true, get: ready },
      error: { enumerable: true, get: function () { return playbackError; } }
    });
    return controller;
  };
})();
