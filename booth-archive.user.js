// ==UserScript==
// @name         BOOTH Archive
// @namespace    https://github.com/uyuni-saline/booth-archive
// @version      0.4.0
// @description  BOOTH商品筛选、封面下载与本地存档工具。
// @author       uyuni-saline
// @match        https://booth.pm/*
// @match        https://*.booth.pm/*
// @icon         https://booth.pm/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
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
      console.warn('[BOOTH存档] 无法解析商品数据。', error);
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
      const nextText = filterEnabled ? `已隐藏：${hiddenCount}` : '';
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

      #booth-archive-dock {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        max-width: calc(100vw - 36px);
        max-height: calc(100dvh - 36px);
        overflow: auto;
      }

      #${CONTROL_ID} {
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
    checkbox.setAttribute('aria-label', '隐藏销售结束或无库存商品');

    const text = document.createElement('span');
    text.textContent = '隐藏销售结束／无库存商品';

    const count = document.createElement('span');
    count.dataset.role = 'count';

    checkbox.addEventListener('change', () => {
      filterEnabled = checkbox.checked;
      GM_setValue(FEATURE_KEY, filterEnabled);
      applyFilter();
    });

    label.append(checkbox, text);
    control.append(label, count);
    getDock().append(control);
  }

  function getDock() {
    let dock = document.getElementById('booth-archive-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'booth-archive-dock';
      document.body.appendChild(dock);
    }
    return dock;
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
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('BOOTH存档设置', openSettings);
    if (typeof indexedDB !== 'undefined') restoreDirectory().catch(error => console.warn('[BOOTH存档] 无法恢复目录设置', error));
    filterEnabled = Boolean(GM_getValue(FEATURE_KEY, false));
    injectStyle();
    updatePage();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const cleanName = (value) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 160) || 'unknown';

  function extractProduct(doc = document, pageUrl = location.href) {
    const id = new URL(pageUrl).pathname.match(/\/(?:[a-z]{2}\/)?items\/(\d+)/)?.[1];
    if (!id) throw new Error('无法取得商品ID。');
    const text = (root, selector) => root.querySelector(selector)?.textContent.trim() || '';
    const title = text(doc, '#js-item-info-detail .summary header h2');
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
    if (!title || !images.length) throw new Error('无法取得商品名称或原图。');
    return {
      schemaVersion: 2, id, title, sourceUrl: pageUrl, archivedAt: new Date().toISOString(),
      shop: { id: shopId, name: shopName, url: shopUrl, links },
      variants, description: descriptionNode?.innerText || descriptionNode?.textContent || '',
      descriptionHtml: descriptionNode?.innerHTML || '', images: images.map(url => ({ url })),
    };
  }

  function imageBlob(url) {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url, responseType: 'blob', timeout: 60000,
      onload: r => r.status === 200 && r.response?.size && r.response.type.startsWith('image/')
        ? resolve(r.response) : reject(new Error('图片获取失败：' + r.status)),
      onerror: () => reject(new Error('图片网络请求失败')),
      ontimeout: () => reject(new Error('图片获取超时')),
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
  // Directory handles are structured-cloneable, not JSON serializable.
  function directoryStore(mode, action) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('booth-archive-settings', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('settings');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', mode);
        let result;
        try {
          const operation = action(tx.objectStore('settings'));
          operation.onsuccess = () => { result = operation.result; };
        } catch (error) { db.close(); reject(error); return; }
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('目录设置保存失败')); };
      };
    });
  }

  async function selectDirectory() {
    if (!window.showDirectoryPicker) throw new Error('本地存档需要Chrome或Edge浏览器。');
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'booth-archive' });
    await directoryStore('readwrite', store => store.put(handle, 'directory'));
    archiveRoot = handle;
    return handle;
  }

  async function restoreDirectory() {
    archiveRoot = archiveRoot || await directoryStore('readonly', store => store.get('directory'));
    return archiveRoot;
  }

  async function requireDirectory() {
    const handle = await restoreDirectory();
    if (!handle) throw new Error('请先在存档设置中选择本地目录。');
    if (await handle.queryPermission({ mode: 'readwrite' }) !== 'granted'
      && await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      throw new Error('未获得目录写入权限，请在设置中重新授权或选择目录。');
    }
    return handle;
  }

  function openSettings() {
    if (document.getElementById('booth-archive-settings-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'booth-archive-settings-dialog';
    dialog.style.cssText = 'max-width:480px;padding:24px;color:#222;background:white;border:1px solid #aaa;border-radius:8px';
    const heading = document.createElement('h2'); heading.textContent = 'BOOTH存档设置';
    const help = document.createElement('p');
    help.textContent = '目录选择会在当前商店长期记忆。浏览器可能要求重新授权；不同商店子域名需要分别选择同一目录。清除网站数据会清除目录记忆。';
    const info = document.createElement('p'); info.textContent = '正在读取目录设置…';
    const choose = document.createElement('button'); choose.textContent = '选择／更换本地存档目录';
    choose.onclick = async () => {
      try { info.textContent = '已记住目录：' + (await selectDirectory()).name; }
      catch (error) { info.textContent = '选择失败：' + error.message; }
    };
    const authorize = document.createElement('button'); authorize.textContent = '重新授权目录';
    authorize.onclick = async () => {
      try { info.textContent = '目录已授权：' + (await requireDirectory()).name; }
      catch (error) { info.textContent = error.message; }
    };
    const close = document.createElement('button'); close.textContent = '关闭';
    close.onclick = () => { dialog.close(); dialog.remove(); };
    dialog.addEventListener('cancel', () => dialog.remove());
    dialog.append(heading, help, info, choose, authorize, close);
    document.body.appendChild(dialog); dialog.showModal();
    restoreDirectory().then(handle => { info.textContent = handle ? '已记住目录：' + handle.name : '尚未选择目录'; })
      .catch(error => { info.textContent = '无法读取设置：' + error.message; });
  }

  function archiveMemoryKey(id) { return 'archived-product:' + id; }
  function refreshArchiveButton(button, id) {
    const archived = Boolean(GM_getValue(archiveMemoryKey(id), null));
    button.textContent = archived ? '已存档' : '本地存档';
    button.style.background = archived ? '#ddd' : '#fff';
    button.style.color = archived ? '#777' : '#000';
    button.title = archived ? '此商品已有完成存档记录，点击可再次存档' : '将商品信息和图片保存到本地目录';
  }

  async function saveProduct(root, product, fetchImage = imageBlob, remember = GM_setValue, progress = () => {}) {
    const parent = await root.getDirectoryHandle(product.id, { create: true });
    const snapshot = Date.now() + '-' + crypto.randomUUID();
    const dir = await parent.getDirectoryHandle(snapshot, { create: true });
    const prefix = cleanName(product.shop.id + '_' + product.id);
    for (let i = 0; i < product.images.length; i++) {
      progress(i + 1, product.images.length);
      const entry = product.images[i];
      entry.file = prefix + '_' + String(i + 1).padStart(2, '0') + imageExtension(entry.url);
      entry.relativePath = './' + entry.file;
      await writeFile(dir, entry.file, await fetchImage(entry.url));
    }
    product.status = 'complete';
    product.archiveRelativePath = product.id + '/' + snapshot + '/';
    await writeFile(dir, prefix + '_product.json', JSON.stringify(product, null, 2));
    remember(archiveMemoryKey(product.id), {
      archivedAt: product.archivedAt,
      relativePath: product.archiveRelativePath + prefix + '_product.json',
    });
    return product;
  }
  function createArchiveControl() {
    if (!/\/(?:[a-z]{2}\/)?items\/\d+\/?$/.test(location.pathname)
      || document.getElementById('booth-archive-product-tools')) return;
    const panel = document.createElement('div');
    panel.id = 'booth-archive-product-tools';
    panel.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-width:100%;padding:12px;background:#fff;color:#222;border:1px solid #d7d7d7;border-radius:8px;box-shadow:0 3px 12px #0002;font:14px/1.4 sans-serif';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    const buttons = [];
    function button(label, action) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'padding:8px;border:1px solid #aaa;background:white;color:black;cursor:pointer';
      b.onclick = async () => {
        buttons.forEach(x => x.disabled = true);
        status.textContent = '处理中…';
        try { await action(); status.textContent = '完成'; }
        catch (error) { status.textContent = '失败：' + error.message; }
        finally { buttons.forEach(x => x.disabled = false); }
      };
      buttons.push(b); panel.append(b);
      return b;
    }
    button('下载封面', async () => {
      const product = extractProduct();
      const blob = await imageBlob(product.images[0].url);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = cleanName('BOOTH ' + product.shop.name + ' ' + product.title) + imageExtension(product.images[0].url);
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
    button('存档设置', openSettings);
    const archiveButton = button('本地存档', async () => {
      const root = await requireDirectory();
      const product = extractProduct();
      await saveProduct(root, product, imageBlob, GM_setValue,
        (index, count) => { status.textContent = '正在保存图片 ' + index + '/' + count; });
      refreshArchiveButton(archiveButton, product.id);
    });
    refreshArchiveButton(archiveButton, location.pathname.match(/items\/(\d+)/)[1]);
    panel.append(status);
    getDock().prepend(panel);
  }

  return {
    CARD_SELECTOR,
    extractProduct,
    cleanName,
    imageExtension,
    archiveMemoryKey,
    refreshArchiveButton,
    saveProduct,
    directoryStore,
    init,
    isUnavailableItem,
    parseItemData,
  };
});

