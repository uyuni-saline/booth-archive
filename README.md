# BOOTH Archive

BOOTH及び各ショップのページを見やすくし、商品情報の整理・保存を支援するTampermonkeyユーザースクリプトです。

## 現在の機能

- ショップの商品一覧に「販売終了・在庫なしを隠す」スイッチを追加
- フォロー新着商品（`accounts.booth.pm/dashboard`）とその各ページに同じスイッチを追加
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
- `https://accounts.booth.pm/dashboard?page=2`などのフォロー新着商品一覧

商品一覧が存在するページでのみフィルタースイッチを表示します。

## 開発

## 商品存档（v0.3.0）

v0.3.1修复：将工具栏放入商品详情容器顶部，并从详情区标题读取商品名，避免错误选中推荐商品的item-name标题。

在items商品页的商品名下方提供「封面をダウンロード」「保存先フォルダーを選択」「商品をローカル保存」。

- 封面以「BOOTH 商店名 商品名.原扩展名」交给浏览器下载。默认位置遵循浏览器下载设置；若启用“每次询问保存位置”，仍会询问。
- 本地目录存档需要支持File System Access API的Chrome或Edge。每次打开页面后先选择目录，再保存商品；不上传数据。
- 目录格式为「商品ID/时间戳-随机UUID/」。图片和元数据文件名前缀为「商店子域名_商品ID」。每次建立独立快照，不覆盖旧存档，不做图片内容排重。轮播克隆节点不作为独立商品图片。
- JSON保存商品名、来源、分支名称和价格、商店名和所有商店简介外链、商品描述及原图URL和本地文件名。描述同时保存为文本；JSON中的HTML仅作原始数据，不执行。
- 只有带「COMPLETE.json」后缀标记的快照才算保存成功。「INCOMPLETE.json」代表未完成；请保留页面打开直至提示完成，失败可重新保存为新快照。
- 本版本是以每个商品JSON为记录的本地文件数据库，尚无库存浏览器或全库索引；可直接查看JSON和图片。未验证Firefox及Safari。

样本浏览器回归脚本为test/archive-snapshot.cjs，需要另外安装Playwright及Chromium，并将从MHTML解码得到的主HTML通过stdin输入。该脚本不包含在默认无依赖单元测试中。

Node.js 18以降で次の確認を実行できます。

```bash
npm test
npm run check
```

