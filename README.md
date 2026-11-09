# dsh-select-quote

简体中文 | [English](README.en.md)

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 客户端插件：划词批注与引用、就地翻译、侧边子代理提问。选中的原文连同评论随下一条消息交给模型，正文留下高亮与角标、可跳回原文。

[![开放插件市场](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-select-quote.json)](https://dshopen.org/zh/plugins/dsh-select-quote/)
[![awesome-dsh-plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/)
[![npm monthly downloads](https://img.shields.io/npm/dm/dsh-select-quote)](https://www.npmjs.com/package/dsh-select-quote)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.2--rc.1-blue)](package.json)

![dsh-select-quote](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/hero.png)

## 功能

- **划词工具条**：对话正文与右侧文件预览都可划词，浮出「打开链接 / 复制 / 翻译 / 批注 / 在侧边提问」
- **就地翻译**：译文在选区旁流式出现，目标语言默认跟随界面语言，可一键复制；同原文同设置复用缓存
- **批注与放入**：「批注 当前会话」是主键，右侧下拉送其他会话；源留箭头角标，目标显示「来自：<会话>」，可双向跳回
- **标记与摘要**：正文留底色与角标，输入框上方「N 条批注」可编辑、删除、跳回，发送后清除
- **侧边子代理**：就某段原文单独追问，不打断主会话，可独立选模型，也可复用同一个
- **八种界面语言**：简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## 安装

网页版：

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

桌面版在应用内输入 `dsh-select-quote` 安装后重启客户端；本地开发见 [`dev.patch.example.yml`](dev.patch.example.yml)。

## 用法

选中文字点「批注」即保存，`Enter` 或 `⌘/Ctrl + Enter` 提交、`Shift + Enter` 换行；点「N 条批注」可编辑或跳回。下拉挑好会话后「放入」留在本页、「放入并前往」打开目标。

| 操作 | 桌面 macOS | 桌面 Win/Linux | Web macOS | Web Windows | Web Linux |
|---|---|---|---|---|---|
| 打开划词菜单 | `⌘L` | `Ctrl+Shift+L` | `⇧⌘L` | `Ctrl+Shift+L` | `Ctrl+Shift+,` |
| 批注 | `⇧⌘L` | `Ctrl+Shift+.` | `⌥⌘L` | `Ctrl+Shift+.` | `Ctrl+Shift+.` |

## 设置

插件页 → `dsh-select-quote`，配置显示在插件外层页面：

- **划词入口与位置**：自动浮出 / 右键菜单 / 两者都开；浮层在上方或下方，放不下自动翻面
- **划词按钮**：显示或隐藏「批注」（含箭头与放入目标）、「复制」、「翻译」、「在侧边提问」；**至少留一个**，最后一个开关会拒绝关闭并给出提示
- **并入宿主浮层**：按钮放进官方划词浮层，原文旁不再另起一条（默认关闭）
- **侧边子代理**：每次独立（默认）/ 复用同一个
- **翻译**：目标语言、同语言隐藏、独立模型、自定义提示词（`{target}` 替换为目标语言）

## 已知限制

- 未发送的批注保留最近 20 个会话 / 7 天，发送即清除，分叉会话不继承
- 「放入其他会话」依赖宿主的工作区与 `openSession`，旧版本自动隐藏入口
- 批注卡挂在 `conversation.chat.user.before` 席位，不接管用户气泡；需要 dsh ≥ 0.2.2-rc.1
- 划词只在对话正文与文件预览生效，文件树、编辑器、终端不介入
- 翻译只发选区，不带会话上下文，约 6000 字、超时 90 秒

## 开发

```bash
pnpm run check     # typecheck + test + build + verify，提交前必跑
pnpm run sync:web  # 推到已安装副本，桌面版用 sync:desktop
pnpm run release   # 版本号 + tag
```

`lib/` 随源码提交、运行时直读；发布用 `npm publish` 后同步 npmmirror。机制与排错见 [`docs/internals.md`](docs/internals.md)。

## 致谢

[@imallakov](https://github.com/imallakov)（多语言与跨平台构建）、[@Ladersbt](https://github.com/Ladersbt)、[@EliteOtaku](https://github.com/EliteOtaku)。

## License

[MIT](LICENSE) © 2026 agan
