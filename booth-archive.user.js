// ==UserScript==
// @name         BOOTH Archive
// @namespace    https://github.com/uyuni-saline/booth-archive
// @version      0.1.0
// @description  Improve BOOTH and BOOTH shop pages with optional browsing tools.
// @author       uyuni-saline
// @match        https://booth.pm/*
// @match        https://*.booth.pm/*
// @icon         https://booth.pm/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
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
  const CARD_SELECTOR = 'li.js-mount-point-shop-item-card';
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

  return {
    init,
    isUnavailableItem,
    parseItemData,
  };
});
