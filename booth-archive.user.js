// ==UserScript==
// @name         BOOTH Archive
// @namespace    https://github.com/uyuni-saline/booth-archive
// @version      0.6.0
// @description  BOOTH商品筛选、封面下载与本地存档工具。
// @author       uyuni-saline
// @match        https://booth.pm/*
// @match        https://*.booth.pm/*
// @icon         https://booth.pm/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_download
// @grant        GM_info
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
    filterEnabled = Boolean(GM_getValue(FEATURE_KEY, false));
    injectStyle();
    updatePage();

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  const cleanName = (value) => value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 160) || 'unknown';

  function productId(url) {
    return new URL(url).pathname.match(/^\/(?:[a-z]{2}\/)?items\/(\d+)\/?$/)?.[1] || null;
  }

  function resolveShop(doc, pageUrl) {
    const candidates = [
      doc.querySelector('[data-product-brand]')?.getAttribute('data-product-brand'),
      ...Array.from(doc.querySelectorAll('.shop-name a[href], .booth-title a[href], .shop-name-label a[href]'))
        .map(a => { try { return new URL(a.getAttribute('href'), pageUrl).hostname.split('.')[0]; } catch { return null; } }),
      new URL(pageUrl).hostname.endsWith('.booth.pm') ? new URL(pageUrl).hostname.split('.')[0] : null,
    ];
    const id = candidates.find(value => value && /^[a-z0-9_-]+$/i.test(value) && !['booth', 'www', 'accounts'].includes(value));
    if (!id) throw new Error('无法识别商店，请从商店子域名打开商品后重试。');
    return { id, url: 'https://' + id + '.booth.pm/' };
  }

  function extractProduct(doc = document, pageUrl = location.href) {
    const id = productId(pageUrl);
    if (!id) throw new Error('无法取得商品ID。');
    const text = (root, selector) => root.querySelector(selector)?.textContent.trim() || '';
    const shopName = text(doc, '.shop-name-label') || text(doc, '.shop-name') || text(doc, '.booth-title');
    const metaTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const suffix = ' - ' + shopName + ' - BOOTH';
    const title = text(doc, '#js-item-info-detail .summary header h2')
      || text(doc, '#js-item-info-detail h1')
      || (shopName && metaTitle.endsWith(suffix) ? metaTitle.slice(0, -suffix.length) : '');
    const { id: shopId, url: shopUrl } = resolveShop(doc, pageUrl);
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
      schemaVersion: 3, id, title, canonicalUrl: 'https://booth.pm/ja/items/' + id, sourceUrl: pageUrl, archivedAt: new Date().toISOString(),
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

  function downloadFile(url, name) {
    return new Promise((resolve, reject) => GM_download({
      url, name, saveAs: false, conflictAction: 'overwrite',
      onload: resolve,
      onerror: error => reject(new Error('下载失败：' + (error.error || error.details || '未知错误') + '；请检查油猴下载权限及扩展名白名单。')),
      ontimeout: () => reject(new Error('下载超时')),
    }));
  }

  function requireDownloadMode() {
    if (typeof GM_info !== 'undefined' && GM_info.downloadMode !== 'browser') {
      throw new Error('请在Tampermonkey设置中将下载模式设为“浏览器API”，并允许下载权限。');
    }
  }

  function listArchiveRecords() {
    return GM_listValues().filter(key => /^archived-product:\d+$/.test(key)).map(key => ({
      ...GM_getValue(key, {}), id: key.slice('archived-product:'.length),
    }));
  }

  function parseRecordBackup(value) {
    if (!value || value.format !== 'booth-archive-records' || value.version !== 1 || !Array.isArray(value.records)) {
      throw new Error('不是受支持的BOOTH存档记录备份文件。');
    }
    const seen = new Set();
    return value.records.map(record => {
      if (!record || typeof record.id !== 'string' || !/^\d+$/.test(record.id)
        || typeof record.archivedAt !== 'string' || !Number.isFinite(Date.parse(record.archivedAt))
        || typeof record.relativePath !== 'string' || seen.has(record.id)) {
        throw new Error('备份包含无效或重复记录，未导入任何内容。');
      }
      seen.add(record.id);
      return { id: record.id, archivedAt: record.archivedAt, relativePath: record.relativePath };
    });
  }

  function importArchiveRecords(backup) {
    const records = parseRecordBackup(backup); // Validate everything before writing.
    let added = 0;
    for (const { id, ...record } of records) {
      if (!GM_getValue(archiveMemoryKey(id), null)) {
        GM_setValue(archiveMemoryKey(id), record);
        added++;
      }
    }
    return { added, skipped: records.length - added };
  }

  function clearArchiveRecords() {
    const keys = GM_listValues().filter(key => /^archived-product:\d+$/.test(key));
    keys.forEach(key => GM_deleteValue(key));
    return keys.length;
  }

  function refreshCurrentArchiveButton() {
    const id = productId(location.href);
    const button = document.getElementById('booth-archive-save-product');
    if (button && id) refreshArchiveButton(button, id);
  }

  function openSettings() {
    if (document.getElementById('booth-archive-settings-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'booth-archive-settings-dialog';
    dialog.style.cssText = 'max-width:480px;padding:24px;color:#222;background:white;border:1px solid #aaa;border-radius:8px';
    const heading = document.createElement('h2'); heading.textContent = 'BOOTH存档设置';
    const help = document.createElement('p');
    help.textContent = '文件批量下载至浏览器默认下载目录，无需商店目录授权。请将油猴下载模式设为“浏览器API”，允许下载权限及json、图片扩展名。关闭浏览器的“下载前询问保存位置”以避免逐文件询问。';
    const label = document.createElement('label'); label.textContent = '下载目录内的存档文件夹名：';
    const input = document.createElement('input');
    input.value = GM_getValue('downloadFolder', 'BOOTH存档');
    label.append(input);
    const info = document.createElement('p');
    const save = document.createElement('button'); save.textContent = '保存设置';
    save.onclick = () => {
      GM_setValue('downloadFolder', cleanName(input.value.trim()));
      info.textContent = '设置已保存，在所有商店共用。';
    };
    const recordsHelp = document.createElement('p');
    recordsHelp.textContent = '存档记录管理：当前共' + listArchiveRecords().length + '条。仅管理已存档标记，不包含图片和商品JSON，也不会删除下载文件。导入采用合并方式，已有商品记录保持不变。';
    const exportButton = document.createElement('button'); exportButton.textContent = '导出存档记录';
    exportButton.onclick = async () => {
      exportButton.disabled = true;
      let url;
      try {
        requireDownloadMode();
        const backup = { format: 'booth-archive-records', version: 1, exportedAt: new Date().toISOString(), records: listArchiveRecords() };
        url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
        await downloadFile(url, 'BOOTH存档记录_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
        info.textContent = '已导出' + backup.records.length + '条记录。';
      } catch (error) { info.textContent = '导出失败：' + error.message; }
      finally { if (url) URL.revokeObjectURL(url); exportButton.disabled = false; }
    };
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.hidden = true;
    const importButton = document.createElement('button'); importButton.textContent = '导入存档记录';
    importButton.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      importButton.disabled = true;
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error('备份文件超过10MB限制。');
        const result = importArchiveRecords(JSON.parse(await file.text()));
        refreshCurrentArchiveButton();
        recordsHelp.textContent = '当前共有' + listArchiveRecords().length + '条存档记录（仅标记，不含本地文件）。';
        info.textContent = '导入完成：新增' + result.added + '条，保留已有记录' + result.skipped + '条。';
      } catch (error) { info.textContent = '导入失败：' + error.message; }
      finally { fileInput.value = ''; importButton.disabled = false; }
    };
    const clearButton = document.createElement('button'); clearButton.textContent = '清除存档记录';
    clearButton.onclick = () => {
      if (!window.confirm('确定清除全部已存档标记？建议先导出备份。此操作不会删除图片、商品JSON或插件设置。')) return;
      try {
        const count = clearArchiveRecords();
        refreshCurrentArchiveButton();
        recordsHelp.textContent = '当前共有0条存档记录（仅标记，不含本地文件）。';
        info.textContent = '已清除' + count + '条记录，下载文件未改动。';
      } catch (error) { info.textContent = '清除失败：' + error.message; }
    };
    const close = document.createElement('button'); close.textContent = '关闭';
    close.onclick = () => { dialog.close(); dialog.remove(); };
    dialog.addEventListener('cancel', () => dialog.remove());
    dialog.append(heading, help, label, save, recordsHelp, exportButton, importButton, fileInput, clearButton, info, close);
    document.body.appendChild(dialog); dialog.showModal();
  }

  function archiveMemoryKey(id) { return 'archived-product:' + id; }
  function refreshArchiveButton(button, id) {
    const archived = Boolean(GM_getValue(archiveMemoryKey(id), null));
    button.textContent = archived ? '已存档' : '本地存档';
    button.style.background = archived ? '#ddd' : '#fff';
    button.style.color = archived ? '#777' : '#000';
    button.title = archived ? '此商品已有完成存档记录，点击可更新并覆盖同名文件' : '将商品信息和图片保存到本地目录';
  }

  async function saveProduct(product, download = downloadFile, remember = GM_setValue, progress = () => {}, folder = 'BOOTH存档') {
    const directory = cleanName(folder) + '/' + product.id + '/';
    const prefix = cleanName(product.shop.id + '_' + product.id);
    for (let i = 0; i < product.images.length; i++) {
      progress(i + 1, product.images.length);
      const entry = product.images[i];
      entry.file = prefix + '_' + String(i + 1).padStart(2, '0') + imageExtension(entry.url);
      entry.relativePath = './' + entry.file;
      await download(entry.url, directory + entry.file);
    }
    product.status = 'complete';
    product.archiveRelativePath = directory;
    const jsonUrl = URL.createObjectURL(new Blob([JSON.stringify(product, null, 2)], { type: 'application/json' }));
    try { await download(jsonUrl, directory + prefix + '_product.json'); }
    finally { URL.revokeObjectURL(jsonUrl); }
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
      requireDownloadMode();
      const product = extractProduct();
      await saveProduct(product, downloadFile, GM_setValue,
        (index, count) => { status.textContent = '正在下载图片 ' + index + '/' + count; }, GM_getValue('downloadFolder', 'BOOTH存档'));
      refreshArchiveButton(archiveButton, product.id);
    });
    archiveButton.id = 'booth-archive-save-product';
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
    productId,
    resolveShop,
    downloadFile,
    listArchiveRecords,
    parseRecordBackup,
    importArchiveRecords,
    clearArchiveRecords,
    init,
    isUnavailableItem,
    parseItemData,
  };
});

