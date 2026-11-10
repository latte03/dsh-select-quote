# dsh-select-quote · [English](README.en.md)

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
- **标记与摘要**：正文留底色与角标，输入框上方的批注卡可编辑、删除、跳回，发送后清除；只有一条批注时卡上直接显示引文与评论，两条起才数「N 条批注」
- **只发批注**：有批注时输入框空着也能直接发，消息只带批注、不带正文
- **侧边子代理**：就某段原文单独追问，不打断主会话，可独立选模型，也可复用同一个
- **八种界面语言**：简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## 使用

**安装**：`dsh plugin --profile web add dsh-select-quote`，再 `dsh --profile web`。桌面版在应用内输入包名安装后重启。

**批注**：选中文字点「批注」即保存，`Enter` 或 `⌘/Ctrl + Enter` 提交、`Shift + Enter` 换行；点批注卡可编辑或跳回；下拉挑会话后「放入」或「放入并前往」。有批注时输入框空着也能直接发送，消息只带批注。

**设置**：插件页 → `dsh-select-quote`，配置分五个 tab（入口 / 按钮 / 翻译 / 侧边提问 / 快捷键），每项自带说明，记住上次那一组。**至少留一枚按钮**——全部关掉工具条就空了，最后一个开关会拒绝关闭并给出提示。

**快捷键**见 [`docs/internals.md`](docs/internals.md) 的机制 15（应用内「设置 → 快捷键」显示的是实际生效键位）；**限制与已知问题**见 [`docs/limitations.md`](docs/limitations.md)；开发命令与内部约定同样在 `docs/internals.md`。

## License

[MIT](LICENSE) © 2026 agan · 致谢 [@imallakov](https://github.com/imallakov)（多语言与跨平台构建）、[@Ladersbt](https://github.com/Ladersbt)、[@EliteOtaku](https://github.com/EliteOtaku)。
