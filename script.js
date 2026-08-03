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
  const PREVIEW_EMBLEM_ASSETS = Object.freeze({
    mengdei: { label: '蒙德', src: 'assets/preview/mengdei.png' },
    liyue: { label: '璃月', src: 'assets/preview/liyue.png' },
    daoqi: { label: '稻妻', src: 'assets/preview/daoqi.png' },
    xuni: { label: '须弥', src: 'assets/preview/xuni.png' },
    fengdan: { label: '枫丹', src: 'assets/preview/fengdan.png' },
    nata: { label: '纳塔', src: 'assets/preview/nata.png' },
    nuodekalai: { label: '空月之歌', src: 'assets/preview/nuodekalai.png' },
  });
  const CONTINUATION_PATH = 'assets/weiwandaixu-clean.png';

  const imageInput = document.getElementById('imageInput');
  const line1Input = document.getElementById('line1Input');
  const line2Input = document.getElementById('line2Input');
  const overlayColorInput = document.getElementById('overlayColorInput');
  const overlayOpacityInput = document.getElementById('overlayOpacityInput');
  const opacityValue = document.getElementById('opacityValue');
  const emblemSelect = document.getElementById('emblemSelect');
  const previewAnimationButton = document.getElementById('previewAnimationButton');
  const exportButton = document.getElementById('exportButton');
  const statusText = document.getElementById('statusText');
  const canvasSize = document.getElementById('canvasSize');
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  const videoSettings = getVideoExportSettings();
  const MOTION_PRESETS = Object.freeze({
    off: Object.freeze({ strength: 0, particleCount: 0, streakCount: 0 }),
    soft: Object.freeze({ strength: 0.58, particleCount: 22, streakCount: 4 }),
    full: Object.freeze({ strength: 1, particleCount: 36, streakCount: 7 }),
  });

  const overlayAssets = {
    previewEmblems: {},
    highResEmblems: {},
    continuation: null,
  };
  let uploadedMedia = null;
  let uploadedMediaType = 'image';
  let activityMessage = statusText.textContent;
  let assetWarning = '';
  let highResMessage = '';
  let previewAnimationFrame = null;
  let autoplayTestPreview = false;

  function updateStatusText() {
    statusText.textContent = [activityMessage, highResMessage, assetWarning].filter(Boolean).join(' ');
  }

  const highResLoadState = {
    active: false,
    startedAt: 0,
    total: EMBLEM_KEYS.length,
    completed: 0,
    failed: 0,
  };

  function estimateHighResRemainingSeconds() {
    const remaining = Math.max(0, highResLoadState.total - highResLoadState.completed);
    if (remaining === 0) {
      return 0;
    }
    const elapsedSeconds = Math.max(0.5, (Date.now() - highResLoadState.startedAt) / 1000);
    const finished = highResLoadState.completed + highResLoadState.failed;
    if (finished === 0) {
      return Math.max(2, remaining * 2);
    }
    return Math.max(1, Math.ceil((elapsedSeconds / finished) * remaining));
  }

  function updateHighResMessage() {
    if (!highResLoadState.active) {
      highResMessage = '';
      updateStatusText();
      return;
    }
    if (highResLoadState.completed >= highResLoadState.total) {
      highResMessage = '高清大图标已加载完成，可导出高清图。';
      updateStatusText();
      return;
    }
    const remainingSeconds = estimateHighResRemainingSeconds();
    highResMessage = `高清大图标加载中：${highResLoadState.completed}/${highResLoadState.total}，预计约 ${remainingSeconds} 秒内完成。`;
    updateStatusText();
  }

  function currentMode() {
    return document.querySelector('input[name="sizeMode"]:checked')?.value || DEFAULTS.mode;
  }

  function selectedExportMode() {
    return document.querySelector('input[name="exportMode"]:checked')?.value || 'image';
  }

  function currentMotionMode() {
    const requested = document.querySelector('input[name="motionMode"]:checked')?.value || 'soft';
    return Object.hasOwn(MOTION_PRESETS, requested) ? requested : 'soft';
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
    const size = getCanvasSize(state.mode, uploadedMedia);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    canvas.style.aspectRatio = `${size.width} / ${size.height}`;
    if (canvasSize) {
      canvasSize.textContent = `${size.width} x ${size.height}`;
    }
  }

  function render(options = {}) {
    const state = currentState();
    const emblems = options.emblems || overlayAssets.previewEmblems;
    const animation = getAnimatedOverlayState(options.progress ?? 1);
    const motionMode = options.motionMode || currentMotionMode();
    const elapsedMs = Number.isFinite(options.elapsedMs)
      ? Math.max(0, options.elapsedMs)
      : animation.progress * videoSettings.durationMs;
    const staticFrame = options.staticFrame ?? options.progress === undefined;
    resizeCanvas(state);
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (uploadedMedia) {
      drawMediaFrame(uploadedMedia, width, height);
    } else {
      drawPlaceholder(width, height);
    }

    ctx.fillStyle = hexToRgba(state.overlayColor, state.overlayOpacity * animation.overlayAlpha);
    ctx.fillRect(0, 0, width, height);
    drawVignette(width, height, animation.overlayAlpha);
    drawParticleField(width, height, animation, elapsedMs, motionMode, staticFrame);
    drawCenterOverlay(state, width, height, emblems, animation);
  }

  function drawMediaFrame(media, width, height) {
    const dimensions = getMediaDimensions(media);
    if (!dimensions) {
      drawPlaceholder(width, height);
      return;
    }
    const rect = getCoverRect(dimensions.width, dimensions.height, width, height);
    ctx.drawImage(media, rect.dx, rect.dy, rect.dw, rect.dh);
  }

  function drawPlaceholder(width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#202634');
    gradient.addColorStop(1, '#18130f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawVignette(width, height, alpha = 1) {
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
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawParticleField(width, height, animation, elapsedMs, motionMode, staticFrame) {
    const preset = MOTION_PRESETS[motionMode] || MOTION_PRESETS.soft;
    if (preset.particleCount <= 0 || preset.strength <= 0) {
      return;
    }

    const count = staticFrame ? Math.min(5, preset.particleCount) : preset.particleCount;
    const particleState = getParticleState(width, height, animation.progress, {
      seed: `overlay-${motionMode}`,
      elapsedMs: staticFrame ? videoSettings.durationMs : elapsedMs,
      count,
      minCount: count,
      maxCount: count,
    });
    const reveal = Math.min(1, animation.progress / 0.34);
    const revealEase = 1 - Math.pow(1 - reveal, 3);
    const centerX = width * 0.5;
    const centerY = height * 0.31;
    const scale = Math.max(0.6, Math.min(2, Math.min(width / 1920, height / 1080)));

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < particleState.particles.length; index += 1) {
      const particle = particleState.particles[index];
      const targetX = particle.x;
      const targetY = particle.y;
      const x = centerX + (targetX - centerX) * (0.16 + revealEase * 0.84);
      const y = centerY + (targetY - centerY) * (0.16 + revealEase * 0.84);
      const normalizedX = Math.abs(x / width - 0.5);
      const normalizedY = y / height;
      const textSafeZone = normalizedX < 0.25 && normalizedY > 0.27 && normalizedY < 0.62;
      const safeZoneAlpha = textSafeZone ? 0.16 : 1;
      const finalAlpha = particle.alpha * preset.strength * safeZoneAlpha * (staticFrame ? 0.42 : 0.82);
      if (finalAlpha <= 0.002) {
        continue;
      }

      ctx.globalAlpha = finalAlpha;
      ctx.fillStyle = index % 5 === 0 ? '#b8d7ff' : '#ead7aa';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.8, particle.radius * (index % 7 === 0 ? 1.45 : 1)), 0, Math.PI * 2);
      ctx.fill();
    }

    if (!staticFrame) {
      drawParticleStreaks(particleState, width, height, animation.progress, preset, scale);
      drawDividerGlint(width, height, animation.progress, preset.strength, scale);
    }
    ctx.restore();
  }

  function drawParticleStreaks(particleState, width, height, progress, preset, scale) {
    const streakProgress = clampProgress((progress - 0.04) / 0.28);
    const streakAlpha = Math.sin(streakProgress * Math.PI) * preset.strength;
    if (streakAlpha <= 0.002) {
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, scale * 1.2);
    for (let index = 0; index < preset.streakCount; index += 1) {
      const particle = particleState.particles[index * 2];
      if (!particle) {
        continue;
      }
      const direction = index % 2 === 0 ? 1 : -1;
      const length = (20 + index * 5) * scale;
      const x = width * 0.5 + (particle.x - width * 0.5) * streakProgress;
      const y = height * 0.3 + (particle.y - height * 0.3) * streakProgress;
      ctx.globalAlpha = streakAlpha * (0.12 + index * 0.018);
      ctx.strokeStyle = index % 3 === 0 ? '#b8d7ff' : '#ead7aa';
      ctx.beginPath();
      ctx.moveTo(x - length * direction, y + length * 0.18);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function drawDividerGlint(width, height, progress, strength, scale) {
    const glintProgress = clampProgress((progress - 0.18) / 0.2);
    if (glintProgress <= 0 || glintProgress >= 1) {
      return;
    }

    const lineWidth = width * 0.34;
    const x = width * 0.5 - lineWidth * 0.5 + lineWidth * glintProgress;
    const y = height * 0.49;
    const glow = ctx.createLinearGradient(x - 44 * scale, y, x + 44 * scale, y);
    glow.addColorStop(0, 'rgba(234, 215, 170, 0)');
    glow.addColorStop(0.5, `rgba(255, 246, 218, ${0.48 * strength})`);
    glow.addColorStop(1, 'rgba(234, 215, 170, 0)');
    ctx.globalAlpha = Math.sin(glintProgress * Math.PI);
    ctx.fillStyle = glow;
    ctx.fillRect(x - 44 * scale, y - scale, 88 * scale, Math.max(1, scale * 2));
  }

  function drawCenterOverlay(state, width, height, emblems, animation = getAnimatedOverlayState(1)) {
    const layout = getOverlayLayout(width, height);
    const {
      cx,
      emblemSize,
      emblemY,
      line1Y,
      line1Size,
      line1MaxWidth,
      line2Y,
      line2Size,
      line2MaxWidth,
      dividerY,
      dividerWidth,
      taskBandY,
      taskBandWidth,
      taskBandHeight,
      taskY,
      taskWidth,
      bottomY,
      continuationWidth,
      continuationGlowHeight,
      scale,
    } = layout;

    drawEmblemGlow(cx, emblemY, emblemSize * animation.emblemScale, animation.emblemAlpha);
    drawLuminousEmblem(emblems[state.emblem], cx, emblemY, emblemSize * 1.16 * animation.emblemScale, animation.emblemAlpha);
    drawTextLine(
      state.line1,
      cx,
      line1Y + animation.line1OffsetY * scale,
      line1Size,
      700,
      '#ded0bb',
      0.95 * animation.line1Alpha,
      line1MaxWidth
    );
    drawTextLine(
      state.line2,
      cx,
      line2Y,
      line2Size,
      850,
      '#fff8ed',
      animation.line2Alpha,
      line2MaxWidth,
      { scale: animation.line2Scale }
    );
    drawOrnamentDivider(cx, dividerY, dividerWidth * animation.dividerProgress, scale, animation.dividerProgress);
    drawTaskBand(cx, taskBandY, taskBandWidth * animation.taskBandProgress, taskBandHeight);
    drawTaskCompleteText(state.line3, cx, taskY, taskWidth, animation.taskBandProgress);
    drawTaskGlow(cx, bottomY, continuationWidth * 1.05, continuationGlowHeight, '#d7bb86', 0.14 * animation.continuationAlpha);
    drawCenteredAsset(overlayAssets.continuation, cx, bottomY, continuationWidth, null, 0.9 * animation.continuationAlpha);
  }

  function drawEmblemGlow(cx, cy, size, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const glow = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.76);
    glow.addColorStop(0, 'rgba(255, 229, 170, 0.3)');
    glow.addColorStop(0.42, 'rgba(201, 169, 110, 0.18)');
    glow.addColorStop(1, 'rgba(201, 169, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLuminousEmblem(asset, cx, cy, height, alpha = 1) {
    if (!asset) {
      return;
    }
    drawEmblemBacklight(asset, cx, cy, null, height, alpha);
    drawGoldEmblemMask(asset, cx, cy, null, height, alpha);
  }

  function drawEmblemBacklight(asset, cx, cy, targetWidth, targetHeight, alpha = 1) {
    const metrics = getAssetDrawMetrics(asset, cx, cy, targetWidth, targetHeight);
    const layer = createEmblemMaskLayer(metrics, [
      [0, 'rgba(255, 239, 198, 0.78)'],
      [0.46, 'rgba(224, 183, 96, 0.72)'],
      [1, 'rgba(161, 112, 42, 0.18)'],
    ]);
    if (!layer) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.78 * alpha;
    ctx.filter = 'blur(4px)';
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(layer.canvas, cx - layer.width / 2, cy - layer.height / 2);
    ctx.restore();
  }

  function drawGoldEmblemMask(asset, cx, cy, targetWidth, targetHeight, alpha = 1) {
    const metrics = getAssetDrawMetrics(asset, cx, cy, targetWidth, targetHeight);
    const layer = createEmblemMaskLayer(metrics, [
      [0, '#FFF2C8'],
      [0.42, '#F8E7B8'],
      [0.82, '#E8CB8A'],
      [0.96, '#C9A96E'],
      [1, '#8A672E'],
    ]);
    if (!layer) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = 'drop-shadow(0 0 10px rgba(201, 169, 110, 0.6))';
    ctx.drawImage(layer.canvas, cx - layer.width / 2, cy - layer.height / 2);
    ctx.restore();
  }

  function createEmblemMaskLayer(metrics, colorStops) {
    if (!metrics) {
      return null;
    }
    const padding = Math.max(18, Math.max(metrics.drawWidth, metrics.drawHeight) * 0.18);
    const layerWidth = Math.ceil(metrics.drawWidth + padding * 2);
    const layerHeight = Math.ceil(metrics.drawHeight + padding * 2);
    const layer = document.createElement('canvas');
    layer.width = layerWidth;
    layer.height = layerHeight;

    const layerCtx = layer.getContext('2d');
    const offsetX = (layerWidth - metrics.drawWidth) / 2;
    const offsetY = (layerHeight - metrics.drawHeight) / 2;
    layerCtx.drawImage(
      metrics.source,
      metrics.bounds.x,
      metrics.bounds.y,
      metrics.bounds.width,
      metrics.bounds.height,
      offsetX,
      offsetY,
      metrics.drawWidth,
      metrics.drawHeight
    );

    layerCtx.globalCompositeOperation = 'source-in';
    const radius = Math.max(metrics.drawWidth, metrics.drawHeight) * 0.62;
    const gradient = layerCtx.createRadialGradient(
      layerWidth * 0.5,
      layerHeight * 0.38,
      radius * 0.05,
      layerWidth * 0.5,
      layerHeight * 0.52,
      radius
    );
    for (const [offset, color] of colorStops) {
      gradient.addColorStop(offset, color);
    }
    layerCtx.fillStyle = gradient;
    layerCtx.fillRect(0, 0, layerWidth, layerHeight);

    return {
      canvas: layer,
      width: layerWidth,
      height: layerHeight,
    };
  }

  function drawOrnamentDivider(cx, cy, width, scale, progress = 1) {
    if (width <= 0 || progress <= 0) {
      return;
    }
    const lineGap = width * 0.075;
    const diamond = 20.52 * scale * clampProgress(progress);
    const lineY = cy;
    const leftStart = cx - width / 2;
    const leftEnd = cx - lineGap;
    const rightStart = cx + lineGap;
    const rightEnd = cx + width / 2;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 2.052 * scale);
    drawDividerLine(leftStart, lineY, leftEnd, lineY, false);
    drawDividerLine(rightStart, lineY, rightEnd, lineY, true);

    ctx.shadowColor = 'rgba(237, 220, 184, 0.5)';
    ctx.shadowBlur = Math.max(2, 7.56 * scale);
    ctx.strokeStyle = 'rgba(226, 210, 182, 0.88)';
    ctx.lineWidth = Math.max(1, 2.592 * scale);
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

  function drawTaskCompleteText(text, x, y, maxWidth, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
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
    const metrics = getAssetDrawMetrics(asset, cx, cy, targetWidth, targetHeight);
    if (!metrics) {
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = options.filter || 'none';
    ctx.globalCompositeOperation = options.compositeOperation || 'source-over';
    ctx.drawImage(
      metrics.source,
      metrics.bounds.x,
      metrics.bounds.y,
      metrics.bounds.width,
      metrics.bounds.height,
      metrics.x,
      metrics.y,
      metrics.drawWidth,
      metrics.drawHeight
    );
    ctx.restore();
  }

  function getAssetDrawMetrics(asset, cx, cy, targetWidth, targetHeight) {
    if (!asset) {
      return null;
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
    return {
      source,
      bounds,
      x: cx - drawWidth / 2,
      y: cy - drawHeight / 2,
      drawWidth,
      drawHeight,
    };
  }

  function drawTextLine(text, x, y, size, weight, color, alpha, maxWidth, options = {}) {
    ctx.save();
    const scale = options.scale || 1;
    const fittedSize = fitFontSize(text, size, weight, maxWidth ? maxWidth / scale : maxWidth);
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.font = `${weight} ${Math.max(18, Math.round(fittedSize))}px Microsoft YaHei, PingFang SC, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.74)';
    ctx.shadowBlur = Math.max(5, fittedSize * 0.15);
    ctx.shadowOffsetY = Math.max(2, fittedSize * 0.055);
    ctx.strokeStyle = 'rgba(65, 46, 28, 0.5)';
    ctx.lineWidth = Math.max(2, fittedSize * 0.06);
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
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

  async function loadSingleEmblemAsset(key, failedKeys, sourceMap, targetMap, options = {}) {
    const { disableOnFailure = true, renderSelected = true } = options;
    const { src } = sourceMap[key];
    let image;
    let bounds;
    try {
      image = await loadImage(src);
      bounds = getVisibleBounds(image);
    } catch {
      failedKeys.add(key);
      if (disableOnFailure) {
        const option = emblemSelect.querySelector(`option[value="${key}"]`);
        if (option) {
          option.disabled = true;
        }
      }
      return;
    }

    targetMap[key] = { image, bounds };
    if (renderSelected && emblemSelect.value === key) {
      render();
    }
  }

  async function loadPreviewEmblemAssets(priorityKey = emblemSelect.value) {
    const failedKeys = new Set();
    const firstKey = normalizeEmblem(priorityKey);
    await loadSingleEmblemAsset(firstKey, failedKeys, PREVIEW_EMBLEM_ASSETS, overlayAssets.previewEmblems);

    await Promise.all(
      EMBLEM_KEYS
        .filter((key) => key !== firstKey)
        .map((key) => loadSingleEmblemAsset(key, failedKeys, PREVIEW_EMBLEM_ASSETS, overlayAssets.previewEmblems))
    );

    const availableKeys = EMBLEM_KEYS.filter((key) => overlayAssets.previewEmblems[key]);
    if (availableKeys.length > 0 && !availableKeys.includes(emblemSelect.value)) {
      emblemSelect.value = availableKeys[0];
      render();
    }

    if (availableKeys.length === 0) {
      assetWarning = '大图标全部加载失败，请检查 assets 目录。';
    } else if (failedKeys.size > 0) {
      const failedLabels = EMBLEM_KEYS
        .filter((key) => failedKeys.has(key))
        .map((key) => PREVIEW_EMBLEM_ASSETS[key].label);
      assetWarning = `以下大图标加载失败：${failedLabels.join('、')}。`;
    } else {
      assetWarning = '';
    }
    updateStatusText();
  }

  async function loadHighResEmblemAssets(priorityKey = emblemSelect.value) {
    const failedKeys = new Set();
    const firstKey = normalizeEmblem(priorityKey);
    highResLoadState.active = true;
    highResLoadState.startedAt = Date.now();
    highResLoadState.completed = 0;
    highResLoadState.failed = 0;
    updateHighResMessage();

    async function loadTrackedHighResEmblem(key) {
      const beforeLoaded = Boolean(overlayAssets.highResEmblems[key]);
      await loadSingleEmblemAsset(key, failedKeys, EMBLEM_ASSETS, overlayAssets.highResEmblems, {
        disableOnFailure: false,
        renderSelected: false,
      });
      if (overlayAssets.highResEmblems[key] && !beforeLoaded) {
        highResLoadState.completed += 1;
      } else if (!overlayAssets.highResEmblems[key]) {
        highResLoadState.failed += 1;
      }
      updateHighResMessage();
    }

    await loadTrackedHighResEmblem(firstKey);

    await Promise.all(
      EMBLEM_KEYS
        .filter((key) => key !== firstKey)
        .map((key) => loadTrackedHighResEmblem(key))
    );
  }

  async function loadContinuationAsset() {
    const image = await loadImage(CONTINUATION_PATH);
    overlayAssets.continuation = { image, bounds: getVisibleBounds(image) };
    render();
  }

  async function loadOverlayAssets() {
    const continuationLoad = loadContinuationAsset().catch(() => {
      assetWarning = '固定素材加载失败，请检查 assets 目录。';
      updateStatusText();
    });
    loadHighResEmblemAssets(emblemSelect.value);
    await loadPreviewEmblemAssets(emblemSelect.value);
    render();
    await continuationLoad;
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

  function setUploadedMedia(media, type, name) {
    stopAnimationPreview({ renderFinal: false });
    uploadedMedia = media;
    uploadedMediaType = type;
    const label = type === 'video' ? '视频' : '图片';
    activityMessage = `已加载 ${name} ${label}，可以预览动画或导出。`;
    updateStatusText();
    exportButton.disabled = false;
    previewAnimationButton.disabled = false;
    render();
    if (autoplayTestPreview) {
      autoplayTestPreview = false;
      requestAnimationFrame(() => playAnimationPreview());
    }
  }

  function setUploadedImage(image, name) {
    setUploadedMedia(image, 'image', name);
  }

  function loadImageSource(src, name) {
    loadImage(src)
      .then((image) => setUploadedImage(image, name))
      .catch(() => {
        activityMessage = '图片读取失败，请换一张图片重试。';
        updateStatusText();
      });
  }

  function loadVideoSource(src, name) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0;
    }, { once: true });
    video.addEventListener('loadeddata', () => {
      setUploadedMedia(video, 'video', name);
    }, { once: true });
    video.addEventListener('error', () => {
      activityMessage = '视频读取失败，请换一个视频重试。';
      updateStatusText();
    }, { once: true });
    video.src = src;
    video.load();
  }

  function waitForVideoSeek(video, timeSeconds) {
    return new Promise((resolve, reject) => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = Math.min(Math.max(0, timeSeconds), Math.max(0, duration - 0.001));
      if (Math.abs(video.currentTime - target) < 0.002 && video.readyState >= 2) {
        resolve();
        return;
      }
      const cleanup = () => {
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('error', handleError);
      };
      const handleSeeked = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error('Video seek failed.'));
      };
      video.addEventListener('seeked', handleSeeked, { once: true });
      video.addEventListener('error', handleError, { once: true });
      video.currentTime = target;
    });
  }

  function selectedHighResEmblemReady() {
    return Boolean(overlayAssets.highResEmblems[currentState().emblem]);
  }

  function downloadBlob(blob, fileName) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportHighResImage() {
    if (!selectedHighResEmblemReady()) {
      activityMessage = '高清大图标仍在加载，请稍等后再导出。';
      updateStatusText();
      return;
    }

    render({ emblems: overlayAssets.highResEmblems, staticFrame: true });
    canvas.toBlob((blob) => {
      if (!blob) {
        activityMessage = '导出失败，请重试。';
        updateStatusText();
        render();
        return;
      }
      downloadBlob(blob, 'task-overlay.png');
      activityMessage = '已生成并下载 task-overlay.png。';
      updateStatusText();
      render();
    }, 'image/png');
  }

  function getExportDurationMs() {
    if (uploadedMediaType === 'video' && Number.isFinite(uploadedMedia?.duration) && uploadedMedia.duration > 0) {
      return Math.round(uploadedMedia.duration * 1000);
    }
    return videoSettings.durationMs;
  }

  function getVideoFrameCount(durationMs = getExportDurationMs()) {
    return Math.max(1, Math.round((durationMs / 1000) * videoSettings.fps));
  }

  function renderAnimationFrame(frameIndex, frameCount, emblems, motionMode = currentMotionMode()) {
    const elapsedMs = (frameIndex / videoSettings.fps) * 1000;
    const progress = frameIndex >= frameCount - 1
      ? 1
      : getTimelineProgress(elapsedMs, getExportDurationMs(), uploadedMediaType);
    render({ emblems, progress, elapsedMs, motionMode, staticFrame: false });
  }

  async function prepareMediaFrame(frameIndex) {
    if (uploadedMediaType !== 'video') {
      return;
    }
    await waitForVideoSeek(uploadedMedia, frameIndex / videoSettings.fps);
  }

  async function loadMp4Muxer() {
    return import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/+esm');
  }

  async function exportAnimatedMp4() {
    if (!('VideoEncoder' in window) || !('VideoFrame' in window)) {
      throw new Error('This browser does not support WebCodecs MP4 export.');
    }

    const { Muxer, ArrayBufferTarget } = await loadMp4Muxer();
    const frameCount = getVideoFrameCount();
    const frameDurationUs = Math.round(1_000_000 / videoSettings.fps);
    const motionMode = currentMotionMode();
    await prepareMediaFrame(0);
    renderAnimationFrame(0, frameCount, overlayAssets.highResEmblems, motionMode);

    if (canvas.width % 2 !== 0 || canvas.height % 2 !== 0) {
      throw new Error('MP4 export requires even canvas dimensions.');
    }

    const config = {
      codec: videoSettings.mp4Codec,
      width: canvas.width,
      height: canvas.height,
      bitrate: videoSettings.bitrate,
      framerate: videoSettings.fps,
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) {
      throw new Error('This browser does not support the required MP4 codec.');
    }

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'avc',
        width: canvas.width,
        height: canvas.height,
        frameRate: videoSettings.fps,
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => {
        encoderError = error;
      },
    });
    encoder.configure(support.config);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      await prepareMediaFrame(frameIndex);
      renderAnimationFrame(frameIndex, frameCount, overlayAssets.highResEmblems, motionMode);
      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDurationUs,
        duration: frameDurationUs,
      });
      encoder.encode(frame);
      frame.close();

      if (frameIndex % 8 === 0) {
        activityMessage = `正在生成 MP4 视频 ${frameIndex + 1}/${frameCount}...`;
        updateStatusText();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    await encoder.flush();
    encoder.close();
    if (encoderError) {
      throw encoderError;
    }
    muxer.finalize();
    downloadBlob(new Blob([target.buffer], { type: 'video/mp4' }), videoSettings.mp4FileName);
    activityMessage = `已生成并下载 ${videoSettings.mp4FileName}。`;
    updateStatusText();
  }

  async function exportAnimatedWebm() {
    if (!canvas.captureStream || !('MediaRecorder' in window)) {
      throw new Error('This browser does not support WebM recording.');
    }

    const frameCount = getVideoFrameCount();
    const frameDurationMs = 1000 / videoSettings.fps;
    const motionMode = currentMotionMode();
    const mimeType = MediaRecorder.isTypeSupported(videoSettings.webmMimeType)
      ? videoSettings.webmMimeType
      : 'video/webm';
    const chunks = [];
    const stream = canvas.captureStream(videoSettings.fps);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: videoSettings.bitrate,
    });
    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(recorder.error || new Error('WebM recording failed.'));
      recorder.onstop = resolve;
    });

    recorder.start();
    if (uploadedMediaType === 'video') {
      uploadedMedia.currentTime = 0;
      await uploadedMedia.play().catch(() => {});
    }
    const track = stream.getVideoTracks()[0];
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      renderAnimationFrame(frameIndex, frameCount, overlayAssets.highResEmblems, motionMode);
      track?.requestFrame?.();
      if (frameIndex % 8 === 0) {
        activityMessage = `正在生成 WebM 备用视频 ${frameIndex + 1}/${frameCount}...`;
        updateStatusText();
      }
      await new Promise((resolve) => setTimeout(resolve, frameDurationMs));
    }
    recorder.stop();
    if (uploadedMediaType === 'video') {
      uploadedMedia.pause();
    }
    await finished;
    for (const trackItem of stream.getTracks()) {
      trackItem.stop();
    }

    downloadBlob(new Blob(chunks, { type: mimeType }), videoSettings.webmFileName);
    activityMessage = `MP4 不可用，已生成并下载 ${videoSettings.webmFileName}。`;
    updateStatusText();
  }

  async function exportAnimatedVideo() {
    if (!selectedHighResEmblemReady()) {
      activityMessage = '高清大图标仍在加载，请稍等后再导出视频。';
      updateStatusText();
      return;
    }

    stopAnimationPreview({ renderFinal: false });
    exportButton.disabled = true;
    try {
      activityMessage = '正在准备 MP4 视频导出...';
      updateStatusText();
      await exportAnimatedMp4();
    } catch (error) {
      console.warn(error);
      activityMessage = 'MP4 导出不可用，正在生成 WebM 备用视频...';
      updateStatusText();
      await exportAnimatedWebm();
    } finally {
      exportButton.disabled = false;
      render();
    }
  }

  function exportSelectedFormat() {
    stopAnimationPreview({ renderFinal: false });
    if (selectedExportMode() === 'video') {
      exportAnimatedVideo();
      return;
    }
    exportHighResImage();
  }

  function stopAnimationPreview(options = {}) {
    if (previewAnimationFrame !== null) {
      cancelAnimationFrame(previewAnimationFrame);
      previewAnimationFrame = null;
    }
    if (uploadedMediaType === 'video' && uploadedMedia) {
      uploadedMedia.pause();
    }
    previewAnimationButton.disabled = !uploadedMedia;
    previewAnimationButton.textContent = '预览动画';
    if (options.renderFinal !== false) {
      render();
    }
  }

  function playAnimationPreview() {
    if (!uploadedMedia) {
      activityMessage = '请先上传图片或视频，再预览动画。';
      updateStatusText();
      return;
    }

    stopAnimationPreview({ renderFinal: false });
    const startedAt = performance.now();
    const previewDurationMs = uploadedMediaType === 'video' ? getExportDurationMs() : videoSettings.durationMs;
    if (uploadedMediaType === 'video') {
      uploadedMedia.currentTime = 0;
      uploadedMedia.play().catch(() => {});
    }
    const emblems = selectedHighResEmblemReady()
      ? overlayAssets.highResEmblems
      : overlayAssets.previewEmblems;
    const motionMode = currentMotionMode();
    previewAnimationButton.disabled = true;
    previewAnimationButton.textContent = '预览中...';
    activityMessage = '正在预览动画效果。';
    updateStatusText();

    function tick(now) {
      const elapsedMs = now - startedAt;
      const progress = getTimelineProgress(elapsedMs, previewDurationMs, uploadedMediaType);
      render({ emblems, progress, elapsedMs, motionMode, staticFrame: false });
      if (elapsedMs < previewDurationMs) {
        previewAnimationFrame = requestAnimationFrame(tick);
        return;
      }
      previewAnimationFrame = null;
      if (uploadedMediaType === 'video') {
        uploadedMedia.pause();
      }
      previewAnimationButton.disabled = false;
      previewAnimationButton.textContent = '预览动画';
      activityMessage = '动画预览完成，可继续调整或导出视频。';
      updateStatusText();
      render();
    }

    previewAnimationFrame = requestAnimationFrame(tick);
  }

  function updateExportButtonLabel() {
    exportButton.textContent = selectedExportMode() === 'video' ? '导出视频' : '导出图片';
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
    if (params.has('motionMode')) {
      const requestedMotion = params.get('motionMode');
      if (Object.hasOwn(MOTION_PRESETS, requestedMotion)) {
        const motionControl = document.querySelector(`input[name="motionMode"][value="${requestedMotion}"]`);
        if (motionControl) {
          motionControl.checked = true;
        }
      }
    }
    if (params.has('sizeMode')) {
      const requestedSize = params.get('sizeMode');
      const allowedSizes = new Set(['16:9', '4:3', '9:16', 'source']);
      if (allowedSizes.has(requestedSize)) {
        const sizeControl = document.querySelector(`input[name="sizeMode"][value="${requestedSize}"]`);
        if (sizeControl) {
          sizeControl.checked = true;
        }
      }
    }
    autoplayTestPreview = params.get('autoplay') === '1';
    loadImageSource(safeName, safeName);
  }

  function bindEvents() {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      if (!file) {
        return;
      }
      const url = URL.createObjectURL(file);
      if ((file.type || '').startsWith('video/') || /\.(mp4|webm|mov|m4v)$/iu.test(file.name)) {
        loadVideoSource(url, file.name);
        return;
      }
      loadImageSource(url, file.name);
    });

    [line1Input, line2Input, overlayColorInput, overlayOpacityInput].forEach((control) => {
      control.addEventListener('input', () => {
        stopAnimationPreview({ renderFinal: false });
        opacityValue.textContent = `${Math.round(Number(overlayOpacityInput.value) * 100)}%`;
        render();
      });
    });

    document.querySelectorAll('input[name="sizeMode"]').forEach((control) => {
      control.addEventListener('change', () => {
        stopAnimationPreview({ renderFinal: false });
        render();
      });
    });

    emblemSelect.addEventListener('change', () => {
      stopAnimationPreview({ renderFinal: false });
      render();
    });

    document.querySelectorAll('input[name="exportMode"]').forEach((control) => {
      control.addEventListener('change', updateExportButtonLabel);
    });

    document.querySelectorAll('input[name="motionMode"]').forEach((control) => {
      control.addEventListener('change', () => {
        stopAnimationPreview({ renderFinal: false });
        render();
      });
    });

    previewAnimationButton.addEventListener('click', playAnimationPreview);
    exportButton.addEventListener('click', exportSelectedFormat);
  }

  exportButton.disabled = true;
  previewAnimationButton.disabled = true;
  updateExportButtonLabel();
  bindEvents();
  loadOverlayAssets().catch(() => {
    assetWarning = '固定素材加载失败，请检查 assets 目录。';
    updateStatusText();
  });
  loadTestImageFromQuery();
  render();
})();
