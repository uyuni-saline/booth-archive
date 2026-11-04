// Usage: decode a BOOTH MHTML's main HTML to stdin, then run this script.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent(fs.readFileSync(0, 'utf8'));
    await page.evaluate(fs.readFileSync('booth-archive.user.js', 'utf8').replace('  api.init();', '  window.archiveTestApi = api;'));
    const product = await page.evaluate(() => window.archiveTestApi.extractProduct(document, 'https://wlabel.booth.pm/items/9021875'));
    assert.equal(product.title, 'SugarChouChou Tart Collection アクリルブロック');
    assert.equal(product.shop.name, 'W.label store');
    assert.equal(product.shop.id, 'wlabel');
    assert(product.shop.links.some(link => link.url === 'https://www.pixiv.net/users/502358'));
    assert.deepEqual(product.variants.map(v => [v.name, v.price]), [['Berry Tart', 4500], ['Peach Tart', 4500]]);
    assert.equal(product.images.length, 4);
    assert(product.images[0].url.endsWith('21ba3556-1d4c-4813-96d2-e5975cfa9027.png'));
    assert(product.description.includes('100mm'));
    console.log(JSON.stringify(product, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
