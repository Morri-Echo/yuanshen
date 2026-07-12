const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pngAssets = [
  'mengdei.png',
  'weiwandaixu-clean.png',
];

for (const name of pngAssets) {
  const file = path.resolve(__dirname, '..', 'assets', name);
  assert.equal(fs.existsSync(file), true, `${name} should exist`);
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.slice(0, 8).toString('hex'), '89504e470d0a1a0a', `${name} should be PNG`);
  assert.equal(bytes[25], 6, `${name} should be RGBA PNG with alpha channel`);
  assert.ok(bytes.length > 10_000, `${name} should not be empty`);
}

console.log('PASS clean asset checks');
