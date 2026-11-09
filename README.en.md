# dsh-select-quote

[简体中文](README.md) | English

A [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) client plugin: adds **selection annotations and quotes**, **in-place translation**, and **sidebar subagent questions** to DSH, and opens links in your **default browser**. The selected text and your comment ride along with the next message; conversation text keeps its highlight and ordinal mark for jumping back, while a Sidebar file selection is quoted as plain text. The menu can appear on selection or open from the right-click menu, and translation can use its own model.

[![DSH Open Plugins](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-select-quote.json)](https://dshopen.org/zh/plugins/dsh-select-quote/)
[![awesome-dsh-plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/)
[![npm monthly downloads](https://img.shields.io/npm/dm/dsh-select-quote)](https://www.npmjs.com/package/dsh-select-quote)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.2--rc.1-blue)](package.json)

![dsh-select-quote](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/hero.png)

## Features

- **Selection toolbar**: select text in the conversation or in a file preview in the right Sidebar to get **Open link / Copy / Translate / Annotate / Ask in sidebar**. File previews omit **Ask in sidebar**. The toolbar can sit above or below the selection
- **In-place translation**: translates the selection into the target language, streaming next to it. While the model is thinking, a progress icon shows live reasoning; once the translation lands, the reasoning collapses but stays available. The target follows the UI language by default and can be switched on the spot; the result copies in one click. Reopening the same text with the same settings reuses the in-memory cache for the session without calling the model
- **Right-click menu and shortcuts**: the same actions open from the selection's context menu or from the keyboard; key bindings are configurable in the host's settings
- **Annotation summary**: the composer shows "N annotations" above it; expand to edit or jump back to the source. Deleting asks for a second "Confirm removal" click; the summary clears when the message is sent
- **Marks in the text**: annotated text keeps a tint and an ordinal mark. Click the mark to see the source and comment; pending annotations can be edited or removed from the mark's popover, matching the summary card
- **Send to another session**: puts the selected text and comment into another session's composer, either staying on the current page or going there directly, including a workspace's "New session". The source keeps an arrow mark; the target card shows "From: <session>" and both sides can jump back. Once the target sends, the source mark is labeled "Sent"
- **Model references**: when a model points at an annotation in its answer, it renders as a chip with a preview
- **Sidebar subagents**: ask about a conversation passage in the sidebar without interrupting the main conversation. Pick a separate model and reasoning level, or reuse the same subagent (the directory keeps a single entry)
- **Eight UI languages**: 简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## Install

Web:

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

Desktop: enter `dsh-select-quote` inside the app, or find it in the plugin page and install; restart the client to take effect.

Local development:

```bash
git clone https://github.com/latte03/dsh-select-quote && cd dsh-select-quote
pnpm install && pnpm run build
cp dev.patch.example.yml dev.patch.yml   # replace <CHECKOUT> with this checkout's absolute path
dsh web --patch "$PWD/dev.patch.yml"
```

Open `http://127.0.0.1:3080` to try it. `dev.patch.yml` is a local, untracked file; the repository only ships the template.

## Usage

1. Select text in the conversation or in a file preview in the right Sidebar → click **Annotate** (the main button); the annotation is saved immediately. Add a comment in the box; `Enter` or `⌘/Ctrl + Enter` submits, `Shift + Enter` inserts a newline
2. Hover (or tap on touch) the summary above the composer to expand the list: edit, delete, or jump back to the text. Click a mark in the text to preview its annotation
3. Send as usual: annotations go to the model with the message, the summary disappears, the marks stay; model references render as chips
4. **Ask in sidebar** opens the composer first; the subagent is created and shown in the right sidebar only after you press send. The directory names it "Ask in sidebar · question summary"
5. **Translate** opens the translation popover and starts streaming right away: switch languages in the header, **Stop** cancels; use the copy icon at the bottom right when done; Esc or an outside click closes it
6. **Annotate this conversation** is the main button; its chevron opens the **Send to** panel, whose first row is this conversation. Pick a session, then **Send** to stay here or **Send and open** to go there: **Send** stays on the current page, **Send and open** opens the target. Entries in the target composer carry "From"; click one to return to the source

There are three ways to open the menu after selecting text: auto (default), right-click on the selection, or a shortcut. Touch always uses the bottom action bar.

| Action | Desktop macOS | Desktop Win/Linux | Web macOS | Web Windows | Web Linux |
|---|---|---|---|---|---|
| Open selection menu | `⌘L` | `Ctrl+Shift+L` | `⇧⌘L` | `Ctrl+Shift+L` | `Ctrl+Shift+,` |
| Annotate | `⇧⌘L` | `Ctrl+Shift+.` | `⌥⌘L` | `Ctrl+Shift+.` | `Ctrl+Shift+.` |

## Settings

Plugin page → `dsh-select-quote`; configuration is shown directly on the plugin's outer page:

- **Selection trigger**: auto / right-click menu / both, auto by default
- **Toolbar placement**: below (default) or above, for auto or both; flips automatically when space runs out (hidden while the toolbar is merged into the host surface)
- **Merge into the host surface**: put our buttons inside the built-in selection pill (Quote text plus copy / translate / annotate with its destination picker), instead of a second pill next to the text; off by default
- **Settings shortcut**: the gear at the end of the row jumps straight to this plugin's page, where the configuration lives
- **Shortcuts**: enable the two commands and see the effective keys; change them in the host's Shortcuts settings
- **Sidebar subagent**: fresh each time (default) or reuse one; in reuse mode the directory keeps a single entry, and context and model stay at first creation
- **Translation target**: auto (default, follows the UI language; translates to English when the source is already in that language) or one of eight fixed languages
- **Hide translate for same language**: when on, the toolbar and right-click menu omit **Translate** if the selection is already in the target language; auto target compares against the UI language (off by default)
- **Translation model**: follows the current conversation by default, or pick a faster model just for translation
- **Custom prompt**: the input's placeholder is the built-in prompt; leave it empty to use the built-in one, or fill it in to override the whole prompt. `{target}` is replaced with the target language

## Languages

The UI follows dsh's language setting; the plugin UI, its page title, and its description switch together across eight languages (see above).

## Known limitations

- **Annotations persist per session**: after a refresh or restart, unsent annotations come back (last 20 sessions, 7 days); sending clears them, and forked sessions do not inherit them
- **Send-to-session depends on the current dsh version**: it needs the host's workspace and `openSession` APIs; older versions hide the entry. Unsent handoffs are pruned in pairs after 20 sessions / 7 days; once the target sends, the source mark stays forever. Jumping back from the target only guarantees history that is loaded; a miss shows a notice
- **Leaves the user bubble alone**: the card mounts on the `conversation.chat.user.before` decoration seat, so the bubble, attachments and time/copy row stay the host's; the protocol block is stripped by a `uiConversation.userText` rule. Requires dsh ≥ 0.2.2-rc.1
- **Selection scope**: the conversation and file previews in the right Sidebar; the file tree, editors, terminals and other panels are left alone. File previews have no **Ask in sidebar**, and selecting text never changes the file. Keyboard users need caret browsing or assistive technology to create a selection
- **Sidebar questions must be sent**: the host does not allow creating a subagent in an empty session; reuse mode has no model entry
- **Translation sends only the selection**: the request carries no conversation context and does not write an annotation; copy the translation if the model needs it. One request is capped at about 6,000 characters and times out after 90 seconds; failures show an error summary in the popover, with details in the console
- **Web Linux shortcuts are limited**: the host accepts only `Ctrl+/`, `Ctrl+Shift+,`, and `Ctrl+Shift+.`; this plugin uses the latter two

## Development

```bash
pnpm run check          # typecheck + test + build + verify; run before committing
pnpm run watch          # incremental rebuild
pnpm run sync:web       # push to the installed web client (desktop: sync:desktop)
pnpm run release        # check → CHANGELOG → version + tag
```

`lib/` is committed with the source and read at runtime. Publishing uses `npm publish --registry=https://registry.npmjs.org/`, then syncs the npmmirror mirror.

For internals, conventions, and troubleshooting, see [`docs/internals.md`](docs/internals.md); historical investigations live in [`docs/archive/`](docs/archive/).

## Acknowledgements

[@imallakov](https://github.com/imallakov) (multilingual support and cross-platform builds), [@Ladersbt](https://github.com/Ladersbt) (chip preview feedback), [@EliteOtaku](https://github.com/EliteOtaku) (desktop issue diagnosis).

## License

[MIT](LICENSE) © 2026 agan
