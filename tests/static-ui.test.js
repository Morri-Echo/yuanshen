const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const script = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'script.js'), 'utf8');
const editorParticles = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'editor-particles.js'), 'utf8');
const styles = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'styles.css'), 'utf8');

const expectedEmblemOptions = [
  ['mengdei', '蒙德'],
  ['liyue', '璃月'],
  ['daoqi', '稻妻'],
  ['xuni', '须弥'],
  ['fengdan', '枫丹'],
  ['nata', '纳塔'],
  ['nuodekalai', '空月之歌'],
];

const emblemFieldMarkup = html.match(
  /<label class="field">\s*<span>任务徽记<\/span>\s*<select id="emblemSelect">([\s\S]*?)<\/select>\s*<\/label>/u
);
assert.ok(
  emblemFieldMarkup,
  'emblemSelect and its label text should be grouped in the same field label'
);

const actualEmblemOptions = [...emblemFieldMarkup[1].matchAll(
  /<option value="([^"]+)">([^<]+)<\/option>/gu
)].map((match) => [match[1], match[2]]);

assert.deepEqual(
  actualEmblemOptions,
  expectedEmblemOptions,
  'emblem options should match the expected values, labels, and order'
);

const opacityInputPosition = html.indexOf('id="overlayOpacityInput"');
const emblemSelectPosition = html.indexOf('id="emblemSelect"');
const exportButtonPosition = html.indexOf('id="exportButton"');
const previewAnimationButtonPosition = html.indexOf('id="previewAnimationButton"');
const exportModePosition = html.indexOf('name="exportMode"');
const motionModePosition = html.indexOf('name="motionMode"');

assert.ok(opacityInputPosition >= 0, 'overlayOpacityInput should exist');
assert.ok(emblemSelectPosition >= 0, 'emblemSelect should exist');
assert.ok(exportButtonPosition >= 0, 'exportButton should exist');
assert.ok(previewAnimationButtonPosition >= 0, 'previewAnimationButton should exist');
assert.ok(exportModePosition >= 0, 'exportMode segmented controls should exist');
assert.ok(motionModePosition >= 0, 'motionMode segmented controls should exist');
assert.ok(html.includes('class="preview-toolbar"'), 'preview should include a toolbar');
assert.ok(html.includes('id="canvasSize"'), 'preview should expose the current canvas size');
assert.ok(
  html.includes('id="editorParticleCanvas"'),
  'editor chrome should include its own non-exported particle canvas'
);
assert.ok(
  html.includes('class="workbench-video"'),
  'editor chrome should include a dedicated workbench background video'
);
assert.ok(
  html.includes('data-src="assets/workbench-background.webm"'),
  'the optimized background video should be used as the workbench skin'
);
assert.equal(
  styles.includes('workbench-skin.gif'),
  false,
  'the previous GIF skin should no longer be referenced'
);
assert.ok(
  html.includes('<script src="js/editor-particles.js"></script>'),
  'the editor particle layer should be loaded'
);
assert.ok(
  html.indexOf('<script src="js/script.js"></script>')
    < html.indexOf('<script src="js/editor-particles.js"></script>'),
  'capture mode should be established before the editor particle layer initializes'
);
assert.match(
  html,
  /<input id="imageInput" type="file" accept="image\/\*,video\/\*">/u,
  'the upload control should accept images and videos'
);

assert.ok(
  opacityInputPosition < emblemSelectPosition
    && emblemSelectPosition < exportModePosition
    && exportModePosition < previewAnimationButtonPosition
    && previewAnimationButtonPosition < exportButtonPosition,
  'animation preview should appear after export mode and before the export button'
);

assert.match(
  html,
  /<input type="radio" name="exportMode" value="image" checked>\s*<span>[^<]*<\/span>/u,
  'image export should remain the default export mode'
);

for (const sizeMode of ['16:9', '4:3', '9:16', 'source']) {
  assert.ok(
    html.includes(`name="sizeMode" value="${sizeMode}"`),
    `size mode ${sizeMode} should be available`
  );
}

assert.match(
  html,
  /<input type="radio" name="exportMode" value="video">\s*<span>[^<]*<\/span>/u,
  'video export should be available as an export mode'
);

for (const motionMode of ['off', 'soft', 'full']) {
  assert.match(
    html,
    new RegExp(`<input type="radio" name="motionMode" value="${motionMode}"`, 'u'),
    `motion mode ${motionMode} should be available`
  );
}

assert.match(
  html,
  /<input type="radio" name="motionMode" value="soft" checked>/u,
  'the restrained particle mode should be selected by default'
);

assert.match(
  styles,
  /select option\s*\{[^}]*background(?:-color)?\s*:\s*#[0-9a-f]{6}[^}]*color\s*:\s*#fff8e8[^}]*\}/isu,
  'native select options should use a dark background with readable light text'
);

assert.match(
  styles,
  /body\.capture-mode \.control-panel,\s*body\.capture-mode \.preview-toolbar\s*\{[^}]*display\s*:\s*none/u,
  'capture mode should hide editor chrome and the preview toolbar for GitHub Pages screenshots'
);

assert.match(
  script,
  /canvasSize\.textContent\s*=\s*`\$\{size\.width\} x \$\{size\.height\}`/u,
  'the preview size label should stay in sync with the rendered canvas size'
);

assert.match(
  script,
  /selectedExportMode/u,
  'script should read the selected image or video export mode'
);

assert.match(
  script,
  /uploadedMedia/u,
  'script should track the current upload as a generic image or video media source'
);

assert.match(
  script,
  /loadVideoSource/u,
  'script should load uploaded video files for preview and export'
);

assert.match(
  script,
  /drawMediaFrame/u,
  'script should draw either an image or the current video frame behind the overlay'
);

assert.match(
  script,
  /getExportDurationMs/u,
  'video export should use the uploaded video duration when a video is loaded'
);

assert.match(
  script,
  /exportAnimatedMp4/u,
  'script should provide an MP4 animation export path'
);

assert.match(
  script,
  /exportAnimatedWebm/u,
  'script should provide a WebM fallback animation export path'
);

assert.match(
  script,
  /previewAnimationButton/u,
  'script should bind the animation preview button'
);

assert.match(
  script,
  /function drawParticleField/u,
  'the shared canvas renderer should provide an exportable particle layer'
);

assert.match(
  script,
  /getParticleState/u,
  'particle rendering should use the deterministic renderer-core state'
);

assert.match(
  styles,
  /@media \(prefers-reduced-motion: reduce\)/u,
  'editor motion should respect reduced-motion preferences'
);

assert.equal(
  editorParticles.includes('Math.random'),
  false,
  'editor particles should use deterministic initialization instead of Math.random'
);

assert.match(
  editorParticles,
  /particle\.depth\s*\+=\s*particle\.speed/u,
  'editor particles should advance through an explicit depth axis'
);

assert.match(
  editorParticles,
  /clearPreviewCanvasArea/u,
  'editor particles should stay out of the generated preview canvas'
);

assert.match(
  editorParticles,
  /if\s*\(\s*!workbenchVideo\.src\s*&&\s*workbenchVideo\.dataset\.src\s*\)/u,
  'the background video should load only after editor mode is established'
);

assert.match(
  styles,
  /body\.capture-mode \.editor-particle-canvas/u,
  'capture mode should hide the editor-only particle canvas'
);

assert.match(
  styles,
  /body\.capture-mode \.workbench-video/u,
  'capture mode should hide the editor-only background video'
);

assert.match(
  script,
  /playAnimationPreview/u,
  'script should play the same animation timeline inside the preview canvas'
);

assert.match(
  script,
  /stopAnimationPreview/u,
  'script should be able to stop an in-progress animation preview'
);

assert.match(
  script,
  /VideoEncoder/u,
  'MP4 export should use browser WebCodecs when available'
);

assert.match(
  script,
  /mp4-muxer/u,
  'MP4 export should load a static-page-compatible muxer from CDN'
);

assert.equal(
  script.includes("fillText('上传图片后在这里预览'"),
  false,
  'placeholder text should not be drawn into the generated canvas'
);

assert.equal(
  script.includes('assets/mengdei.png'),
  true,
  'the cleaned emblem PNG should be the primary emblem asset'
);

const expectedEmblemAssetPaths = [
  'assets/mengdei.png',
  'assets/liyue.png',
  'assets/daoqi.png',
  'assets/xuni.png',
  'assets/fengdan.png',
  'assets/nata.png',
  'assets/nuodekalai.png',
];

for (const assetPath of expectedEmblemAssetPaths) {
  assert.ok(
    script.includes(assetPath),
    `script should load the emblem asset ${assetPath}`
  );
}

const expectedPreviewEmblemAssetPaths = [
  'assets/preview/mengdei.png',
  'assets/preview/liyue.png',
  'assets/preview/daoqi.png',
  'assets/preview/xuni.png',
  'assets/preview/fengdan.png',
  'assets/preview/nata.png',
  'assets/preview/nuodekalai.png',
];

for (const assetPath of expectedPreviewEmblemAssetPaths) {
  assert.ok(
    script.includes(assetPath),
    `script should load the preview emblem asset ${assetPath}`
  );
}

assert.match(
  script,
  /emblemSelect\.addEventListener\(\s*['"]change['"]\s*,\s*\(\)\s*=>\s*\{[\s\S]*?stopAnimationPreview[\s\S]*?render\(\);[\s\S]*?\}\s*\)/u,
  'changing emblemSelect should stop animation preview and render the selected emblem immediately'
);

assert.match(
  script,
  /drawLuminousEmblem\(\s*emblems\[state\.emblem\]/u,
  'the center overlay should draw the selected emblem with the luminous treatment'
);

assert.match(
  script,
  /option\.disabled\s*=\s*true/u,
  'an emblem option should be disabled when its asset fails to load'
);

assert.equal(
  script.includes('assets/renwuwancheng.webp'),
  false,
  'task-complete should be generated by Canvas, not loaded from an image asset'
);

assert.equal(
  script.includes('assets/renwuwancheng-clean.png'),
  false,
  'the removed task-complete PNG should not be required by the renderer'
);

assert.equal(
  script.includes('assets/weiwandaixu-clean.png'),
  true,
  'the cleaned continuation PNG should be used for the fixed continuation line'
);

assert.equal(
  script.includes('drawOrnamentDivider'),
  true,
  'the task divider should be generated by Canvas instead of coming from the asset'
);

assert.match(
  script,
  /function drawOrnamentDivider\([^)]*\)\s*\{[\s\S]*?if\s*\(\s*width\s*<=\s*0\s*\|\|\s*progress\s*<=\s*0\s*\)\s*\{[\s\S]*?return;[\s\S]*?\}/u,
  'the divider center diamonds should not render before the divider animation starts'
);

assert.equal(
  script.includes('drawTaskCompleteText'),
  true,
  'the fixed task-complete text should be generated by Canvas'
);

assert.equal(
  script.includes('makeWhiteTransparent'),
  false,
  'runtime white-background cleanup should not be needed after removing the task-complete image'
);

assert.equal(
  script.includes('assets/material.webp'),
  false,
  'the non-transparent material.webp should not be loaded by the main renderer'
);

assert.equal(
  script.includes('drawEmblemGlow'),
  true,
  'the main renderer should add a clean synthetic glow behind the emblem'
);

assert.match(
  script,
  /drawGoldEmblemMask/u,
  'the selected emblem should be recolored through a gold mask instead of remaining white'
);

assert.match(
  script,
  /#FFF2C8/u,
  'the emblem body should use a warm ivory highlight instead of a saturated gold fill'
);

assert.match(
  script,
  /#F8E7B8/u,
  'the emblem body should keep a pale gold-white midtone like the reference'
);

assert.match(
  script,
  /#C9A96E/u,
  'dark gold should remain available for the emblem edge and glow color'
);

assert.match(
  script,
  /rgba\(201,\s*169,\s*110,\s*0\.6\)/u,
  'the emblem glow should use the requested soft gold drop-shadow color'
);

assert.match(
  script,
  /drawEmblemBacklight/u,
  'the emblem should use a separate blurred backlight layer behind the crisp body'
);

console.log('PASS static UI checks');
