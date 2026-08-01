const assert = require('node:assert/strict');
const {
  DEFAULTS,
  EMBLEM_KEYS,
  PARTICLE_DEFAULTS,
  clampOpacity,
  clampProgress,
  createRenderState,
  getAnimatedOverlayState,
  getParticleCount,
  getParticleState,
  getMediaDimensions,
  getTimelineProgress,
  getVideoExportSettings,
  getOverlayLayout,
  getCanvasSize,
  getCoverRect,
  normalizeEmblem,
} = require('../renderer-core.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('16:9 mode uses 1920x1080 output', () => {
  assert.deepEqual(getCanvasSize('16:9', { width: 640, height: 480 }), {
    width: 1920,
    height: 1080,
  });
});

test('source mode follows uploaded image dimensions', () => {
  assert.deepEqual(getCanvasSize('source', { width: 1200, height: 800 }), {
    width: 1200,
    height: 800,
  });
});

test('source mode follows uploaded video dimensions', () => {
  assert.deepEqual(getMediaDimensions({ videoWidth: 1280, videoHeight: 720 }), {
    width: 1280,
    height: 720,
  });
  assert.deepEqual(getCanvasSize('source', { videoWidth: 1280, videoHeight: 720 }), {
    width: 1280,
    height: 720,
  });
});

test('cover rect center-crops a tall source into 16:9 canvas', () => {
  const rect = getCoverRect(1000, 1000, 1920, 1080);
  assert.equal(rect.dw, 1920);
  assert.equal(rect.dh, 1920);
  assert.equal(rect.dx, 0);
  assert.equal(rect.dy, -420);
});

test('default render state matches requested overlay defaults', () => {
  const state = createRenderState();
  assert.equal(DEFAULTS.mode, '16:9');
  assert.equal(DEFAULTS.emblem, 'mengdei');
  assert.equal(state.mode, '16:9');
  assert.equal(state.emblem, 'mengdei');
  assert.equal(state.line1, '序章 第一幕 完成');
  assert.equal(state.line2, '捕风的异乡人');
  assert.equal(state.line3, '任务完成');
  assert.equal(state.line4, '未完待续');
  assert.equal(state.overlayColor, '#12151f');
  assert.equal(state.overlayOpacity, 0.62);
});

test('emblem keys list every supported option in canonical order', () => {
  assert.deepEqual(EMBLEM_KEYS, [
    'mengdei',
    'liyue',
    'daoqi',
    'xuni',
    'fengdan',
    'nata',
    'nuodekalai',
  ]);
});

test('emblem normalization accepts supported values', () => {
  assert.equal(normalizeEmblem('fengdan'), 'fengdan');
  assert.equal(createRenderState({ emblem: 'nata' }).emblem, 'nata');
});

test('unknown emblem values fall back to the default', () => {
  assert.equal(normalizeEmblem('unknown'), 'mengdei');
  assert.equal(createRenderState({ emblem: 'unknown' }).emblem, 'mengdei');
});

test('render state accepts editable lines and overlay overrides', () => {
  const state = createRenderState({
    line1: '第一章 完成',
    line2: '新的标题',
    overlayColor: '#000000',
    overlayOpacity: 0.8,
    mode: 'source',
  });
  assert.equal(state.line1, '第一章 完成');
  assert.equal(state.line2, '新的标题');
  assert.equal(state.line3, '任务完成');
  assert.equal(state.line4, '未完待续');
  assert.equal(state.overlayColor, '#000000');
  assert.equal(state.overlayOpacity, 0.8);
  assert.equal(state.mode, 'source');
});

test('opacity is clamped between 0 and 1', () => {
  assert.equal(clampOpacity(-0.1), 0);
  assert.equal(clampOpacity(0.4), 0.4);
  assert.equal(clampOpacity(2), 1);
});

test('animation progress is clamped between 0 and 1', () => {
  assert.equal(clampProgress(-0.2), 0);
  assert.equal(clampProgress(0.4), 0.4);
  assert.equal(clampProgress(2), 1);
  assert.equal(clampProgress(Number.NaN), 0);
});

test('video export settings use a short shareable 1080p timeline', () => {
  assert.deepEqual(getVideoExportSettings(), {
    durationMs: 3200,
    fps: 30,
    bitrate: 8_000_000,
    mp4Codec: 'avc1.42002A',
    mp4FileName: 'task-overlay-video.mp4',
    webmMimeType: 'video/webm;codecs=vp9',
    webmFileName: 'task-overlay-video.webm',
  });
});

test('animated overlay brings title elements in together before task text', () => {
  const settings = getVideoExportSettings();
  const at300ms = getAnimatedOverlayState(300 / settings.durationMs);
  assert.ok(at300ms.emblemAlpha > 0.75);
  assert.ok(at300ms.line1Alpha > 0.75);
  assert.ok(at300ms.line2Alpha > 0.75);
  assert.ok(at300ms.dividerProgress > 0.75);
  assert.equal(at300ms.taskBandProgress, 0);
  assert.equal(at300ms.continuationAlpha, 0);

  const at800ms = getAnimatedOverlayState(800 / settings.durationMs);
  assert.ok(at800ms.emblemAlpha > 0.98);
  assert.ok(at800ms.line1Alpha > 0.98);
  assert.ok(at800ms.line2Alpha > 0.98);
  assert.ok(at800ms.dividerProgress > 0.98);
  assert.ok(at800ms.taskBandProgress > 0.65);
  assert.ok(at800ms.continuationAlpha > 0.65);
});

test('animated overlay starts hidden and ends matching the still layout', () => {
  const start = getAnimatedOverlayState(0);
  assert.equal(start.overlayAlpha, 0);
  assert.equal(start.emblemAlpha, 0);
  assert.equal(start.line1Alpha, 0);
  assert.equal(start.line2Alpha, 0);
  assert.equal(start.dividerProgress, 0);
  assert.equal(start.taskBandProgress, 0);
  assert.equal(start.continuationAlpha, 0);

  const end = getAnimatedOverlayState(1);
  assert.equal(end.overlayAlpha, 1);
  assert.equal(end.emblemAlpha, 1);
  assert.equal(end.line1Alpha, 1);
  assert.equal(end.line2Alpha, 1);
  assert.equal(end.dividerProgress, 1);
  assert.equal(end.taskBandProgress, 1);
  assert.equal(end.continuationAlpha, 1);
  assert.equal(end.emblemScale, 1);
  assert.equal(end.line2Scale, 1);
});

test('particle state is deterministic for the same seed and timeline position', () => {
  const options = { seed: 'overlay-studio', elapsedMs: 1450 };
  const first = getParticleState(1920, 1080, 0.65, options);
  const second = getParticleState(1920, 1080, 0.65, options);
  const differentSeed = getParticleState(1920, 1080, 0.65, {
    ...options,
    seed: 'another-seed',
  });

  assert.deepEqual(first, second);
  assert.notDeepEqual(first.particles, differentSeed.particles);
  assert.equal(first.count, first.particles.length);
});

test('particle reveal starts fully transparent and has a stable final state', () => {
  const start = getParticleState({
    width: 1920,
    height: 1080,
    progress: 0,
    seed: 42,
  });
  const end = getParticleState({
    width: 1920,
    height: 1080,
    progress: 1,
    seed: 42,
  });

  assert.ok(start.particles.length > 0);
  assert.ok(start.particles.every((particle) => particle.alpha === 0));
  assert.ok(end.particles.every((particle) => particle.alpha > 0));
  assert.deepEqual(
    end,
    getParticleState({ width: 1920, height: 1080, progress: 1, seed: 42 })
  );
});

test('particle count grows with canvas area and remains capped', () => {
  const smallCount = getParticleCount(640, 360);
  const hdCount = getParticleCount(1920, 1080);
  const oversizedCount = getParticleCount(15_360, 8640);
  const oversizedState = getParticleState(15_360, 8640, 1);

  assert.ok(smallCount >= PARTICLE_DEFAULTS.minCount);
  assert.ok(smallCount <= hdCount);
  assert.ok(hdCount <= oversizedCount);
  assert.equal(oversizedCount, PARTICLE_DEFAULTS.maxCount);
  assert.equal(oversizedState.count, PARTICLE_DEFAULTS.maxCount);
  assert.equal(oversizedState.particles.length, PARTICLE_DEFAULTS.maxCount);
});

test('particle frame values stay finite and inside the requested canvas', () => {
  const state = getParticleState(1280, 720, 0.8, {
    seed: 7,
    elapsedMs: 2800,
    maxCount: 24,
  });

  assert.ok(state.particles.length <= 24);
  for (const particle of state.particles) {
    assert.ok(Number.isFinite(particle.x));
    assert.ok(Number.isFinite(particle.y));
    assert.ok(Number.isFinite(particle.alpha));
    assert.ok(particle.x >= 0 && particle.x <= state.width);
    assert.ok(particle.y >= 0 && particle.y <= state.height);
    assert.ok(particle.radius > 0);
    assert.ok(particle.alpha >= 0 && particle.alpha <= particle.maxAlpha);
  }
});

test('animated overlay delays task complete and continuation by about half a second', () => {
  const settings = getVideoExportSettings();
  const beforeTask = getAnimatedOverlayState(480 / settings.durationMs);
  assert.ok(beforeTask.emblemAlpha > 0.95);
  assert.ok(beforeTask.line1Alpha > 0.95);
  assert.ok(beforeTask.line2Alpha > 0.95);
  assert.ok(beforeTask.dividerProgress > 0.95);
  assert.equal(beforeTask.taskBandProgress, 0);
  assert.equal(beforeTask.continuationAlpha, 0);

  const afterTask = getAnimatedOverlayState(720 / settings.durationMs);
  assert.ok(afterTask.taskBandProgress > 0.2);
  assert.ok(afterTask.continuationAlpha > 0.2);

  const middle = getAnimatedOverlayState(0.28);
  assert.ok(middle.overlayAlpha > 0.9);
  assert.ok(middle.emblemAlpha > 0.8);
  assert.ok(middle.line2Alpha > 0.75);
  assert.ok(middle.dividerProgress > 0.75);
  assert.ok(middle.taskBandProgress > 0.65);
  assert.ok(middle.continuationAlpha > 0.65);
});

test('image exports animate from the beginning while video exports animate at the end', () => {
  const settings = getVideoExportSettings();
  assert.equal(getTimelineProgress(0, settings.durationMs, 'image'), 0);
  assert.equal(getTimelineProgress(1600, settings.durationMs, 'image'), 0.5);
  assert.equal(getTimelineProgress(0, 10_000, 'video'), 0);
  assert.equal(getTimelineProgress(6000, 10_000, 'video'), 0);
  assert.ok(getTimelineProgress(7200, 10_000, 'video') > 0);
  assert.equal(getTimelineProgress(10_000, 10_000, 'video'), 1);
});

test('overlay layout keeps the first two text lines separated', () => {
  const layout = getOverlayLayout(1920, 1080);
  const line1Bottom = layout.line1Y + layout.line1Size / 2;
  const line2Top = layout.line2Y - layout.line2Size / 2;
  assert.ok(line2Top - line1Bottom >= 8);
  assert.ok(layout.emblemY + layout.emblemSize * 0.5 < layout.line1Y - layout.line1Size * 0.35);
});

test('overlay layout is centered and ordered on one visual axis', () => {
  const layout = getOverlayLayout(1920, 1080);
  assert.equal(layout.cx, 960);
  assert.ok(layout.emblemY < layout.line1Y);
  assert.ok(layout.line1Y < layout.line2Y);
  assert.ok(layout.line2Y < layout.dividerY);
  assert.ok(layout.dividerY < layout.taskY);
  assert.ok(layout.taskY < layout.bottomY);
});

test('fixed task section uses reference-like restrained widths', () => {
  const layout = getOverlayLayout(1920, 1080);
  assert.ok(layout.dividerWidth >= 640 && layout.dividerWidth <= 660);
  assert.ok(layout.taskBandWidth >= 485 && layout.taskBandWidth <= 495);
  assert.ok(layout.taskWidth >= 210 && layout.taskWidth <= 220);
  assert.ok(layout.continuationWidth >= 220 && layout.continuationWidth <= 240);
});
