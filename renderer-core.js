const EMBLEM_KEYS = Object.freeze([
  'mengdei',
  'liyue',
  'daoqi',
  'xuni',
  'fengdan',
  'nata',
  'nuodekalai',
]);

const DEFAULTS = {
  mode: '16:9',
  emblem: 'mengdei',
  outputWidth: 1920,
  outputHeight: 1080,
  line1: '序章 第一幕 完成',
  line2: '捕风的异乡人',
  line3: '任务完成',
  line4: '未完待续',
  overlayColor: '#12151f',
  overlayOpacity: 0.62,
};

const VIDEO_EXPORT_SETTINGS = Object.freeze({
  durationMs: 3200,
  fps: 30,
  bitrate: 8_000_000,
  mp4Codec: 'avc1.42002A',
  mp4FileName: 'task-overlay-video.mp4',
  webmMimeType: 'video/webm;codecs=vp9',
  webmFileName: 'task-overlay-video.webm',
});

function clampOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULTS.overlayOpacity;
  }
  return Math.min(1, Math.max(0, number));
}

function clampProgress(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(1, Math.max(0, number));
}

function easeOutCubic(value) {
  const progress = clampProgress(value);
  return 1 - Math.pow(1 - progress, 3);
}

function easeOutBack(value) {
  const progress = clampProgress(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
}

function rangeProgress(progress, start, end) {
  if (end <= start) {
    return clampProgress(progress >= end ? 1 : 0);
  }
  return clampProgress((clampProgress(progress) - start) / (end - start));
}

function getAnimatedOverlayState(progress) {
  const clamped = clampProgress(progress);
  return {
    progress: clamped,
    overlayAlpha: easeOutCubic(rangeProgress(clamped, 0, 0.12)),
    emblemAlpha: easeOutCubic(rangeProgress(clamped, 0.02, 0.12)),
    emblemScale: 0.84 + easeOutBack(rangeProgress(clamped, 0.02, 0.16)) * 0.16,
    line1Alpha: easeOutCubic(rangeProgress(clamped, 0.02, 0.12)),
    line1OffsetY: (1 - easeOutCubic(rangeProgress(clamped, 0.02, 0.12))) * 16,
    line2Alpha: easeOutCubic(rangeProgress(clamped, 0.02, 0.12)),
    line2Scale: 0.94 + easeOutBack(rangeProgress(clamped, 0.02, 0.16)) * 0.06,
    dividerProgress: easeOutCubic(rangeProgress(clamped, 0.02, 0.12)),
    taskBandProgress: easeOutCubic(rangeProgress(clamped, 0.17, 0.26)),
    continuationAlpha: easeOutCubic(rangeProgress(clamped, 0.17, 0.28)),
  };
}

function getVideoExportSettings() {
  return { ...VIDEO_EXPORT_SETTINGS };
}

function getTimelineProgress(elapsedMs, durationMs, mediaType = 'image') {
  const total = Math.max(1, Number(durationMs) || VIDEO_EXPORT_SETTINGS.durationMs);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (mediaType === 'video') {
    const animationStart = Math.max(0, total - VIDEO_EXPORT_SETTINGS.durationMs);
    return clampProgress((elapsed - animationStart) / VIDEO_EXPORT_SETTINGS.durationMs);
  }
  return clampProgress(elapsed / VIDEO_EXPORT_SETTINGS.durationMs);
}

function normalizeEmblem(value) {
  return EMBLEM_KEYS.includes(value) ? value : DEFAULTS.emblem;
}

function getMediaDimensions(media) {
  if (media?.videoWidth > 0 && media?.videoHeight > 0) {
    return {
      width: Math.round(media.videoWidth),
      height: Math.round(media.videoHeight),
    };
  }
  if (media?.width > 0 && media?.height > 0) {
    return {
      width: Math.round(media.width),
      height: Math.round(media.height),
    };
  }
  return null;
}

function getCanvasSize(mode, media) {
  const dimensions = getMediaDimensions(media);
  if (mode === 'source' && dimensions) {
    return dimensions;
  }
  return {
    width: DEFAULTS.outputWidth,
    height: DEFAULTS.outputHeight,
  };
}

function getCoverRect(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const dw = imageWidth * scale;
  const dh = imageHeight * scale;
  return {
    dx: (canvasWidth - dw) / 2,
    dy: (canvasHeight - dh) / 2,
    dw,
    dh,
  };
}

function createRenderState(overrides = {}) {
  return {
    mode: overrides.mode || DEFAULTS.mode,
    emblem: normalizeEmblem(overrides.emblem),
    line1: overrides.line1 ?? DEFAULTS.line1,
    line2: overrides.line2 ?? DEFAULTS.line2,
    line3: DEFAULTS.line3,
    line4: DEFAULTS.line4,
    overlayColor: overrides.overlayColor || DEFAULTS.overlayColor,
    overlayOpacity: clampOpacity(overrides.overlayOpacity ?? DEFAULTS.overlayOpacity),
  };
}

function getOverlayLayout(width, height) {
  const scale = Math.min(width / 1920, height / 1080);
  const emblemSize = Math.min(Math.max(width * 0.102, 116 * scale), 178 * scale);
  return {
    scale,
    cx: width / 2,
    emblemSize,
    emblemY: height * 0.2,
    line1Y: height * 0.338,
    line1Size: Math.max(18, width * 0.0185),
    line2Y: height * 0.41,
    line2Size: Math.max(28, width * 0.034),
    dividerY: height * 0.49,
    dividerWidth: width * 0.34,
    taskBandY: height * 0.535,
    taskBandWidth: width * 0.255,
    taskBandHeight: height * 0.038,
    taskY: height * 0.535,
    taskWidth: width * 0.112,
    bottomY: height * 0.842,
    continuationWidth: width * 0.12,
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    DEFAULTS,
    EMBLEM_KEYS,
    clampOpacity,
    clampProgress,
    createRenderState,
    getAnimatedOverlayState,
    getMediaDimensions,
    getTimelineProgress,
    getVideoExportSettings,
    getOverlayLayout,
    getCanvasSize,
    getCoverRect,
    normalizeEmblem,
  };
}
