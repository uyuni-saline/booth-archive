const test = require('node:test');
const assert = require('node:assert/strict');
const { saveProduct, refreshArchiveButton, productId, resolveShop, archiveMemoryKey } = require('../booth-archive.user.js');
function product() {
  return { schemaVersion: 3, id: '9021875', shop: { id: 'wlabel' },
    title: '商品', description: '完整描述', images: [
      { url: 'https://booth.pximg.net/a.png' }, { url: 'https://booth.pximg.net/b.png' },
    ] };
}
test('main site and shop URL share the exact item memory key', () => {
  const a = productId('https://booth.pm/ja/items/9021875?x=1');
  const b = productId('https://wlabel.booth.pm/items/9021875');
  assert.equal(a, b);
  assert.equal(archiveMemoryKey(a), archiveMemoryKey(b));
  assert.notEqual(archiveMemoryKey(a), archiveMemoryKey('9021932'));
});
test('main site resolves shop from product brand rather than booth hostname', () => {
  const doc = { querySelector: () => ({ getAttribute: () => 'wlabel' }), querySelectorAll: () => [] };
  assert.deepEqual(resolveShop(doc, 'https://booth.pm/ja/items/9021875'), { id: 'wlabel', url: 'https://wlabel.booth.pm/' });
});
test('downloads images then one JSON containing relative paths before marking archived', async () => {
  const files = [];
  let json;
  let remembered = false;
  await saveProduct(product(), async (url, name) => {
    files.push(name);
    if (name.endsWith('.json')) json = await (await fetch(url)).json();
  }, () => { remembered = true; assert.equal(files.length, 3); });
  assert(remembered);
  assert.equal(files.filter(name => name.endsWith('.json')).length, 1);
  assert.equal(json.status, 'complete');
  assert.equal(json.archiveRelativePath, 'BOOTH存档/9021875/');
  for (const image of json.images) {
    assert.equal(image.relativePath, './' + image.file);
    assert(files.includes(json.archiveRelativePath + image.file));
  }
});
test('repeated archives use exactly the same download paths', async () => {
  const first = [];
  const second = [];
  await saveProduct(product(), async (url, name) => first.push(name), () => {});
  await saveProduct(product(), async (url, name) => second.push(name), () => {});
  assert.deepEqual(first, second);
});
test('image or JSON download failure does not record completion', async () => {
  for (const failAt of [1, 3]) {
    let calls = 0; let remembered = false;
    await assert.rejects(saveProduct(product(), async () => {
      if (++calls === failAt) throw Error('download failed');
    }, () => { remembered = true; }));
    assert.equal(remembered, false);
  }
});
test('archived button has Chinese label and gray background', () => {
  const old = global.GM_getValue;
  try {
    global.GM_getValue = () => ({ archivedAt: 'today' });
    const button = { style: {} };
    refreshArchiveButton(button, '9021875');
    assert.equal(button.textContent, '已存档');
    assert.equal(button.style.background, '#ddd');
  } finally { global.GM_getValue = old; }
});
