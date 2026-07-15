const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const coreSource = fs.readFileSync(path.join(root, 'renderer-core.js'), 'utf8');
const scriptSource = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const emblemCases = [
  { key: 'mengdei', label: '蒙德', src: 'assets/mengdei.png' },
  { key: 'liyue', label: '璃月', src: 'assets/liyue.png' },
  { key: 'daoqi', label: '稻妻', src: 'assets/daoqi.png' },
  { key: 'xuni', label: '须弥', src: 'assets/xuni.png' },
  { key: 'fengdan', label: '枫丹', src: 'assets/fengdan.png' },
  { key: 'nata', label: '纳塔', src: 'assets/nata.png' },
  { key: 'nuodekalai', label: '空月之歌', src: 'assets/nuodekalai.png' },
];
const emblemKeys = emblemCases.map(({ key }) => key);

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

function createDrawingContext(drawCalls, onRender) {
  const gradient = () => ({ addColorStop() {} });
  const stateStack = [];
  const context = {
    filter: 'none',
    globalCompositeOperation: 'source-over',
    clearRect() {
      onRender();
    },
    drawImage(...args) {
      const call = [...args];
      call.filter = this.filter;
      call.globalCompositeOperation = this.globalCompositeOperation;
      drawCalls.push(call);
    },
    fillRect() {},
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    save() {
      stateStack.push({
        filter: this.filter,
        globalCompositeOperation: this.globalCompositeOperation,
      });
    },
    restore() {
      Object.assign(this, stateStack.pop() || {});
    },
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
  return context;
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
  const maskDrawCalls = [];
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

  let renderCount = 0;
  const mainContext = createDrawingContext(drawCalls, () => {
    renderCount += 1;
    if (renderCount === options.throwOnRenderCount) {
      throw new Error(`render failed at attempt ${renderCount}`);
    }
  });
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
    const gradient = () => ({ addColorStop() {} });
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
          filter: 'none',
          globalCompositeOperation: 'source-over',
          drawImage(...args) {
            const [image] = args;
            source = image;
            if (args.length >= 9) {
              if (options.throwOnMaskDraw) {
                throw new Error('simulated mobile mask draw failure');
              }
              const call = [...args];
              call.filter = this.filter;
              call.globalCompositeOperation = this.globalCompositeOperation;
              maskDrawCalls.push(call);
            }
          },
          fillRect() {},
          createRadialGradient: gradient,
          getImageData(x, y, scanWidth, scanHeight) {
            if (options.throwOnGetImageData) {
              throw new Error('simulated mobile getImageData failure');
            }
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
    maskDrawCalls,
    elements,
    optionsByKey,
    scratchCanvases,
    get renderCount() {
      return renderCount;
    },
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

test('every canonical emblem key draws its exact asset path', async () => {
  for (const { key, src } of emblemCases) {
    const harness = createHarness({ search: `?testImage=query.png&emblem=${key}` });
    await harness.flush();

    assert.equal(harness.elements.emblemSelect.value, key);
    assert.ok(
      harness.maskDrawCalls.some(([source]) => source?.src === src),
      `${key} should draw ${src} into the gold emblem mask`
    );
  }
});

test('selected emblem is drawn with an ivory body, gold edge, and soft gold glow', async () => {
  const harness = createHarness({ search: '?testImage=query.png&emblem=mengdei' });
  await harness.flush();

  assert.ok(
    harness.maskDrawCalls.filter(([source]) => source?.src === 'assets/mengdei.png').length >= 2,
    'the selected emblem asset should feed both the blurred backlight and crisp body masks'
  );
  assert.ok(
    harness.drawCalls.some((call) =>
      !call[0]?.src &&
      call.filter === 'blur(4px)' &&
      call.globalCompositeOperation === 'screen'
    ),
    'the selected emblem should have a separate soft backlight layer'
  );
  assert.ok(
    harness.drawCalls.some((call) =>
      !call[0]?.src &&
      call.filter === 'drop-shadow(0 0 10px rgba(201, 169, 110, 0.6))' &&
      call.globalCompositeOperation === 'source-over'
    ),
    'the selected emblem should keep a tight requested soft gold drop-shadow on the crisp body'
  );
});

test('every failed emblem reports its exact label while other assets remain usable', async () => {
  for (const { key, label, src } of emblemCases) {
    const harness = createHarness({
      initialEmblem: key,
      failedSources: [src],
      delayTicks: { 'assets/mengdei.png': 3 },
    });
    await harness.flush();

    assert.equal(harness.optionsByKey[key].disabled, true);
    for (const availableKey of emblemKeys.filter((candidate) => candidate !== key)) {
      assert.equal(
        harness.optionsByKey[availableKey].disabled,
        false,
        `${availableKey} should remain enabled when ${key} fails`
      );
    }

    const expectedFallback = key === 'mengdei' ? 'liyue' : 'mengdei';
    const fallbackSource = emblemCases.find(
      ({ key: candidate }) => candidate === expectedFallback
    ).src;
    assert.equal(harness.elements.emblemSelect.value, expectedFallback);
    if (key === 'mengdei') {
      assert.equal(
        harness.elements.emblemSelect.value,
        'liyue',
        'the failed default emblem should fall back to Liyue'
      );
    }
    assert.ok(
      harness.maskDrawCalls.some(([source]) => source?.src === fallbackSource),
      `${expectedFallback} should remain drawable when ${key} fails`
    );
    assert.ok(
      harness.elements.statusText.textContent.endsWith(`以下大图标加载失败：${label}。`),
      `${key} should report the exact label ${label}`
    );
  }
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
    harness.maskDrawCalls.some(([source]) => source?.src === 'assets/liyue.png'),
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
    harness.maskDrawCalls.some(([source]) => source?.src === 'assets/mengdei.png'),
    'the default emblem should render while other loads are still pending'
  );

  for (const source of heldSources) {
    harness.release(source);
  }
  await harness.flush();
});

test('unrelated successful emblem loads do not render the full canvas', async () => {
  const heldSources = emblemKeys
    .filter((key) => key !== 'liyue')
    .map((key) => `assets/${key}.png`);
  const harness = createHarness({ heldSources });
  const initialRenderCount = harness.renderCount;
  await harness.flush(4);

  assert.equal(
    harness.renderCount,
    initialRenderCount,
    'loading an unselected emblem should not render the full canvas'
  );

  for (const source of heldSources) {
    harness.release(source);
  }
  await harness.flush();
});

test('a render exception does not disable a successfully loaded emblem', async () => {
  const harness = createHarness({ throwOnRenderCount: 2 });
  await harness.flush();

  assert.equal(harness.optionsByKey.mengdei.disabled, false);
});

test('large visible-bound scans are downsampled and map back to source bounds', async () => {
  const harness = createHarness({ largeEmblems: true, alphaMode: 'center' });
  await harness.flush(20);

  assert.ok(harness.scratchCanvases.length >= emblemKeys.length);
  for (const scratch of harness.scratchCanvases) {
    assert.ok(scratch.width <= 512, `scratch width was ${scratch.width}`);
    assert.ok(scratch.height <= 512, `scratch height was ${scratch.height}`);
  }

  const emblemDraw = harness.maskDrawCalls.find(
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

  const emblemDraw = harness.maskDrawCalls.find(
    ([source]) => source?.src === 'assets/mengdei.png'
  );
  assert.deepEqual(emblemDraw.slice(1, 5), [0, 0, 64, 64]);
});

test('visible-bound scan failure keeps emblems enabled and drawable on mobile', async () => {
  const harness = createHarness({
    throwOnGetImageData: true,
    largeEmblems: true,
    search: '?testImage=query.png&emblem=mengdei',
  });
  await harness.flush(20);

  assert.equal(harness.optionsByKey.mengdei.disabled, false);
  assert.equal(harness.elements.emblemSelect.value, 'mengdei');
  assert.ok(
    harness.maskDrawCalls.some(([source]) => source?.src === 'assets/mengdei.png'),
    'the selected emblem should still feed the emblem drawing pipeline'
  );
});

test('selected emblem draws the original PNG as a mobile-safe fallback', async () => {
  const harness = createHarness({
    search: '?testImage=query.png&emblem=liyue',
  });
  await harness.flush();

  assert.ok(
    harness.drawCalls.some(([source]) => source?.src === 'assets/liyue.png'),
    'the selected emblem should be drawn directly before enhanced mask effects'
  );
});

test('mask draw failure does not abort the rest of the overlay rendering', async () => {
  const options = {
    throwOnMaskDraw: false,
    search: '?testImage=query.png&emblem=nata',
  };
  const harness = createHarness(options);
  await harness.flush();

  harness.drawCalls.length = 0;
  options.throwOnMaskDraw = true;
  harness.elements.emblemSelect.value = 'nata';
  assert.doesNotThrow(() => {
    harness.elements.emblemSelect.dispatch('change');
  });

  assert.ok(
    harness.drawCalls.some(([source]) => source?.src === 'assets/nata.png'),
    'the original emblem should still reach the main canvas when enhanced masks fail'
  );
  assert.ok(
    harness.drawCalls.some(([source]) => source?.src === 'assets/weiwandaixu-clean.png'),
    'the fixed bottom asset should still draw after an enhanced mask failure'
  );
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
