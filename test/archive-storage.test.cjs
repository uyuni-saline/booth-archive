const test = require('node:test');
const assert = require('node:assert/strict');
const { saveProduct, refreshArchiveButton, directoryStore } = require('../booth-archive.user.js');

function fixture(failJson = false) {
  const files = new Map();
  const dir = {
    getDirectoryHandle: async () => dir,
    getFileHandle: async name => ({
      createWritable: async () => ({
        write: async value => {
          if (failJson && name.endsWith('.json')) throw new Error('disk full');
          files.set(name, value);
        },
        close: async () => {}, abort: async () => {},
      }),
    }),
  };
  const product = {
    schemaVersion: 2, id: '9021875', shop: { id: 'wlabel' }, title: '商品',
    description: '完整描述', archivedAt: '2026-11-04',
    variants: [{ name: 'Berry Tart', price: 4500 }],
    images: [{ url: 'https://booth.pximg.net/a.png' }, { url: 'https://booth.pximg.net/b.png' }],
  };
  return { files, dir, product };
}
test('writes one JSON last with every local image path, then remembers completion', async () => {
  const { files, dir, product } = fixture();
  let remembered = false;
  await saveProduct(dir, product, async () => 'image bytes', () => { remembered = true; });
  assert(remembered);
  assert.equal(files.size, 3);
  const jsonNames = [...files.keys()].filter(name => name.endsWith('.json'));
  assert.equal(jsonNames.length, 1);
  const json = JSON.parse(files.get(jsonNames[0]));
  assert.equal(json.status, 'complete');
  for (const image of json.images) {
    assert(files.has(image.file));
    assert.equal(image.relativePath, './' + image.file);
  }
  assert.equal([...files.keys()].at(-1), jsonNames[0]);
});
test('image failure never records completion', async () => {
  const { dir, product, files } = fixture();
  let remembered = false;
  await assert.rejects(saveProduct(dir, product, async () => { throw Error('network'); }, () => { remembered = true; }));
  assert.equal(remembered, false);
  assert.equal(files.size, 0);
});
test('JSON write failure never records completion', async () => {
  const { dir, product } = fixture(true);
  let remembered = false;
  await assert.rejects(saveProduct(dir, product, async () => 'image', () => { remembered = true; }));
  assert.equal(remembered, false);
});
test('archived button has Chinese label and gray background', () => {
  const old = global.GM_getValue;
  try {
    global.GM_getValue = () => ({ archivedAt: 'today' });
    const button = { style: {} };
    refreshArchiveButton(button, '9021875');
    assert.equal(button.textContent, '已存档');
    assert.equal(button.style.background, '#ddd');
    global.GM_getValue = () => null;
    refreshArchiveButton(button, '9021875');
    assert.equal(button.textContent, '本地存档');
  } finally { global.GM_getValue = old; }
});

test('directory handle is stored and read through structured-clone storage', async () => {
  const old = global.indexedDB;
  let stored;
  global.indexedDB = {
    open() {
      const request = {};
      const db = {
        close() {},
        transaction() {
          const tx = { objectStore: () => ({
            put(value) {
              stored = value;
              const op = {};
              setImmediate(() => { op.onsuccess(); tx.oncomplete(); });
              return op;
            },
            get() {
              const op = { result: stored };
              setImmediate(() => { op.onsuccess(); tx.oncomplete(); });
              return op;
            },
          }) };
          return tx;
        },
      };
      setImmediate(() => { request.result = db; request.onsuccess(); });
      return request;
    },
  };
  try {
    const handle = { name: 'BOOTH库存', kind: 'directory' };
    await directoryStore('readwrite', store => store.put(handle, 'directory'));
    assert.equal(await directoryStore('readonly', store => store.get('directory')), handle);
  } finally { global.indexedDB = old; }
});
