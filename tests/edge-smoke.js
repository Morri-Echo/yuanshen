const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspace = path.resolve(__dirname, '..');
const outputDir = path.join(workspace, 'outputs');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sampleScreenshotPath = path.join(outputDir, 'task-overlay-sample.png');
const emblemKeys = [
  'mengdei',
  'liyue',
  'daoqi',
  'xuni',
  'fengdan',
  'nata',
  'nuodekalai',
  'zhidong',
  'dachishahai',
  'chenyugu',
  'youyoudujiacun',
  'kongzhishendian',
  'huanxiangzhenjinjushi',
];
const port = process.env.EDGE_SMOKE_PORT || '8000';
const origin = `http://127.0.0.1:${port}`;

function fetchStatus(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
  });
}

async function main() {
  assert.equal(fs.existsSync(edgePath), true, 'Microsoft Edge is required for this smoke test');
  assert.equal(await fetchStatus(`${origin}/index.html`), 200);
  assert.equal(await fetchStatus(`${origin}/tests/fixtures/2.jpg`), 200);

  fs.mkdirSync(outputDir, { recursive: true });
  const runId = crypto.randomBytes(8).toString('hex');
  const profilePaths = [];
  const screenshotPaths = [];
  const hashes = new Set();

  for (const emblemKey of emblemKeys) {
    const profilePath = path.join(outputDir, `edge-profile-${emblemKey}-${runId}`);
    const screenshotPath = path.join(outputDir, `edge-smoke-${emblemKey}-${runId}.png`);
    profilePaths.push(profilePath);
    screenshotPaths.push(screenshotPath);

    try {
      const url = `${origin}/index.html?testImage=tests/fixtures/2.jpg&capture=1&emblem=${emblemKey}`;
      const result = spawnSync(edgePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=5000',
        `--user-data-dir=${profilePath}`,
        '--window-size=1920,1080',
        `--screenshot=${screenshotPath}`,
        url,
      ]);

      assert.equal(
        result.status,
        0,
        result.error?.message || result.stderr.toString() || result.stdout.toString(),
      );
      assert.equal(fs.existsSync(screenshotPath), true, `Missing screenshot for ${emblemKey}`);
      const png = fs.readFileSync(screenshotPath);
      assert.ok(png.length > 50_000, `Screenshot for ${emblemKey} is unexpectedly small`);
      hashes.add(crypto.createHash('sha256').update(png).digest('hex'));

      if (emblemKey === 'mengdei') {
        fs.copyFileSync(screenshotPath, sampleScreenshotPath);
      }
    } finally {
      try {
        fs.rmSync(profilePath, { recursive: true, force: true });
      } finally {
        fs.rmSync(screenshotPath, { force: true });
      }
    }
  }

  assert.equal(hashes.size, emblemKeys.length, 'Each emblem must produce a distinct render');
  assert.equal(profilePaths.some((profilePath) => fs.existsSync(profilePath)), false);
  assert.equal(screenshotPaths.some((screenshotPath) => fs.existsSync(screenshotPath)), false);
  console.log('PASS Edge smoke test');
  console.log(`Screenshot: ${sampleScreenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
