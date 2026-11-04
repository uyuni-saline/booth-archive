const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanName, imageExtension, extractProduct } = require('../booth-archive.user.js');
test('archive filenames are safe and keep Unicode', () => {
  assert.equal(cleanName('BOOTH 店名 a/b:*?.'), 'BOOTH 店名 a_b___');
  assert.equal(imageExtension('https://booth.pximg.net/a.png'), '.png');
});
test('reject non-item pages', () => {
  assert.throws(() => extractProduct({}, 'https://accounts.booth.pm/dashboard?page=2'));
});
