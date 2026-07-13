const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const coreSource = fs.readFileSync(path.join(root, 'renderer-core.js'), 'utf8');
const scriptSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const emblemKeys = [
  'mengdei',
  'liyue',
  'daoqi',
  'xuni',
  'fengdan',
  'nata',
  'nuodekalai',
];

function createElement(initial = {}) {
  const listeners = new Map();
  return {
    value: '',
    textContent: '',
    disabled: false,
    files: [],
    style: {},
    ...initial,
    addEventListener(type, listener) {
      const registered = listeners.get(type) || [];
      registered.push(listener);
      listeners.set(type, registered);
    },
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ target: this });
      }
    },
    click() {
      this.clicked = true;
    },
  };
}

function createDrawingContext(drawCalls) {
  const gradient = () => ({ addColorStop() {} });
  return {
    clearRect() {},
    drawImage(...args) {
      drawCalls.push(args);
    },
    fillRect() {},
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    strokeText() {},
    fillText() {},
    measureText(text) {
      return { width: String(text).length * 10 };
    },
  };
}

function scheduleTicks(count, callback) {
  if (count <= 0) {
    queueMicrotask(callback);
    return;
  }
  setImmediate(() => scheduleTicks(count - 1, callback));
}

function createHarness(options = {}) {
  const drawCalls = [];
  const scratchCanvases = [];
  const failedSources = new Set(options.failedSources || []);
  const heldSources = new Set(options.heldSources || []);
  const heldLoads = new Map();
  const delayTicks = options.delayTicks || {};
  const alphaModes = options.alphaModes || {};

  const elements = {
    imageInput: createElement(),
    line1Input: createElement({ value: '序章 第一幕 完成' }),
    line2Input: createElement({ value: '捕风的异乡人' }),
    overlayColorInput: createElement({ value: '#000000' }),
    overlayOpacityInput: createElement({ value: '0.45' }),
    opacityValue: createElement({ textContent: '45%' }),
    exportButton: createElement(),
    statusText: createElement({ textContent: '上传图片后可导出生成结果。' }),
  };

  const optionsByKey = Object.fromEntries(
    emblemKeys.map((key) => [key, createElement({ value: key })])
  );
  elements.emblemSelect = createElement({ value: options.initialEmblem || 'mengdei' });
  elements.emblemSelect.querySelector = (selector) => {
    const match = selector.match(/^option\[value="([^"]+)"\]$/u);
    return match ? optionsByKey[match[1]] || null : null;
  };

  const mainContext = createDrawingContext(drawCalls);
  const mainCanvas = createElement({
    width: 1920,
    height: 1080,
    getContext() {
      return mainContext;
    },
    toBlob(callback) {
      callback(options.exportBlob === null ? null : { type: 'image/png' });
    },
  });
  elements.previewCanvas = mainCanvas;

  const modeInput = createElement({ value: '16:9', checked: true });
  const bodyClasses = new Set();

  function createScratchCanvas() {
    let width = 0;
    let height = 0;
    let source = null;
    const scratch = {
      get width() {
        return width;
      },
      set width(value) {
        width = value;
      },
      get height() {
        return height;
      },
      set height(value) {
        height = value;
      },
      getContext() {
        return {
          drawImage(image) {
            source = image;
          },
          getImageData(x, y, scanWidth, scanHeight) {
            assert.ok(
              scanWidth <= 512 && scanHeight <= 512,
              `visible-bound scan requested ${scanWidth}x${scanHeight}`
            );
            const data = new Uint8ClampedArray(scanWidth * scanHeight * 4);
            const mode = alphaModes[source?.src] || options.alphaMode || 'opaque';
            for (let scanY = 0; scanY < scanHeight; scanY += 1) {
              for (let scanX = 0; scanX < scanWidth; scanX += 1) {
                const visible = mode === 'opaque'
                  || (mode === 'center'
                    && scanX >= scanWidth * 0.25
                    && scanX < scanWidth * 0.75
                    && scanY >= scanHeight * 0.25
                    && scanY < scanHeight * 0.75);
                if (visible) {
                  data[(scanY * scanWidth + scanX) * 4 + 3] = 255;
                }
              }
            }
            return { data };
          },
        };
      },
    };
    scratchCanvases.push(scratch);
    return scratch;
  }

  const document = {
    body: {
      classList: {
        add(name) {
          bodyClasses.add(name);
        },
      },
    },
    getElementById(id) {
      return elements[id] || null;
    },
    querySelector(selector) {
      return selector === 'input[name="sizeMode"]:checked' ? modeInput : null;
    },
    querySelectorAll(selector) {
      return selector === 'input[name="sizeMode"]' ? [modeInput] : [];
    },
    createElement(tagName) {
      if (tagName === 'canvas') {
        return createScratchCanvas();
      }
      return createElement();
    },
  };

  function getDimensions(src) {
    if (options.dimensions?.[src]) {
      return options.dimensions[src];
    }
    if (src === 'assets/weiwandaixu-clean.png') {
      return { width: 64, height: 32 };
    }
    if (options.largeEmblems && /^assets\/(?:mengdei|liyue|daoqi|xuni|fengdan|nata|nuodekalai)\.png$/u.test(src)) {
      return { width: 2446, height: 2446 };
    }
    return /^assets\//u.test(src)
      ? { width: 64, height: 64 }
      : { width: 320, height: 180 };
  }

  class FakeImage {
    set src(value) {
      this._src = value;
      const dimensions = getDimensions(value);
      this.width = dimensions.width;
      this.height = dimensions.height;
      this.naturalWidth = dimensions.width;
      this.naturalHeight = dimensions.height;
      const complete = () => {
        if (failedSources.has(value)) {
          this.onerror?.(new Error(`failed ${value}`));
        } else {
          this.onload?.();
        }
      };
      if (heldSources.has(value)) {
        const pending = heldLoads.get(value) || [];
        pending.push(complete);
        heldLoads.set(value, pending);
      } else {
        scheduleTicks(delayTicks[value] || 0, complete);
      }
    }

    get src() {
      return this._src;
    }
  }

  const objectUrls = [];
  const context = vm.createContext({
    console,
    document,
    window: { location: { search: options.search || '' } },
    Image: FakeImage,
    URL: {
      createObjectURL(value) {
        const url = value?.name ? `blob:${value.name}` : 'blob:export';
        objectUrls.push(url);
        return url;
      },
      revokeObjectURL() {},
    },
    URLSearchParams,
  });

  vm.runInContext(coreSource, context, { filename: 'renderer-core.js' });
  vm.runInContext(scriptSource, context, { filename: 'script.js' });

  return {
    drawCalls,
    elements,
    optionsByKey,
    scratchCanvases,
    release(source) {
      heldSources.delete(source);
      for (const complete of heldLoads.get(source) || []) {
        scheduleTicks(0, complete);
      }
      heldLoads.delete(source);
    },
    async flush(turns = 12) {
      for (let index = 0; index < turns; index += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    },
  };
}

const tests = [];
function test(name, callback) {
  tests.push([name, callback]);
}

test('one failed emblem disables only that option and falls back canonically', async () => {
  const harness = createHarness({
    initialEmblem: 'xuni',
    failedSources: ['assets/xuni.png'],
    delayTicks: { 'assets/mengdei.png': 3 },
  });
  await harness.flush();

  assert.equal(harness.optionsByKey.xuni.disabled, true);
  for (const key of emblemKeys.filter((key) => key !== 'xuni')) {
    assert.equal(harness.optionsByKey[key].disabled, false, `${key} should remain enabled`);
  }
  assert.equal(harness.elements.emblemSelect.value, 'mengdei');
  assert.match(harness.elements.statusText.textContent, /须弥/u);
});

test('asset warning remains visible after upload and export activity', async () => {
  const harness = createHarness({ failedSources: ['assets/xuni.png'] });
  await harness.flush();

  harness.elements.imageInput.files = [{ name: 'later.png' }];
  harness.elements.imageInput.dispatch('change');
  await harness.flush();
  assert.match(harness.elements.statusText.textContent, /later\.png/u);
  assert.match(harness.elements.statusText.textContent, /须弥/u);

  harness.elements.exportButton.dispatch('click');
  assert.match(harness.elements.statusText.textContent, /task-overlay\.png/u);
  assert.match(harness.elements.statusText.textContent, /须弥/u);
});

test('selection changes draw the selected asset and query selects nata', async () => {
  const harness = createHarness({ search: '?testImage=query.png&emblem=nata' });
  assert.equal(harness.elements.emblemSelect.value, 'nata');
  await harness.flush();

  harness.drawCalls.length = 0;
  harness.elements.emblemSelect.value = 'liyue';
  harness.elements.emblemSelect.dispatch('change');
  assert.ok(
    harness.drawCalls.some(([source]) => source?.src === 'assets/liyue.png'),
    'changing the selection should draw the Liyue emblem'
  );
});

test('a loaded default emblem renders before the slowest emblem finishes', async () => {
  const heldSources = emblemKeys
    .filter((key) => key !== 'mengdei')
    .map((key) => `assets/${key}.png`);
  const harness = createHarness({ heldSources });
  await harness.flush(4);

  assert.ok(
    harness.drawCalls.some(([source]) => source?.src === 'assets/mengdei.png'),
    'the default emblem should render while other loads are still pending'
  );

  for (const source of heldSources) {
    harness.release(source);
  }
  await harness.flush();
});

test('large visible-bound scans are downsampled and map back to source bounds', async () => {
  const harness = createHarness({ largeEmblems: true, alphaMode: 'center' });
  await harness.flush(20);

  assert.ok(harness.scratchCanvases.length >= emblemKeys.length);
  for (const scratch of harness.scratchCanvases) {
    assert.ok(scratch.width <= 512, `scratch width was ${scratch.width}`);
    assert.ok(scratch.height <= 512, `scratch height was ${scratch.height}`);
  }

  const emblemDraw = harness.drawCalls.find(
    ([source]) => source?.src === 'assets/mengdei.png'
  );
  assert.ok(emblemDraw, 'the large emblem should still draw');
  assert.ok(emblemDraw[1] > 0 && emblemDraw[2] > 0, 'transparent edges should be cropped');
  assert.ok(emblemDraw[3] < 2446 && emblemDraw[4] < 2446, 'bounds should map to source pixels');
});

test('fully transparent images safely fall back to full source bounds', async () => {
  const harness = createHarness({
    alphaModes: { 'assets/mengdei.png': 'transparent' },
  });
  await harness.flush();

  const emblemDraw = harness.drawCalls.find(
    ([source]) => source?.src === 'assets/mengdei.png'
  );
  assert.deepEqual(emblemDraw.slice(1, 5), [0, 0, 64, 64]);
});

(async () => {
  let failures = 0;
  for (const [name, callback] of tests) {
    try {
      await callback();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error.stack || error);
    }
  }
  if (failures > 0) {
    process.exitCode = 1;
  }
})();
