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

function clampOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DEFAULTS.overlayOpacity;
  }
  return Math.min(1, Math.max(0, number));
}

function normalizeEmblem(value) {
  return EMBLEM_KEYS.includes(value) ? value : DEFAULTS.emblem;
}

function getCanvasSize(mode, image) {
  if (mode === 'source' && image?.width > 0 && image?.height > 0) {
    return {
      width: Math.round(image.width),
      height: Math.round(image.height),
    };
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
    createRenderState,
    getOverlayLayout,
    getCanvasSize,
    getCoverRect,
    normalizeEmblem,
  };
}
