# BOOTH Archive

BOOTH及び各ショップのページを見やすくし、商品情報の整理・保存を支援するTampermonkeyユーザースクリプトです。

## 現在の機能

- ショップの商品一覧に「販売終了・在庫なしを隠す」スイッチを追加
- スイッチの状態をブラウザに保存
- BOOTHが後から追加した商品にもフィルターを自動適用

判定には商品カードの`data-item`に含まれる`is_end_of_sale`及び`is_sold_out`を使用し、互換性のため画面上の「販売終了」「在庫なし」という表示も確認します。

## インストール

1. ブラウザに[Tampermonkey](https://www.tampermonkey.net/)をインストールします。
2. [booth-archive.user.js](https://raw.githubusercontent.com/uyuni-saline/booth-archive/main/booth-archive.user.js)を開きます。
3. Tampermonkeyの確認画面でインストールします。

スクリプト更新時は、Tampermonkeyの更新確認機能から最新版を取得できます。

## 対応ページ

- `https://booth.pm/*`
- `https://*.booth.pm/*`

商品一覧が存在するページでのみフィルタースイッチを表示します。

## 開発

Node.js 18以降で次の確認を実行できます。

```bash
npm test
npm run check
```
