# BOOTH Archive

用于BOOTH主站及商店子页面的Tampermonkey脚本，提供商品筛选、封面下载和本地商品存档。

## 安装与更新

1. 安装[Tampermonkey](https://www.tampermonkey.net/)。
2. 打开[安装脚本](https://raw.githubusercontent.com/uyuni-saline/booth-archive/main/booth-archive.user.js)，确认安装。
3. 后续可通过Tampermonkey检查更新。

## 商品筛选

在商店商品列表及关注新商品页面（包括accounts.booth.pm/dashboard?page=2等分页），右下角提供“隐藏销售结束／无库存商品”开关，自动记忆状态并处理动态加载。

优先读取商品卡片中的is_end_of_sale和is_sold_out，文字后备检测使用BOOTH原文「販売終了」「在庫なし」。

## 商品页操作

在/items/商品ID和/ja/items/商品ID页面，右下角固定显示存档工具，位于筛选开关上方。

- 下载封面：以“BOOTH 商店名 商品名.扩展名”命名，保存位置遵循浏览器下载设置。
- 存档设置：指定默认下载目录中的存档子文件夹名（默认为“BOOTH存档”）。也可从油猴菜单打开“BOOTH存档设置”。
- 本地存档：保存全部商品原图及信息。成功后按钮显示为灰色“已存档”；仍可点击创建新的快照。

## 批量下载配置

v0.5.0起不再使用本地目录句柄及网站IndexedDB。改用GM_download，将图片和JSON批量下载到默认下载目录中的子文件夹，不需要逐个商店授权本地目录。

请在Tampermonkey设置中启用“浏览器API”下载模式，授予下载权限，并允许json及所需图片扩展名。建议关闭浏览器“下载前询问保存位置”。若浏览器提示允许多个文件下载，请允许。子目录组织依赖浏览器下载API，不支持时会报告失败，不静默改为平铺下载。

设置和已存档记录使用GM_getValue/GM_setValue保存到油猴扩展存储，跨BOOTH域名共用，无需网站IndexedDB。清除油猴数据或卸载脚本可能丢失记忆。旧目录句柄不再使用，不会主动删除旧存档或旧网站数据库。

同一商品的booth.pm/ja/items/9021875与wlabel.booth.pm/items/9021875共用ID及已存档状态。商店标识优先读取页面data-product-brand，避免把主站域名当成作者标识。不同ID仍视为不同商品。JSON同时记录实际访问地址sourceUrl与统一主站地址canonicalUrl。

## 存档结构

每次保存建立独立快照：默认下载目录/BOOTH存档/商品ID/时间戳-随机UUID/。同一商品再次保存不会覆盖旧快照，不进行图片内容或跨商品排重；轮播克隆节点不作为独立商品图片。

每个快照只有一个信息JSON，名称为“商店识别符_商品ID_product.json”，图片名称为“商店识别符_商品ID_序号.扩展名”。

JSON包括：

- 商品ID、名称、来源地址、存档时间及完成状态。
- 种类分支名称、分支ID、对应价格、币种和商品类型。
- 商店名称、识别符、主页和简介中的全部链接。
- 商品描述的文本及原始HTML（仅作数据保存，不执行）。
- 每张图片的原图URL、file文件名及relativePath相对路径。
- archiveRelativePath：快照目录相对于浏览器默认下载目录的路径。

图片relativePath以同目录的JSON为基准，例如“./wlabel_9021875_01.png”。schemaVersion为3，status为complete。逐张等待图片下载完成后，再下载最终JSON；全部完成后才更新“已存档”记忆。任何一步失败或取消均不新增完成记录。关闭页面可能留下部分下载；旧有完成记录不会因重存失败被清除。

“已存档”记忆保存在Tampermonkey中，以商品ID区分，在当前浏览器的商店页面间共用。它表示曾经成功存档，不会自动检查用户后来删除或移动的本地文件，也不会自动导入旧目录。更换目录不会清除历史记忆。旧版已生成的多文件快照不会自动改写。

## 开发与验证

Node.js 18及以上，无需构建即可安装脚本。

```bash
npm test
npm run check
```

test/archive-snapshot.cjs为附件样本的浏览器回归检查，需额外安装Playwright和Chromium，并将MHTML主HTML解码后通过标准输入传入。默认单元测试不依赖浏览器。批量下载、子目录及油猴沙箱兼容性仍需在实际浏览器验证。
