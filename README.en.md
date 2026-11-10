# dsh-select-quote · [简体中文](README.md)

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) client plugin: selection annotations and quotes, in-place translation, and sidebar subagent questions. The selected text and your comment ride along with the next message; the text keeps its highlight and ordinal mark for jumping back.

[![DSH Open Plugins](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-select-quote.json)](https://dshopen.org/zh/plugins/dsh-select-quote/)
[![awesome-dsh-plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/)
[![npm monthly downloads](https://img.shields.io/npm/dm/dsh-select-quote)](https://www.npmjs.com/package/dsh-select-quote)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.2--rc.1-blue)](package.json)

![dsh-select-quote](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/hero.png)

## Features

- **Selection toolbar**: select text in the conversation or in a Sidebar file preview to get **Open link / Copy / Translate / Annotate / Ask in sidebar**
- **In-place translation**: streams next to the selection; the target follows the UI language by default and the result copies in one click, with per-session cache reuse
- **Annotate and send**: **Annotate this conversation** is the main button, its chevron sends the passage elsewhere; the source keeps an arrow mark, the target shows "From: <session>", and both sides jump back
- **Marks and summary**: annotated text keeps a tint and an ordinal mark; the card above the composer edits, deletes, or jumps back, and clears on send. A lone annotation shows its quote and comment on the card itself; two or more are counted as "N annotations"
- **Send annotations alone**: with annotations pending you can send on an empty composer; the message carries the quotes and no words
- **Sidebar subagents**: ask about one passage without interrupting the main conversation; pick a separate model, or reuse the same subagent
- **Eight UI languages**: 简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## Usage

**Install**: `dsh plugin --profile web add dsh-select-quote`, then `dsh --profile web`. On the desktop build, enter the package name inside the app and restart.

**Annotate**: click **Annotate** on a selection and it is saved at once; `Enter` or `⌘/Ctrl + Enter` submits, `Shift + Enter` adds a line. Click the annotation card to edit or jump back. In the chevron panel, **Send** keeps you here and **Send and open** goes to the target. With annotations pending, the composer may stay empty and the message still sends.

**Settings**: plugin page → `dsh-select-quote`; the settings sit behind five tabs (Entry / Buttons / Translation / Side task / Shortcuts), each row explains itself, and the last tab you opened is remembered. **Keep at least one button on** — with every switch off the toolbar is empty, so the last switch refuses to turn off and says why.

**Shortcuts** are listed in mechanism 15 of [`docs/internals.md`](docs/internals.md) (the in-app Settings → Shortcuts shows the keys actually in effect); **limitations** live in [`docs/limitations.md`](docs/limitations.md); development commands and internal conventions are in `docs/internals.md` too.

## License

[MIT](LICENSE) © 2026 agan · thanks to [@imallakov](https://github.com/imallakov) (multilingual support and cross-platform builds), [@Ladersbt](https://github.com/Ladersbt), [@EliteOtaku](https://github.com/EliteOtaku).
