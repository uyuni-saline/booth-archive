// ==UserScript==
// @name         BOOTH Archive
// @namespace    https://github.com/uyuni-saline/booth-archive
// @version      0.3.0
// @description  Improve BOOTH and BOOTH shop pages with optional browsing tools.
// @author       uyuni-saline
// @match        https://booth.pm/*
// @match        https://*.booth.pm/*
// @icon         https://booth.pm/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      booth.pximg.net
// @run-at       document-idle
// @homepageURL  https://github.com/uyuni-saline/booth-archive
// @supportURL   https://github.com/uyuni-saline/booth-archive/issues
// @downloadURL  https://raw.githubusercontent.com/uyuni-saline/booth-archive/main/booth-archive.user.js
// @updateURL    https://raw.githubusercontent.com/uyuni-saline/booth-archive/main/booth-archive.user.js
// ==/UserScript==

(function bootstrap(factory) {
  'use strict';

  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  api.init();
})(function createBoothArchive() {
  'use strict';

  const FEATURE_KEY = 'hideUnavailableItems';
  const CARD_SELECTORS = [
    'li.js-mount-point-shop-item-card',
    'li.item-card.l-card',
  ];
  const CARD_SELECTOR = CARD_SELECTORS.join(', ');
  const HIDDEN_CLASS = 'booth-archive-hidden-item';
  const CONTROL_ID = 'booth-archive-filter-control';
  const STYLE_ID = 'booth-archive-style';
  const UNAVAILABLE_LABELS = ['販売終了', '在庫なし'];

  let filterEnabled = false;
  let updateScheduled = false;

  function parseItemData(card) {
    const rawItem = card.getAttribute('data-item');
    if (!rawItem) return null;

    try {
      return JSON.parse(rawItem);
    } catch (error) {
      console.warn('[BOOTH Archive] Failed to parse item data.', error);
      return null;
    }
  }

  function isUnavailableItem(card) {
    const item = parseItemData(card);
    if (item && (item.is_end_of_sale === true || item.is_sold_out === true)) {
      return true;
    }

    const cardText = card.textContent || '';
    return UNAVAILABLE_LABELS.some((label) => cardText.includes(label));
  }

  function getCards(root = document) {
    return Array.from(root.querySelectorAll(CARD_SELECTOR));
  }

  function applyFilter() {
    const cards = getCards();
    let hiddenCount = 0;

    for (const card of cards) {
      const shouldHide = filterEnabled && isUnavailableItem(card);
      card.classList.toggle(HIDDEN_CLASS, shouldHide);
      if (shouldHide) hiddenCount += 1;
    }

    const count = document.querySelector(`#${CONTROL_ID} [data-role="count"]`);
    if (count) {
      const nextText = filterEnabled ? `非表示: ${hiddenCount}` : '';
      if (count.textContent !== nextText) count.textContent = nextText;
    }
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HIDDEN_CLASS} {
        display: none !important;
      }

      #${CONTROL_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: calc(100vw - 36px);
        padding: 10px 14px;
        border: 1px solid #d7d7d7;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.16);
        color: #333;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #${CONTROL_ID} label {
        display: flex;
        align-items: center;
        gap: 7px;
        cursor: pointer;
        user-select: none;
      }

      #${CONTROL_ID} input {
        width: 17px;
        height: 17px;
        accent-color: #fc4d50;
      }

      #${CONTROL_ID} [data-role="count"] {
        color: #777;
        font-size: 12px;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function createControl() {
    if (document.getElementById(CONTROL_ID) || getCards().length === 0) return;

    const control = document.createElement('div');
    control.id = CONTROL_ID;

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = filterEnabled;
    checkbox.setAttribute('aria-label', '販売終了・在庫なしの商品を隠す');

    const text = document.createElement('span');
    text.textContent = '販売終了・在庫なしを隠す';

    const count = document.createElement('span');
    count.dataset.role = 'count';

    checkbox.addEventListener('change', () => {
      filterEnabled = checkbox.checked;
      GM_setValue(FEATURE_KEY, filterEnabled);
      applyFilter();
    });

    label.append(checkbox, text);
    control.append(label, count);
    document.body.appendChild(control);
  }

  function updatePage() {
    updateScheduled = false;
    createArchiveControl();
    createControl();
    applyFilter();
  }

  function scheduleUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(updatePage);
  }

  function init() {
    filterEnabled = Boolean(GM_getValue(FEATURE_KEY, false));
    injectStyle();
    updatePage();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const cleanName = (value) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 160) || 'unknown';

  function extractProduct(doc = document, pageUrl = location.href) {
    const id = new URL(pageUrl).pathname.match(/\/(?:[a-z]{2}\/)?items\/(\d+)/)?.[1];
    if (!id) throw new Error('商品IDを取得できません。');
    const text = (root, selector) => root.querySelector(selector)?.textContent.trim() || '';
    const title = text(doc, 'h2.item-name');
    const shopName = text(doc, '.shop-name-label') || text(doc, '.shop-name');
    const shopLink = doc.querySelector('.shop-name a[href]');
    const shopUrl = new URL(shopLink?.getAttribute('href') || '/', pageUrl).href;
    const shopId = new URL(shopUrl).hostname.split('.')[0];
    const images = Array.from(doc.querySelectorAll('img.market-item-detail-item-image[data-origin]'))
      .filter(img => !img.closest('.slick-cloned'))
      .map(img => img.getAttribute('data-origin'))
      .filter(url => {
        try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'booth.pximg.net' && u.pathname.includes('/i/' + id + '/'); }
        catch { return false; }
      });
    const variants = Array.from(doc.querySelectorAll('#variations .variation-item')).map(row => {
      const priceText = text(row, '.variation-price');
      return {
        id: row.querySelector('[data-product-variant]')?.getAttribute('data-product-variant') || null,
        name: text(row, '.variation-name .name') || text(row, '.variation-name'),
        priceText, price: Number(priceText.replace(/[^0-9]/g, '')) || null, currency: 'JPY',
        type: text(row, '.type'),
      };
    });
    const links = Array.from(doc.querySelectorAll('.booth-description a[href]')).map(a => ({
      label: a.textContent.trim() || a.querySelector('pixiv-icon')?.getAttribute('name') || a.href,
      url: a.getAttribute('href'),
    })).filter(link => /^https?:\/\//.test(link.url));
    const descriptionNode = doc.querySelector('#js-item-info-detail .main-info-column .description')
      || doc.querySelector('#js-item-info-detail .description');
    if (!title || !images.length) throw new Error('商品名または原画像を取得できません。');
    return {
      schemaVersion: 1, id, title, sourceUrl: pageUrl, archivedAt: new Date().toISOString(),
      shop: { id: shopId, name: shopName, url: shopUrl, links },
      variants, description: descriptionNode?.innerText || descriptionNode?.textContent || '',
      descriptionHtml: descriptionNode?.innerHTML || '', images: images.map(url => ({ url })),
    };
  }

  function imageBlob(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, responseType: 'blob', timeout: 60000,
      onload: r => r.status === 200 && r.response?.size && r.response.type.startsWith('image/')
        ? resolve(r.response) : reject(new Error('画像取得失敗: ' + r.status)),
      onerror: () => reject(new Error('画像通信エラー')),
      ontimeout: () => reject(new Error('画像取得タイムアウト')),
    }));
  }

  function imageExtension(url) {
    return new URL(url).pathname.match(/\.(png|jpe?g|gif|webp)$/i)?.[0] || '.jpg';
  }

  async function writeFile(dir, name, content) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    try { await writer.write(content); await writer.close(); }
    catch (error) { await writer.abort().catch(() => {}); throw error; }
  }

  let archiveRoot = null;
  function createArchiveControl() {
    if (!/\/(?:[a-z]{2}\/)?items\/\d+\/?$/.test(location.pathname)
      || document.getElementById('booth-archive-product-tools')) return;
    const title = document.querySelector('h2.item-name');
    if (!title) return;
    const panel = document.createElement('div');
    panel.id = 'booth-archive-product-tools';
    panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#fff;color:#222';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const buttons = [];
    function button(label, action) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:8px;border:1px solid #aaa;background:white;color:black;cursor:pointer';
      b.onclick = async () => {
        buttons.forEach(x => x.disabled = true);
        status.textContent = '処理中…';
        try { await action(); status.textContent = '完了'; }
        catch (error) { status.textContent = '失敗: ' + error.message; }
        finally { buttons.forEach(x => x.disabled = false); }
      };
      buttons.push(b); panel.append(b);
    }
    button('封面をダウンロード', async () => {
      const product = extractProduct();
      const blob = await imageBlob(product.images[0].url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = cleanName('BOOTH ' + product.shop.name + ' ' + product.title) + imageExtension(product.images[0].url);
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
    button('保存先フォルダーを選択', async () => {
      if (!window.showDirectoryPicker) throw new Error('ローカル保存にはChromeまたはEdgeをご利用ください。');
      archiveRoot = await window.showDirectoryPicker({ mode: 'readwrite', id: 'booth-archive' });
    });
    button('商品をローカル保存', async () => {
      if (!archiveRoot) throw new Error('先に保存先フォルダーを選択してください。');
      const product = extractProduct();
      const parent = await archiveRoot.getDirectoryHandle(product.id, { create: true });
      const dir = await parent.getDirectoryHandle(Date.now() + '-' + crypto.randomUUID(), { create: true });
      const prefix = cleanName(product.shop.id + '_' + product.id);
      await writeFile(dir, prefix + '_INCOMPLETE.json', JSON.stringify(product, null, 2));
      for (let i = 0; i < product.images.length; i++) {
        status.textContent = '画像保存 ' + (i + 1) + '/' + product.images.length;
        const entry = product.images[i];
        entry.file = prefix + '_' + String(i + 1).padStart(2, '0') + imageExtension(entry.url);
        await writeFile(dir, entry.file, await imageBlob(entry.url));
      }
      await writeFile(dir, prefix + '_description.txt', product.description);
      await writeFile(dir, prefix + '_product.json', JSON.stringify(product, null, 2));
      await writeFile(dir, prefix + '_COMPLETE.json', JSON.stringify({ schemaVersion: 1, product: prefix + '_product.json' }));
      await dir.removeEntry(prefix + '_INCOMPLETE.json');
    });
    panel.append(status);
    title.after(panel);
  }

  return {
    CARD_SELECTOR,
    extractProduct,
    cleanName,
    imageExtension,
    init,
    isUnavailableItem,
    parseItemData,
  };
});

