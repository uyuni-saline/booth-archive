const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanName, imageExtension, extractProduct } = require('../booth-archive.user.js');
const vm = require('node:vm');
const fs = require('node:fs');
test('archive filenames are safe and keep Unicode', () => {
  assert.equal(cleanName('BOOTH 店名 a/b:*?.'), 'BOOTH 店名 a_b___');
  assert.equal(imageExtension('https://booth.pximg.net/a.png'), '.png');
});
test('reject non-item pages', () => {
  assert.throws(() => extractProduct({}, 'https://accounts.booth.pm/dashboard?page=2'));
});

test('extracts current product title without using recommendation headings', () => {
  const titleSelector = '#js-item-info-detail .summary header h2';
  const doc = {
    querySelector(selector) {
      if (selector === titleSelector) return { textContent: 'SugarChouChou Tart Collection アクリルブロック' };
      if (selector === 'h2.item-name') throw new Error('Recommendation title must not be used');
      return null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith('img.')) return [{
        closest: () => null,
        getAttribute: () => 'https://booth.pximg.net/shop/i/9021875/cover.png',
      }];
      return [];
    },
  };
  assert.equal(extractProduct(doc, 'https://wlabel.booth.pm/items/9021875').title,
    'SugarChouChou Tart Collection アクリルブロック');
});

test('browser bootstrap mounts floating archive buttons without any product detail DOM', () => {
  const nodes = new Map();
  const element = () => ({
    style: {}, dataset: {}, children: [], setAttribute() {}, addEventListener() {},
    append(...children) { this.children.push(...children); children.forEach(node => nodes.set(node.id, node)); },
    prepend(node) { this.children.unshift(node); nodes.set(node.id, node); },
  });
  const context = {
    URL, console,
    location: { pathname: '/items/9021875', href: 'https://wlabel.booth.pm/items/9021875' },
    GM_getValue: () => false,
    MutationObserver: class { observe() {} },
    document: {
      getElementById: id => nodes.get(id),
      createElement: element,
      querySelector: () => null,
      querySelectorAll: () => [{ classList: { toggle() {} } }],
      head: { appendChild() {} }, body: { appendChild(node) { nodes.set(node.id, node); } },
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../booth-archive.user.js'), 'utf8'), context);
  const panel = nodes.get('booth-archive-product-tools');
  assert(panel);
  assert.equal(panel.children.filter(child => child.type === 'button').length, 3);
  assert.equal(nodes.get('booth-archive-dock').children[0], panel);
  assert.equal(nodes.get('booth-archive-dock').children[1].id, 'booth-archive-filter-control');
});
