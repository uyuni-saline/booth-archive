const test = require('node:test');
const assert = require('node:assert/strict');
const { listArchiveRecords, importArchiveRecords, clearArchiveRecords } = require('../booth-archive.user.js');

function withStore(run) {
  const names = ['GM_getValue', 'GM_setValue', 'GM_listValues', 'GM_deleteValue'];
  const old = names.map(name => global[name]);
  const store = new Map();
  global.GM_getValue = (key, fallback) => store.has(key) ? store.get(key) : fallback;
  global.GM_setValue = (key, value) => store.set(key, value);
  global.GM_listValues = () => [...store.keys()];
  global.GM_deleteValue = key => store.delete(key);
  try { run(store); }
  finally { names.forEach((name, index) => { global[name] = old[index]; }); }
}
const record = id => ({ id, archivedAt: '2026-11-04T00:00:00Z', relativePath: 'BOOTH存档/' + id + '/item.json' });
const backup = records => ({ format: 'booth-archive-records', version: 1, records });

test('record backup round trip merges without replacing existing records', () => withStore(store => {
  importArchiveRecords(backup([record('9021875')]));
  const exported = JSON.parse(JSON.stringify(backup(listArchiveRecords())));
  clearArchiveRecords();
  assert.deepEqual(importArchiveRecords(exported), { added: 1, skipped: 0 });
  const existing = store.get('archived-product:9021875');
  assert.deepEqual(importArchiveRecords(backup([record('9021875'), record('9021932')])), { added: 1, skipped: 1 });
  assert.equal(store.get('archived-product:9021875'), existing);
}));
test('invalid backup validates all records before modifying storage', () => withStore(store => {
  for (const bad of [
    backup([record('1'), { ...record('2'), archivedAt: 'bad' }]),
    backup([record('1'), record('1')]),
    { schemaVersion: 3, id: '1' },
    backup([{ ...record('1'), id: '../file' }]),
  ]) {
    assert.throws(() => importArchiveRecords(bad));
    assert.equal(store.size, 0);
  }
}));
test('clear deletes only archive markers and preserves plugin settings', () => withStore(store => {
  store.set('downloadFolder', 'BOOTH存档');
  store.set('hideUnavailableItems', true);
  importArchiveRecords(backup([record('1'), record('2')]));
  assert.equal(clearArchiveRecords(), 2);
  assert.deepEqual([...store.keys()], ['downloadFolder', 'hideUnavailableItems']);
  assert.equal(listArchiveRecords().length, 0);
}));
