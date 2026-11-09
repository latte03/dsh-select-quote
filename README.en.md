# dsh-select-quote

[简体中文](README.md) | English

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
- **Marks and summary**: annotated text keeps a tint and an ordinal mark; "N annotations" above the composer edits, deletes, or jumps back, and clears on send
- **Sidebar subagents**: ask about one passage without interrupting the main conversation; pick a separate model, or reuse the same subagent
- **Eight UI languages**: 简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## Install

Web:

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

Desktop: enter `dsh-select-quote` inside the app, then restart the client. Local development is described in [`dev.patch.example.yml`](dev.patch.example.yml).

## Usage

Click **Annotate** on a selection and it is saved at once; `Enter` or `⌘/Ctrl + Enter` submits, `Shift + Enter` adds a line. Click "N annotations" to edit or jump back. In the chevron panel, **Send** keeps you here and **Send and open** goes to the target.

| Action | Desktop macOS | Desktop Win/Linux | Web macOS | Web Windows | Web Linux |
|---|---|---|---|---|---|
| Open selection menu | `⌘L` | `Ctrl+Shift+L` | `⇧⌘L` | `Ctrl+Shift+L` | `Ctrl+Shift+,` |
| Annotate | `⇧⌘L` | `Ctrl+Shift+.` | `⌥⌘L` | `Ctrl+Shift+.` | `Ctrl+Shift+.` |

## Settings

Plugin page → `dsh-select-quote`; the configuration sits on the plugin's outer page:

- **Trigger and placement**: auto / right-click / both; the toolbar sits above or below the selection and flips when space runs out
- **Selection buttons**: show or hide **Annotate** (chevron and send targets included), **Copy**, **Translate** and **Ask in side task**; **keep at least one on** — the last switch refuses to turn off and says why
- **Merge into the host surface**: our buttons ride in the built-in selection pill instead of a second bar (off by default)
- **Sidebar subagent**: fresh each time (default) or reuse one
- **Translation**: target language, hide for the same language, a separate model, and a custom prompt (`{target}` is replaced)

## Known limitations

- Unsent annotations come back after a refresh (last 20 sessions / 7 days); sending clears them and forked sessions do not inherit them
- Send-to-session needs the host's workspace and `openSession`; older versions hide the entry
- The card mounts on `conversation.chat.user.before` and leaves the user bubble alone; requires dsh ≥ 0.2.2-rc.1
- Selection works in the conversation and file previews only, not in the file tree, editors or terminals
- Translation sends only the selection, with no conversation context; about 6,000 characters and a 90-second timeout

## Development

```bash
pnpm run check     # typecheck + test + build + verify; run before committing
pnpm run sync:web  # push to the installed copy (desktop: sync:desktop)
pnpm run release   # version + tag
```

`lib/` is committed with the source and read at runtime; publishing uses `npm publish`, then syncs the npmmirror copy. Internals and troubleshooting live in [`docs/internals.md`](docs/internals.md).

## Acknowledgements

[@imallakov](https://github.com/imallakov) (multilingual support and cross-platform builds), [@Ladersbt](https://github.com/Ladersbt), [@EliteOtaku](https://github.com/EliteOtaku).

## License

[MIT](LICENSE) © 2026 agan
