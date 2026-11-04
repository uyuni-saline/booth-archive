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
- 存档设置：选择、更换或重新授权本地存档目录。也可从油猴菜单打开“BOOTH存档设置”。
- 本地存档：保存全部商品原图及信息。成功后按钮显示为灰色“已存档”；仍可点击创建新的快照。

## 长期记忆存档目录

需要支持File System Access API的Chrome或Edge。目录句柄保存在当前网站的IndexedDB中，刷新和重启浏览器后可恢复，不必每次重新选择目录。浏览器仍可能要求再次授予写入权限；此时请在设置中点击“重新授权目录”。

由于浏览器按来源隔离权限，不同商店子域名需要分别选择目录，可以选择同一个本地根目录。清除网站数据、使用无痕窗口或更换浏览器会影响目录记忆。目录句柄不会上传或保存在GitHub。

## 存档结构

每次保存建立独立快照：商品ID/时间戳-随机UUID/。同一商品再次保存不会覆盖旧快照，不进行图片内容或跨商品排重；轮播克隆节点不作为独立商品图片。

每个快照只有一个信息JSON，名称为“商店识别符_商品ID_product.json”，图片名称为“商店识别符_商品ID_序号.扩展名”。

JSON包括：

- 商品ID、名称、来源地址、存档时间及完成状态。
- 种类分支名称、分支ID、对应价格、币种和商品类型。
- 商店名称、识别符、主页和简介中的全部链接。
- 商品描述的文本及原始HTML（仅作数据保存，不执行）。
- 每张图片的原图URL、file文件名及relativePath相对路径。
- archiveRelativePath：快照目录相对于用户所选根目录的路径。

图片relativePath以同目录的JSON为基准，例如“./wlabel_9021875_01.png”。schemaVersion为2，status为complete。所有图片写入成功后，才会写入最终JSON并记录“已存档”状态。失败或中途关闭页面可能留下没有有效JSON的图片目录，不视为完成。

“已存档”记忆保存在Tampermonkey中，以商品ID区分，在当前浏览器的商店页面间共用。它表示曾经成功存档，不会自动检查用户后来删除或移动的本地文件，也不会自动导入旧目录。更换目录不会清除历史记忆。旧版已生成的多文件快照不会自动改写。

## 开发与验证

Node.js 18及以上，无需构建即可安装脚本。

```bash
npm test
npm run check
```

test/archive-snapshot.cjs为附件样本的浏览器回归检查，需额外安装Playwright和Chromium，并将MHTML主HTML解码后通过标准输入传入。默认单元测试不依赖浏览器。目录授权、图片下载及油猴沙箱兼容性仍需在实际浏览器验证。
