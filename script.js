(function () {
  const EMBLEM_ASSETS = Object.freeze({
    mengdei: { label: '蒙德', src: 'assets/mengdei.png' },
    liyue: { label: '璃月', src: 'assets/liyue.png' },
    daoqi: { label: '稻妻', src: 'assets/daoqi.png' },
    xuni: { label: '须弥', src: 'assets/xuni.png' },
    fengdan: { label: '枫丹', src: 'assets/fengdan.png' },
    nata: { label: '纳塔', src: 'assets/nata.png' },
    nuodekalai: { label: '空月之歌', src: 'assets/nuodekalai.png' },
  });
  const CONTINUATION_PATH = 'assets/weiwandaixu-clean.png';

  const imageInput = document.getElementById('imageInput');
  const line1Input = document.getElementById('line1Input');
  const line2Input = document.getElementById('line2Input');
  const overlayColorInput = document.getElementById('overlayColorInput');
  const overlayOpacityInput = document.getElementById('overlayOpacityInput');
  const opacityValue = document.getElementById('opacityValue');
  const emblemSelect = document.getElementById('emblemSelect');
  const exportButton = document.getElementById('exportButton');
  const statusText = document.getElementById('statusText');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');

  const overlayAssets = {
    emblems: {},
    continuation: null,
  };
  let uploadedImage = null;
  let activityMessage = statusText.textContent;
  let assetWarning = '';

  function updateStatusText() {
    statusText.textContent = [activityMessage, assetWarning].filter(Boolean).join(' ');
  }

  function currentMode() {
    return document.querySelector('input[name="sizeMode"]:checked')?.value || DEFAULTS.mode;
  }

  function currentState() {
    return createRenderState({
      mode: currentMode(),
      emblem: emblemSelect.value,
      line1: line1Input.value.trim() || DEFAULTS.line1,
      line2: line2Input.value.trim() || DEFAULTS.line2,
      overlayColor: overlayColorInput.value,
      overlayOpacity: overlayOpacityInput.value,
    });
  }

  function resizeCanvas(state) {
    const size = getCanvasSize(state.mode, uploadedImage);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.aspectRatio = `${size.width} / ${size.height}`;
  }

  function render() {
    const state = currentState();
    resizeCanvas(state);
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (uploadedImage) {
      const rect = getCoverRect(uploadedImage.width, uploadedImage.height, width, height);
      ctx.drawImage(uploadedImage, rect.dx, rect.dy, rect.dw, rect.dh);
    } else {
      drawPlaceholder(width, height);
    }

    ctx.fillStyle = hexToRgba(state.overlayColor, state.overlayOpacity);
    ctx.fillRect(0, 0, width, height);
    drawVignette(width, height);
    drawCenterOverlay(state, width, height);
  }

  function drawPlaceholder(width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#202634');
    gradient.addColorStop(1, '#18130f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawVignette(width, height) {
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      width * 0.08,
      width * 0.5,
      height * 0.48,
      width * 0.62
    );
    gradient.addColorStop(0, 'rgba(255, 196, 92, 0.08)');
    gradient.addColorStop(0.52, 'rgba(0, 0, 0, 0.04)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawCenterOverlay(state, width, height) {
    const layout = getOverlayLayout(width, height);
    const {
      cx,
      emblemSize,
      emblemY,
      line1Y,
      line1Size,
      line2Y,
      line2Size,
      dividerY,
      dividerWidth,
      taskBandY,
      taskBandWidth,
      taskBandHeight,
      taskY,
      taskWidth,
      bottomY,
      continuationWidth,
    } = layout;

    drawEmblemGlow(cx, emblemY, emblemSize);
    drawCenteredAsset(overlayAssets.emblems[state.emblem], cx, emblemY, null, emblemSize * 1.16, 0.98);
    drawTextLine(state.line1, cx, line1Y, line1Size, 700, '#ded0bb', 0.95, width * 0.42);
    drawTextLine(state.line2, cx, line2Y, line2Size, 850, '#fff8ed', 1, width * 0.47);
    drawOrnamentDivider(cx, dividerY, dividerWidth, height);
    drawTaskBand(cx, taskBandY, taskBandWidth, taskBandHeight);
    drawTaskCompleteText(state.line3, cx, taskY, taskWidth);
    drawTaskGlow(cx, bottomY, continuationWidth * 1.05, height * 0.032, '#d7bb86', 0.14);
    drawCenteredAsset(overlayAssets.continuation, cx, bottomY, continuationWidth, null, 0.9);
  }

  function drawEmblemGlow(cx, cy, size) {
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, size * 0.12, cx, cy, size * 0.95);
    glow.addColorStop(0, 'rgba(255, 232, 148, 0.42)');
    glow.addColorStop(0.42, 'rgba(223, 145, 56, 0.2)');
    glow.addColorStop(1, 'rgba(223, 145, 56, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.96, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOrnamentDivider(cx, cy, width, height) {
    const lineGap = width * 0.075;
    const diamond = Math.max(15, height * 0.019);
    const lineY = cy;
    const leftStart = cx - width / 2;
    const leftEnd = cx - lineGap;
    const rightStart = cx + lineGap;
    const rightEnd = cx + width / 2;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, height * 0.0019);
    drawDividerLine(leftStart, lineY, leftEnd, lineY, false);
    drawDividerLine(rightStart, lineY, rightEnd, lineY, true);

    ctx.shadowColor = 'rgba(237, 220, 184, 0.5)';
    ctx.shadowBlur = Math.max(4, height * 0.007);
    ctx.strokeStyle = 'rgba(226, 210, 182, 0.88)';
    ctx.lineWidth = Math.max(2, height * 0.0024);
    drawDiamond(cx - diamond * 0.32, cy, diamond);
    drawDiamond(cx + diamond * 0.32, cy, diamond);
    ctx.restore();
  }

  function drawDividerLine(x1, y1, x2, y2, reverse) {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    if (reverse) {
      gradient.addColorStop(0, 'rgba(237, 220, 184, 0.8)');
      gradient.addColorStop(0.45, 'rgba(237, 220, 184, 0.46)');
      gradient.addColorStop(1, 'rgba(237, 220, 184, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(237, 220, 184, 0)');
      gradient.addColorStop(0.55, 'rgba(237, 220, 184, 0.46)');
      gradient.addColorStop(1, 'rgba(237, 220, 184, 0.8)');
    }
    ctx.strokeStyle = gradient;
    ctx.shadowColor = 'rgba(237, 220, 184, 0.35)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawDiamond(cx, cy, size) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.48);
    ctx.lineTo(cx + size * 0.7, cy);
    ctx.lineTo(cx, cy + size * 0.48);
    ctx.lineTo(cx - size * 0.7, cy);
    ctx.closePath();
    ctx.stroke();
  }

  function drawTaskBand(cx, cy, width, height) {
    ctx.save();
    const glow = ctx.createLinearGradient(cx - width / 2, cy, cx + width / 2, cy);
    glow.addColorStop(0, 'rgba(174, 101, 44, 0)');
    glow.addColorStop(0.18, 'rgba(139, 82, 43, 0.2)');
    glow.addColorStop(0.5, 'rgba(156, 96, 50, 0.32)');
    glow.addColorStop(0.82, 'rgba(139, 82, 43, 0.2)');
    glow.addColorStop(1, 'rgba(174, 101, 44, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - width / 2, cy - height / 2, width, height);

    const edge = ctx.createLinearGradient(cx - width / 2, cy, cx + width / 2, cy);
    edge.addColorStop(0, 'rgba(255, 234, 180, 0)');
    edge.addColorStop(0.5, 'rgba(255, 234, 180, 0.1)');
    edge.addColorStop(1, 'rgba(255, 234, 180, 0)');
    ctx.fillStyle = edge;
    ctx.fillRect(cx - width / 2, cy - height / 2, width, Math.max(1, height * 0.08));
    ctx.restore();
  }

  function drawTaskCompleteText(text, x, y, maxWidth) {
    ctx.save();
    let size = Math.max(18, maxWidth * 0.2);
    ctx.font = `700 ${Math.round(size)}px Microsoft YaHei, PingFang SC, sans-serif`;
    while (size > 14 && ctx.measureText(text).width > maxWidth) {
      size -= 1;
      ctx.font = `700 ${Math.round(size)}px Microsoft YaHei, PingFang SC, sans-serif`;
    }

    const gradient = ctx.createLinearGradient(x, y - size * 0.65, x, y + size * 0.65);
    gradient.addColorStop(0, '#fff1d0');
    gradient.addColorStop(0.52, '#efd39c');
    gradient.addColorStop(1, '#d0a061');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 229, 176, 0.18)';
    ctx.shadowBlur = Math.max(2, size * 0.08);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(255, 244, 218, 0.42)';
    ctx.lineWidth = Math.max(0.6, size * 0.018);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = gradient;
    ctx.fillText(text, x, y);

    ctx.shadowColor = 'rgba(39, 24, 14, 0.58)';
    ctx.shadowBlur = Math.max(1.5, size * 0.055);
    ctx.shadowOffsetY = Math.max(1, size * 0.025);
    ctx.strokeStyle = 'rgba(76, 45, 22, 0.22)';
    ctx.lineWidth = Math.max(0.5, size * 0.012);
    ctx.strokeText(text, x, y + size * 0.015);
    ctx.restore();
  }

  function drawTaskGlow(cx, cy, width, height, color, alpha) {
    ctx.save();
    const gradient = ctx.createLinearGradient(cx - width / 2, cy, cx + width / 2, cy);
    gradient.addColorStop(0, colorToRgba(color, 0));
    gradient.addColorStop(0.28, colorToRgba(color, alpha * 0.72));
    gradient.addColorStop(0.5, colorToRgba(color, alpha));
    gradient.addColorStop(0.72, colorToRgba(color, alpha * 0.72));
    gradient.addColorStop(1, colorToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - width / 2, cy - height / 2, width, height);
    ctx.restore();
  }

  function drawCenteredAsset(asset, cx, cy, targetWidth, targetHeight, alpha, options = {}) {
    if (!asset) {
      return;
    }
    const source = asset.image;
    const bounds = asset.bounds || {
      x: 0,
      y: 0,
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
    const aspect = bounds.width / bounds.height;
    const drawWidth = targetWidth || targetHeight * aspect;
    const drawHeight = targetHeight || targetWidth / aspect;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = options.filter || 'none';
    ctx.drawImage(
      source,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      cx - drawWidth / 2,
      cy - drawHeight / 2,
      drawWidth,
      drawHeight
    );
    ctx.restore();
  }

  function drawTextLine(text, x, y, size, weight, color, alpha, maxWidth) {
    ctx.save();
    const fittedSize = fitFontSize(text, size, weight, maxWidth);
    ctx.font = `${weight} ${Math.max(18, Math.round(fittedSize))}px Microsoft YaHei, PingFang SC, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.74)';
    ctx.shadowBlur = Math.max(5, fittedSize * 0.15);
    ctx.shadowOffsetY = Math.max(2, fittedSize * 0.055);
    ctx.strokeStyle = 'rgba(65, 46, 28, 0.5)';
    ctx.lineWidth = Math.max(2, fittedSize * 0.06);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function fitFontSize(text, size, weight, maxWidth) {
    if (!maxWidth) {
      return size;
    }
    let fitted = size;
    ctx.save();
    while (fitted > 18) {
      ctx.font = `${weight} ${Math.round(fitted)}px Microsoft YaHei, PingFang SC, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) {
        break;
      }
      fitted -= 1;
    }
    ctx.restore();
    return fitted;
  }

  function hexToRgba(hex, opacity) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampOpacity(opacity)})`;
  }

  function colorToRgba(hex, opacity) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampOpacity(opacity)})`;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`图片读取失败：${src}`));
      image.src = src;
    });
  }

  async function loadEmblemAssets() {
    const failedKeys = new Set();

    await Promise.all(
      EMBLEM_KEYS.map(async (key) => {
        const { src } = EMBLEM_ASSETS[key];
        let image;
        let bounds;
        try {
          image = await loadImage(src);
          bounds = getVisibleBounds(image);
        } catch {
          failedKeys.add(key);
          const option = emblemSelect.querySelector(`option[value="${key}"]`);
          if (option) {
            option.disabled = true;
          }
          return;
        }

        overlayAssets.emblems[key] = { image, bounds };
        if (emblemSelect.value === key) {
          render();
        }
      })
    );

    const availableKeys = EMBLEM_KEYS.filter((key) => overlayAssets.emblems[key]);
    if (availableKeys.length > 0 && !availableKeys.includes(emblemSelect.value)) {
      emblemSelect.value = availableKeys[0];
    }

    if (availableKeys.length === 0) {
      assetWarning = '大图标全部加载失败，请检查 assets 目录。';
    } else if (failedKeys.size > 0) {
      const failedLabels = EMBLEM_KEYS
        .filter((key) => failedKeys.has(key))
        .map((key) => EMBLEM_ASSETS[key].label);
      assetWarning = `以下大图标加载失败：${failedLabels.join('、')}。`;
    } else {
      assetWarning = '';
    }
    updateStatusText();
  }

  async function loadOverlayAssets() {
    const image = await loadImage(CONTINUATION_PATH);
    overlayAssets.continuation = { image, bounds: getVisibleBounds(image) };
    await loadEmblemAssets();
    render();
  }

  function getVisibleBounds(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const scanScale = Math.min(1, 512 / Math.max(width, height));
    const scanWidth = Math.max(1, Math.round(width * scanScale));
    const scanHeight = Math.max(1, Math.round(height * scanScale));
    const scratch = document.createElement('canvas');
    scratch.width = scanWidth;
    scratch.height = scanHeight;
    const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    scratchCtx.drawImage(image, 0, 0, scanWidth, scanHeight);
    const data = scratchCtx.getImageData(0, 0, scanWidth, scanHeight).data;
    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < scanHeight; y += 1) {
      for (let x = 0; x < scanWidth; x += 1) {
        const alpha = data[(y * scanWidth + x) * 4 + 3];
        if (alpha > 8) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return { x: 0, y: 0, width, height };
    }

    const scaleX = width / scanWidth;
    const scaleY = height / scanHeight;
    const sourceMinX = Math.floor(minX * scaleX);
    const sourceMinY = Math.floor(minY * scaleY);
    const sourceMaxX = Math.ceil((maxX + 1) * scaleX);
    const sourceMaxY = Math.ceil((maxY + 1) * scaleY);
    const padding = Math.ceil(Math.min(width, height) * 0.012);
    const x = Math.max(0, sourceMinX - padding);
    const y = Math.max(0, sourceMinY - padding);
    return {
      x,
      y,
      width: Math.min(width, sourceMaxX + padding) - x,
      height: Math.min(height, sourceMaxY + padding) - y,
    };
  }

  function setUploadedImage(image, name) {
    uploadedImage = image;
    activityMessage = `已加载 ${name}，可以导出图片。`;
    updateStatusText();
    exportButton.disabled = false;
    render();
  }

  function loadImageSource(src, name) {
    loadImage(src)
      .then((image) => setUploadedImage(image, name))
      .catch(() => {
        activityMessage = '图片读取失败，请换一张图片重试。';
        updateStatusText();
      });
  }

  function loadTestImageFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('capture') === '1') {
      document.body.classList.add('capture-mode');
    }

    const testImage = params.get('testImage');
    if (!testImage) {
      return;
    }
    const safeName = testImage.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeName) {
      return;
    }
    if (params.has('line1')) {
      line1Input.value = params.get('line1') || DEFAULTS.line1;
    }
    if (params.has('line2')) {
      line2Input.value = params.get('line2') || DEFAULTS.line2;
    }
    if (params.has('emblem')) {
      const requestedEmblem = params.get('emblem');
      emblemSelect.value = normalizeEmblem(requestedEmblem);
    }
    loadImageSource(safeName, safeName);
  }

  function bindEvents() {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      if (!file) {
        return;
      }
      loadImageSource(URL.createObjectURL(file), file.name);
    });

    [line1Input, line2Input, overlayColorInput, overlayOpacityInput].forEach((control) => {
      control.addEventListener('input', () => {
        opacityValue.textContent = `${Math.round(Number(overlayOpacityInput.value) * 100)}%`;
        render();
      });
    });

    document.querySelectorAll('input[name="sizeMode"]').forEach((control) => {
      control.addEventListener('change', render);
    });

    emblemSelect.addEventListener('change', render);

    exportButton.addEventListener('click', () => {
      render();
      canvas.toBlob((blob) => {
        if (!blob) {
          activityMessage = '导出失败，请重试。';
          updateStatusText();
          return;
        }
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'task-overlay.png';
        link.click();
        URL.revokeObjectURL(link.href);
        activityMessage = '已生成并下载 task-overlay.png。';
        updateStatusText();
      }, 'image/png');
    });
  }

  exportButton.disabled = true;
  bindEvents();
  loadOverlayAssets().catch(() => {
    assetWarning = '固定素材加载失败，请检查 assets 目录。';
    updateStatusText();
  });
  loadTestImageFromQuery();
  render();
})();
