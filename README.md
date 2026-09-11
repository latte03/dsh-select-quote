# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 的 Web 客户端插件：在对话里划词，把选中的文本作为**引用**带进下一条消息。

- **划词工具条**：选中对话区任意文本，浮出「复制 / 添加到任务」
- **引用卡片**：添加到任务后，输入框内出现引用卡片（可多张），**草稿里不会出现 Markdown**
- **随消息发送**：按 Enter 或点原来的发送按钮，引用块按卡片顺序折进消息，卡片消失
- **对话记录**：同一条消息里的引用渲染为卡片，用户气泡里只剩你打的问题

---

## 兼容性

| 项 | 值 |
|---|---|
| dsh | `0.1.5-alpha.2`（同 minor 的 `0.1.5-alpha.x` 应该可用） |
| profile | web（`dsh web`） |
| 运行时 | 只有浏览器半有业务；Node 半仅用于让包被 Loader 挂载 |

实现依赖若干产品内部约定（见[已知限制](#已知限制)），升级 dsh 后请先跑 `npm run check` 再人工回归。

## 快速开始

### 方式一：本地开发加载（`--patch`）

```bash
git clone <repo> && cd dsh-select-quote
npm install
npm run build

dsh web --patch "$PWD/cordis.patch.yml"
```

打开 `http://127.0.0.1:3080`，在对话消息里划词即可看到工具条。

> `cordis.patch.yml` 里的插件路径必须是**绝对路径**。仓库内该文件按 checkout 路径写死，换机器/换目录时改这一行。

### 方式二：作为 bundle 安装

```bash
dsh plugin --profile web add /absolute/path/to/dsh-select-quote
dsh --profile web
```

## 开发

```bash
npm run typecheck   # tsc --noEmit，应无输出
npm run build       # 产出 lib/index.js 与 lib/client.js
npm run watch       # 增量重建
npm run verify      # 无头执行 lib/client.js，断言 5 项贡献都注册上了
npm run check       # typecheck + build + verify（提交前跑这个）
```

**为什么有 `verify`**：`tsdown` 不做类型检查，一个语法坏掉的 bundle 也能构建"成功"。最典型的一次事故是 CSS 模板字符串里出现了反引号（`` `.nyYjTG_file` ``），字符串被提前截断，产出的 JS 无法执行，但 build 输出一切正常。`verify` 把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果——这是唯一能在浏览器之外发现这类错误的手段。改动 `src/client/index.tsx` 的注册项时，记得同步 `scripts/verify-bundle.mjs` 里的 `EXPECTED`。

## 工作原理

### 数据契约：消息里的引用块

引用在消息里就是一段带标记的 Markdown 引用块，正文在最前面：

```
> [选中文本]
> 用户选中的第一段

> [选中文本]
> 用户选中的第二段

用户自己输入的问题
```

`> [选中文本]` 这个标记是插件的识别依据：客户端据此把这段从用户气泡里剥掉、改渲染成卡片。**改动这个标记要同时改三处**：`formatQuoteBlock()`（写）、`parseQuoteMessage()`（读）、`displayTextWithoutQuote()`（剥离）。

### 客户端贡献

| 位置 | 类型 | 说明 |
|---|---|---|
| `conversation.input.overlay` | list slot | `select-quote-toolbar`（划词工具条）、`select-quote-card`（引用卡片堆） |
| `conversation.chat.node` | keyed slot | `select-quote`（引用卡片）、`user`（替换用户气泡） |
| Conversation Definition | `uiConversation.events.register` | `select-quote`：把带引用的 `user/message` 变成一个 Chat 节点 |

### 关键机制

**1. 引用不进草稿，只在发送瞬间注入**

卡片不是草稿的"可视化"，而是唯一的表示。草稿保持用户真正输入的内容，引用块在**发送动作的捕获阶段**才折进去：`document` 上的 `keydown`（无修饰键的 Enter、非 IME 组字）或 `click`（composer 内 DOM 顺序上的最后一个 `button`，且不是停止按钮——停止按钮渲染的是 `svg rect`）。捕获阶段早于 composer 自己的处理器，因此它读到的草稿已经包含引用块。见 `src/client/QuoteCard.tsx`。

**2. 不可见字符 U+200B 让发送按钮保持可用**

草稿为空时 composer 会把发送按钮置灰（`empty = draft.trim() === "" && attachments.length === 0`），而 U+200B 不是 JS 的 WhiteSpace，`trim()` 不会去掉它，于是"只有引用、没打字"也能直接发送。它只在**新增/移除引用卡片**时写入或清除一次，发送前由 `stripDraftMarker()` 剔除，绝不进消息。

> 这条规则有个坑：**永远不要因为草稿变化就重写编辑器**。`inputActions.setDraft()` 的实现是 `root.clear()` + 逐行重建 + 光标移到末尾。早期版本在 `useEffect` 里依赖 `draft`，一旦发现标记缺失就补——用户按 Backspace 删到标记时会被立刻补回（表现为"删除失效"），输入法组字期间甚至会把正在组字的编辑器内容整段清掉（表现为"打完中文按 Backspace 没反应"）。

**3. 输入框卡片布局**

`conversation.input.overlay` 的锚点是 `height: 0; position: absolute`，卡片本身也是绝对定位，因此**不会挤开下面的编辑器**，默认会盖住附件栏。做法是给 `[data-composer-card]` 加一个 `.dsq_cardPad` 类，用 `ResizeObserver` 实测卡片堆高度写进 `--dsq-quote-pad`：

```css
.dsq_cardPad { padding-top: var(--dsq-quote-pad, 88px) !important; }
```

绝对定位子元素相对**padding box** 定位，所以卡片仍在顶部，而附件栏与编辑器一起被推到它下方——这也顺带修掉了"传图时图片被卡片盖住"。

**4. 对话记录：Definition + 节点 + 气泡替换**

- Definition（`transcript-node.ts`）匹配 `type === "user/message"` 且文本含引用块的消息，产出一个 `select-quote` 节点；
- `TranscriptQuoteCard.tsx` 渲染该节点（每段引用一张卡片，纵向堆叠、与气泡同侧）；
- `UserMessageDisplay.tsx` 以 `priority: -10` 替换内置的 `user` 节点，把引用块从气泡里剥掉，**同时自己渲染消息携带的图片**——只引用、没有正文的消息，气泡文本为空，若不接管图片渲染，整条消息（含图片）会消失。

**5. 样式与主题**

卡片几何对齐产品自带的文件卡片（`ui-deliverables` 的 `.nyYjTG_file`）：`.5px` 发丝边框、18px 圆角、64px 固定高、10px 内边距、hover 背景过渡；删除按钮绝对定位右上角，仅 hover / 键盘聚焦时淡入。

- 深色模式用产品自己的 `body[data-ds-dark-theme]`（由 `dsh-client-ui-layout` 挂在 body 上），**不是** `prefers-color-scheme`；
- 颜色一律用会随主题翻转的 `--dsw-alias-*` / `--dsw-static-*` token，只自己定义 `--dsq-card-fill` / `--dsq-card-hover` 两个填充变量；
- 样式通过 `ensureToolbarStyles()` 注入一个 `<style data-plugin-css="dsh-select-quote/toolbar.css">`，**改完 CSS 必须刷新页面**（函数只插入一次）。

## 目录结构

```
src/index.ts                       # Node 半：占位，让包被 Loader 挂载
src/client/index.tsx               # Client 半入口：注册 Slot 与 Conversation Definition
src/client/SelectionToolbar.tsx    # 划词浮动条（复制 / 添加到任务）
src/client/selection.ts            # 选区快照、工具条定位、复制、聚焦输入框
src/client/QuoteCard.tsx           # 输入框内引用卡片堆 + 发送动作拦截
src/client/quote-store.ts          # 每会话引用状态、消息块拼装、U+200B 标记
src/client/TranscriptQuoteCard.tsx # 对话记录里的引用卡片
src/client/UserMessageDisplay.tsx  # 替换用户气泡（隐藏引用块、保留图片）
src/client/transcript-node.ts      # select-quote Conversation Definition
src/client/transcript-parse.ts     # 引用块解析 / 气泡文本剥离
src/client/styles.ts               # 全部 CSS（模板字符串注入）
src/client/context.d.ts            # 客户端 Context 服务的类型补充
scripts/build.mjs                  # tsdown 构建 + ModuleLoader 包装
scripts/verify-bundle.mjs          # 无头 bundle 校验
cordis.patch.yml                   # --patch 开发加载层
lib/                               # 构建产物（已提交，运行时直接读它）
```

## 已知限制

- **引用状态在内存里**：刷新页面或换会话后待发引用会丢，卡片不会持久化。
- **输入框卡片最宽为输入框的 1/4**（`max-width: calc(25% - 5px)`），超长标题走省略号；同一行可放 4 张，多了换行。正因为窄，输入框内的图标是 36px，而对话记录里是 40px。
- **替换了 `user` 节点**（`priority: -10`，最低优先级胜出）。若其它插件也替换同一个键（例如 `dsh-easyrewrite` 用 `-1`），本插件会把对方屏蔽掉。
- **只注入一个会话一份待发引用**，按 `sessionId` 在内存 Map 里存。
- 依赖的产品内部约定：`[data-composer-card]` 属性、主发送按钮是卡片内 DOM 顺序上最后一个 `button`、停止按钮渲染 `svg rect`、`user/message` 事件的内容在 `data.content`（不是 `data.message.content`）、深色属性 `data-ds-dark-theme`。产品升级后这些都需要复核。

## 排错

| 现象 | 先查 |
|---|---|
| 划词没有工具条 / 卡片不出现 | 跑 `npm run check`；确认页面已刷新；Host 的 boot 图里应包含 `dsh-select-quote`（`/plugins` 路由由 `ctx.clientModules` 提供） |
| 输入框里出现 `> [选中文本]` 原文 | 说明发送前的注入没生效：确认草稿里存在 U+200B（发送按钮应是可用的），以及 composer 结构未变（`[data-composer-card]`） |
| 对话记录里没有卡片 | 该 `user/message` 事件的 `data.content` 是否含引用块；`conversation.chat.node` 的 `select-quote` 单元是否被注册 |
| 带图片的消息在记录里只剩卡片、图片没了 | `UserMessageDisplay` 是否拿到了 `renderMessageImages` |
| 改了 CSS 不生效 | `<style>` 只注入一次，刷新页面 |
| 按 Backspace 删不掉 / 中文输入被打断 | 检查是否有代码在响应草稿变化时调用 `setDraft()`（见[关键机制 2](#关键机制)） |

## License

未指定。
