'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isUnavailableItem, parseItemData } = require('../booth-archive.user.js');

function makeCard(item, textContent = '') {
  return {
    textContent,
    getAttribute(name) {
      if (name !== 'data-item' || item === null) return null;
      return typeof item === 'string' ? item : JSON.stringify(item);
    },
  };
}

test('detects an end-of-sale item from BOOTH data', () => {
  assert.equal(isUnavailableItem(makeCard({ is_end_of_sale: true, is_sold_out: false })), true);
});

test('detects a sold-out item from BOOTH data', () => {
  assert.equal(isUnavailableItem(makeCard({ is_end_of_sale: false, is_sold_out: true })), true);
});

test('keeps an available item visible', () => {
  assert.equal(isUnavailableItem(makeCard({ is_end_of_sale: false, is_sold_out: false })), false);
});

test('falls back to visible status labels', () => {
  assert.equal(isUnavailableItem(makeCard(null, '商品名 在庫なし')), true);
  assert.equal(isUnavailableItem(makeCard(null, '商品名 販売終了')), true);
});

test('handles malformed item data without throwing', () => {
  assert.equal(parseItemData(makeCard('{broken-json')), null);
  assert.equal(isUnavailableItem(makeCard('{broken-json', '販売中')), false);
});
