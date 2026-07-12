const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspace = path.resolve(__dirname, '..');
const outputDir = path.join(workspace, 'outputs');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const screenshotPath = path.join(outputDir, 'task-overlay-sample.png');
const profilePath = path.join(outputDir, 'edge-profile-temp');

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
  assert.equal(await fetchStatus('http://127.0.0.1:8000/index.html'), 200);
  assert.equal(await fetchStatus('http://127.0.0.1:8000/2.jpg'), 200);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(profilePath, { recursive: true, force: true });
  const url = 'http://127.0.0.1:8000/index.html?testImage=2.jpg&capture=1&line1=%E7%AC%AC%E4%B8%80%E7%AB%A0%20%E7%AC%AC%E4%B8%80%E5%B9%95%20%E5%AE%8C%E6%88%90&line2=%E6%B5%8B%E8%AF%95%E6%A0%87%E9%A2%98';
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
  fs.rmSync(profilePath, { recursive: true, force: true });

  assert.equal(result.status, 0, result.stderr.toString() || result.stdout.toString());
  assert.equal(fs.existsSync(screenshotPath), true);
  assert.ok(fs.statSync(screenshotPath).size > 50_000);
  console.log('PASS Edge smoke test');
  console.log(`Screenshot: ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
