const assert = require('node:assert/strict');
const {
  DEFAULTS,
  clampOpacity,
  createRenderState,
  getOverlayLayout,
  getCanvasSize,
  getCoverRect,
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
  assert.equal(state.mode, '16:9');
  assert.equal(state.line1, '序章 第一幕 完成');
  assert.equal(state.line2, '捕风的异乡人');
  assert.equal(state.line3, '任务完成');
  assert.equal(state.line4, '未完待续');
  assert.equal(state.overlayColor, '#12151f');
  assert.equal(state.overlayOpacity, 0.62);
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
