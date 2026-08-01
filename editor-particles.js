(function () {
  const canvas = document.getElementById('editorParticleCanvas');
  const workbenchVideo = document.querySelector('.workbench-video');
  const captureMode = document.body.classList.contains('capture-mode');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function startWorkbenchVideo() {
    if (!workbenchVideo || captureMode || reducedMotion?.matches) {
      return;
    }
    if (!workbenchVideo.src && workbenchVideo.dataset.src) {
      workbenchVideo.src = workbenchVideo.dataset.src;
    }
    workbenchVideo.play().catch(() => {});
  }

  function stopWorkbenchVideo() {
    workbenchVideo?.pause();
  }

  startWorkbenchVideo();
  if (!canvas || !canvas.getContext || captureMode) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const previewCanvas = document.getElementById('previewCanvas');
  const previewPanel = document.querySelector('.preview-panel');
  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
    targetX: 0,
    targetY: 0,
    cameraX: 0,
    cameraY: 0,
    active: false,
  };
  const particles = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let previewPanelLeft = 0;
  let animationFrame = null;
  let lastTime = 0;

  function seededUnit(index, salt) {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function desiredParticleCount() {
    const areaCount = Math.round((width * height) / 21_000);
    return Math.min(78, Math.max(width <= 640 ? 36 : 50, areaCount));
  }

  function resetParticle(particle, index, cycle, startAnywhere) {
    const seedIndex = index + cycle * 71;
    const angle = seededUnit(seedIndex, 1) * Math.PI * 2;
    const radius = 0.14 + Math.pow(seededUnit(seedIndex, 2), 0.72) * 1.18;
    particle.worldX = Math.cos(angle) * radius * (0.72 + seededUnit(seedIndex, 3) * 0.48);
    particle.worldY = Math.sin(angle) * radius * (0.58 + seededUnit(seedIndex, 4) * 0.48);
    particle.depth = startAnywhere ? seededUnit(seedIndex, 5) : seededUnit(seedIndex, 5) * 0.08;
    particle.speed = 0.055 + seededUnit(seedIndex, 6) * 0.07;
    particle.size = 1 + seededUnit(seedIndex, 7) * 1.6;
    particle.warm = seededUnit(seedIndex, 8) > 0.8;
    particle.glint = seedIndex % 8 === 0;
    particle.phase = seededUnit(seedIndex, 9) * Math.PI * 2;
    particle.cycle = cycle;
    particle.previousX = null;
    particle.previousY = null;
  }

  function createParticle(index) {
    const particle = {};
    resetParticle(particle, index, 0, true);
    return particle;
  }

  function syncParticles() {
    const target = desiredParticleCount();
    while (particles.length < target) {
      particles.push(createParticle(particles.length));
    }
    particles.length = target;
  }

  function resize() {
    const nextWidth = Math.max(1, window.innerWidth);
    const nextHeight = Math.max(1, window.innerHeight);
    const nextRatio = Math.min(1.6, Math.max(1, window.devicePixelRatio || 1));
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) {
      return;
    }

    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    previewPanelLeft = previewPanel?.getBoundingClientRect().left ?? width * 0.46;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    syncParticles();
    for (const particle of particles) {
      particle.previousX = null;
      particle.previousY = null;
    }
  }

  function projectParticle(particle, elapsedSeconds) {
    const depthCurve = Math.pow(particle.depth, 1.7);
    const perspective = 0.42 + depthCurve * 1.48;
    const aspect = Math.max(0.64, Math.min(1.55, width / height));
    const drift = Math.sin(elapsedSeconds * 0.22 + particle.phase) * (5 + depthCurve * 11);
    const parallaxX = pointer.cameraX * (10 + depthCurve * 44);
    const parallaxY = pointer.cameraY * (7 + depthCurve * 31);

    return {
      x: width * 0.5 + particle.worldX * width * 0.56 * perspective + drift + parallaxX,
      y: height * 0.5 + particle.worldY * height * 0.68 * perspective / aspect + parallaxY,
      depthCurve,
      perspective,
    };
  }

  function updateParticle(particle, index, deltaSeconds, elapsedSeconds) {
    particle.previousX = particle.screenX ?? null;
    particle.previousY = particle.screenY ?? null;
    particle.depth += particle.speed * deltaSeconds;

    const projected = projectParticle(particle, elapsedSeconds);
    particle.screenX = projected.x;
    particle.screenY = projected.y;
    particle.depthCurve = projected.depthCurve;
    particle.perspective = projected.perspective;

    const margin = 90;
    const escaped = particle.screenX < -margin
      || particle.screenX > width + margin
      || particle.screenY < -margin
      || particle.screenY > height + margin;
    if (particle.depth > 1.02 || escaped) {
      resetParticle(particle, index, particle.cycle + 1, false);
      const resetProjection = projectParticle(particle, elapsedSeconds);
      particle.screenX = resetProjection.x;
      particle.screenY = resetProjection.y;
      particle.depthCurve = resetProjection.depthCurve;
      particle.perspective = resetProjection.perspective;
    }
  }

  function colorForParticle(particle) {
    if (particle.screenX >= previewPanelLeft) {
      return particle.warm ? '255, 221, 157' : '190, 229, 255';
    }
    return particle.warm ? '143, 91, 45' : '42, 103, 154';
  }

  function drawParticle(particle, index, elapsedSeconds) {
    const depth = particle.depthCurve;
    const pulse = 0.84 + Math.sin(elapsedSeconds * 1.35 + particle.phase) * 0.16;
    const radius = particle.size * (0.48 + depth * 2.55);
    const alpha = (0.24 + depth * 0.7) * pulse;
    const color = colorForParticle(particle);
    const trailBoost = 1.8 + depth * 6.2;
    let trailX = particle.previousX;
    let trailY = particle.previousY;

    if (trailX === null || trailY === null) {
      trailX = particle.screenX;
      trailY = particle.screenY;
    }
    const movementX = particle.screenX - trailX;
    const movementY = particle.screenY - trailY;
    const trailStartX = particle.screenX - movementX * trailBoost;
    const trailStartY = particle.screenY - movementY * trailBoost;

    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.65, radius * 0.58);
    const trailGradient = ctx.createLinearGradient(
      trailStartX,
      trailStartY,
      particle.screenX,
      particle.screenY,
    );
    trailGradient.addColorStop(0, `rgba(${color}, 0)`);
    trailGradient.addColorStop(1, `rgba(${color}, ${alpha * 0.72})`);
    ctx.strokeStyle = trailGradient;
    ctx.beginPath();
    ctx.moveTo(trailStartX, trailStartY);
    ctx.lineTo(particle.screenX, particle.screenY);
    ctx.stroke();

    if (depth > 0.46) {
      ctx.shadowColor = `rgba(${color}, ${alpha * 0.62})`;
      ctx.shadowBlur = 7 + depth * 15;
    }
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.screenX, particle.screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (particle.glint && depth > 0.32) {
      const arm = radius * (2.7 + depth * 1.8);
      ctx.globalAlpha = Math.min(0.8, alpha * 0.78);
      ctx.lineWidth = Math.max(0.65, radius * 0.2);
      ctx.strokeStyle = `rgb(${color})`;
      ctx.beginPath();
      ctx.moveTo(particle.screenX - arm, particle.screenY);
      ctx.lineTo(particle.screenX + arm, particle.screenY);
      ctx.moveTo(particle.screenX, particle.screenY - arm * 0.56);
      ctx.lineTo(particle.screenX, particle.screenY + arm * 0.56);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function clearPreviewCanvasArea() {
    if (!previewCanvas) {
      return;
    }
    const rect = previewCanvas.getBoundingClientRect();
    const padding = 3;
    ctx.clearRect(
      Math.floor(rect.left - padding),
      Math.floor(rect.top - padding),
      Math.ceil(rect.width + padding * 2),
      Math.ceil(rect.height + padding * 2),
    );
  }

  function renderFrame(now) {
    resize();
    const deltaSeconds = Math.min(0.04, Math.max(0, (now - lastTime) / 1000 || 0));
    const elapsedSeconds = now / 1000;
    lastTime = now;
    ctx.clearRect(0, 0, width, height);

    pointer.cameraX += (pointer.targetX - pointer.cameraX) * Math.min(1, deltaSeconds * 3.5);
    pointer.cameraY += (pointer.targetY - pointer.cameraY) * Math.min(1, deltaSeconds * 3.5);
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      updateParticle(particle, index, deltaSeconds, elapsedSeconds);
      drawParticle(particle, index, elapsedSeconds);
    }
    clearPreviewCanvasArea();
    ctx.globalAlpha = 1;
    animationFrame = requestAnimationFrame(renderFrame);
  }

  function stop() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    ctx.clearRect(0, 0, width, height);
  }

  function start() {
    if (animationFrame !== null || reducedMotion?.matches || document.hidden) {
      return;
    }
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(renderFrame);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.targetX = (event.clientX / Math.max(1, width) - 0.5) * -1;
    pointer.targetY = (event.clientY / Math.max(1, height) - 0.5) * -1;
    pointer.active = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.targetX = 0;
    pointer.targetY = 0;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
      stopWorkbenchVideo();
    } else {
      start();
      startWorkbenchVideo();
    }
  });
  reducedMotion?.addEventListener?.('change', (event) => {
    if (event.matches) {
      stop();
      stopWorkbenchVideo();
    } else {
      start();
      startWorkbenchVideo();
    }
  });

  resize();
  start();
})();
