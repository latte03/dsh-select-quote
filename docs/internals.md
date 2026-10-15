# dsh-select-quote 实现说明（维护者向）

面向用户的介绍与安装在 [README](../README.md)。这里记录协议、槽位、以及踩过的坑——改代码前先读这份。

## 开发命令

```bash
pnpm run typecheck   # tsc --noEmit，应无输出
pnpm run build       # 产出 lib/index.js 与 lib/client.js
pnpm run watch       # 增量重建
pnpm run sync:desktop        # 把 lib/ 推给桌面客户端已安装的副本（热更新）
pnpm run sync:desktop -- --watch
pnpm run dev:desktop         # 上面两个一起开：增量重建 + 推送（scripts/dev-desktop.mjs 拉起两个子进程）
pnpm run verify      # 无头执行 lib/client.js：8 项贡献都注册上，且三种语言的词典键与占位符齐备
pnpm run check       # typecheck + build + verify（提交前跑这个）
pnpm run release     # check → 追加 CHANGELOG.md → 提升版本号并打 tag
```

**为什么有 `verify`**：`tsdown` 不做类型检查，一个语法坏掉的 bundle 也能构建"成功"。最典型的一次事故是 CSS 模板字符串里出现了反引号（`` `.nyYjTG_file` ``），字符串被提前截断，产出的 JS 无法执行，但 build 输出一切正常。`verify` 把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果——这是唯一能在浏览器之外发现这类错误的手段。改动 `src/client/index.tsx` 的注册项时，记得同步 `scripts/verify-bundle.mjs` 里的 `EXPECTED`。

**本地跑起来**：`dev.patch.yml` 里的插件路径必须是**绝对路径**（checkout 不在 profile 的 `node_modules` 里，Loader 没有包名可解析）。换机器/换目录时改那一行；该文件不随 npm 包发布，发布版走 `cordis.patch.yml`（按包名）。

**桌面客户端的热更新（`sync:desktop`）**：宿主把 `@deepseek-ai/dsh-client-hmr` 挂在 web 组合包里（`dsh-web-app/cordis.patch.yml` 注明 always mounted，没有产物变化时静默）。它的 node 半每 500ms `statSync` 每个 roster 行 client 产物的 `mtimeMs/ctimeMs/size`，签名一变就调 `clientModules.rebuilt(id)` 重算 revision，并经 SSE `/plugins/events` 广播 `{type:"rebuilt",id,rev}`；浏览器半收到即 `ctx.modules.entries.reload(id, rev)`，只重载这一个插件模块。产物按 `?rev=<hash>` 取，新 revision 天然绕过 immutable 缓存。因此 `scripts/sync-desktop.mjs` 要做的只有一件事：**让被监听的那个文件内容变化**——它按 `$DSH_HOME`（默认 `~/.dsh`）+ profile（`--profile` / `$DSH_PROFILE`，默认 `desktop`）定位已安装副本，只在字节不同的时候写，避免空重载。换 package 版本（`pnpm add` / 市场更新）仍然必须重启客户端，热路径只覆盖产物字节。

## 数据契约

### 现行：批注 JSON 块

待发批注在发送瞬间被折成一段带指令头的 JSON 块，跟在用户正文前面（`composeAnnotatedMessage`）：

```
# Response annotations:
Each item contains text selected from an earlier message ...

<response-annotations>
[{"text":"…","annotation":"…","source":{…}}]
</response-annotations>

用户自己输入的问题
```

- 读取：`scanAnnotatedMessage()` 剥掉整块，气泡只剩用户正文；
- 回指：协议头要求模型对它处理过的每条批注内联 `:dsh-annotation{index="N"}`，客户端 `decorateAnnotationDirectives.ts` 把这些指令渲染成可点击 chip；
- **改格式要一起改**：`composeAnnotatedMessage()`（写）、`scanAnnotatedMessage()`（读）、`ANNOTATION_DIRECTIVE_RE`（chip）、`scripts/verify-bundle.mjs`。

### 遗留：`> [选中文本]` 引用块

旧版把引用写成 Markdown 引用块。现在**不再写入**，只在 `quote-protocol.ts` 里保留读取与剥离能力（`parseQuoteMessage()` / `displayTextWithoutQuote()`），用于渲染历史消息。新消息一律走上面的 JSON 块。

## 客户端贡献（共 8 项）

| 位置 | 类型 | 说明 |
|---|---|---|
| `shell.overlay` | list slot | `select-quote-toolbar`（order 100）：划词工具条 + 评论气泡。挂 root 级，切会话/看历史都不会失去观察 |
| `conversation.input.overlay` | list slot | `select-quote-card`（order 20）：输入框内的批注摘要；`select-quote-session-bridge`（order 1）：只负责把 `sessionId` 发布给 root 工具条 |
| `conversation.chat.node` | keyed slot | `user`（`priority: -10`）：替换内置用户气泡，剥掉协议块并渲染批注卡片 |
| `ctx.locale` | 语言服务 | `addLanguage(ru)` + `register('select-quote', {zh,en})` + `register('select-quote','ru',…)` + `bind('select-quote')`，见下面第 9 节 |

不再注册 `select-quote` Chat 节点，也不再注册 Conversation Definition——卡片内联在 `user` 节点里，原因见下面第 4 节。

## 关键机制

**1. 批注不进草稿，只在发送瞬间注入**

摘要卡片不是草稿的"可视化"，而是唯一的表示。草稿始终保持用户真正输入的内容，JSON 块在**发送动作的捕获阶段**才折进去：`document` 上的 `keydown`（无修饰键的 Enter）或 `click`（composer 卡片内 DOM 顺序上的最后一个 `button`，且不是停止按钮——停止按钮渲染的是 `svg rect`）。捕获阶段早于 composer 自己的处理器，因此它读到的草稿已经包含批注块。见 `src/client/composer/useSendIntercept.ts`。

**2. 不可见字符 U+200B 让发送按钮保持可用**

草稿为空时 composer 会把发送按钮置灰（`empty = draft.trim() === "" && attachments.length === 0`），而 U+200B 不是 JS 的 WhiteSpace，`trim()` 不会去掉它，于是"只有批注、没打字"也能直接发送。它只在**新增/移除批注卡片**时写入或清除一次，发送前由 `stripDraftMarker()` 剔除，绝不进消息。

> 这条规则有个坑：**永远不要因为草稿变化就重写编辑器**。`inputActions.setDraft()` 的实现是 `root.clear()` + 逐行重建 + 光标移到末尾。早期版本在 `useEffect` 里依赖 `draft`，一旦发现标记缺失就补——用户按 Backspace 删到标记时会被立刻补回（表现为"删除失效"），输入法组字期间甚至会把正在组字的编辑器内容整段清掉（表现为"打完中文按 Backspace 没反应"）。现在标记由 `useDraftMarker.ts` 按 `itemCount` 变化驱动，不观察 `draft`。

**3. 输入框卡片布局**

`conversation.input.overlay` 的锚点是 `height: 0; position: absolute`，卡片本身也是绝对定位，因此**不会挤开下面的编辑器**，默认会盖住附件栏。做法是给 `[data-composer-card]` 加一个 `.dsq_cardPad` 类，用 `ResizeObserver` 实测卡片堆高度写进 `--dsq-quote-pad`：

```css
.dsq_cardPad { padding-top: var(--dsq-quote-pad, 88px) !important; }
```

绝对定位子元素相对**padding box** 定位，所以卡片仍在顶部，而附件栏与编辑器一起被推到它下方——这也顺带修掉了"传图时图片被卡片盖住"。

**4. 对话记录：气泡替换 + 卡片内联在 `user` 节点里**

- `UserMessageDisplay.tsx` 以 `priority: -10` 替换内置的 `user` 节点，把协议块从气泡里剥掉，**同时自己渲染消息携带的图片**——只批注、没有正文的消息气泡文本为空，若不接管图片渲染，整条消息（含图片）会消失；
- 卡片**由该组件自己渲染**（`<TranscriptQuoteCard>`），而不是注册一个独立的 `select-quote` Chat 节点；竖排顺序是 附件 → 卡片 → 气泡文本，与输入框里「卡片在草稿上方」保持一致；
- `TranscriptQuoteCard.tsx` 负责卡片本身：**每段批注一张 `AnnotationCardView`（`variant: 'transcript'`）**，纵向堆叠、与气泡同侧。卡片上直接显示**选中文本 + 用户评论**，点卡片滚回正文对应 mark——评论是用户认出自己那条批注的唯一凭据，不能只藏在悬停面板里（曾经用过 `AnnotationSummary`，折叠态只显示「N 条批注」，评论必须悬停才看得到）。

> **为什么卡片必须挂在 `user` 节点上**（2026-10-08 定位）：`conversation.chat.node` 虽然能注册任意 key，但 `ui-chat` 用 allowlist `TURN_PROCESS_INDEPENDENT_KINDS` 决定一个节点能否脱离「Turn 过程折叠块」：
>
> ```js
> // dsh-client-ui-chat, ChatNodeSeat
> const TURN_PROCESS_INDEPENDENT_KINDS = new Set([
>   "system-prompt", "user", "steering", "turn-trigger", "turn-process",
>   "turn-error", "turn-max-tokens", "turn-tail"
> ])
> const processMember = ... && !TURN_PROCESS_INDEPENDENT_KINDS.has(routedNode.kind) && ...
> const processHidden  = controllerInactive || foldable && processMember && !processOpen
> ```
>
> `select-quote` 不在表里，于是被判定为 turn-process 成员；已结束的 Turn 折叠 `process` 区块后 `processHidden = true`，`useSearchableHidden` 给外层加 `hidden`。**节点挂载了、然后被隐藏**——外部表现就是「卡片不存在」，而且不报错、不写 crash log。`user` 在表里，所以只有挂在 `user` 节点上才稳定可见。诊断方法：注册的节点永远先查这张表，再怀疑注册/匹配/解析链路。

**5. 正文 Mark：虚线下划线 + 末尾序号角标**

划中的文本在**原消息正文**里留下 `.dsq_annMark`：高亮色**虚线**下划线（`--dsw-static-blue-500`）+ 淡蓝底 + 圆形序号徽章。徽章是上标角标，挂在划词**末尾**（多片段选区只挂在最后一个片段），不挡阅读。定位靠 `message-text.ts`：选区落在哪条消息（`[data-chat-flow-key]`）、起止字符偏移多少——偏移在"跳过插件自身装饰节点"的纯净文本上计算，mark 本身透明（不计入偏移），所以装饰前后偏移稳定。比较时忽略空白（选区文本在段落间有换行、DOM 拼接没有）。定位随 `source` 写进 wire JSON，刷新页面后由 durable 消息重新解析、重新装饰；`annotate-text.ts` 用 MutationObserver 对抗 React 重渲染（节点被换掉就重新包）。

**6. 悬停摘要面板**

面板 **portal 到 `document.body`**：对话区的 `.I17U7q_follow` 带 `contain: layout`、滚动容器带 `container-type`，它们都是 `position: fixed` 的包含块，面板写在子树里会整体跑出屏幕。面板与摘要之间留 12px 透明"悬停桥"，指针离开集群有 320ms 宽限；resize / 滚动时面板重新定位而非失效。条目序号与"选中的文本"同行，点击滚动到对应正文 mark。编辑批注**不另弹层**：点铅笔后该项在列表面板内原地展开编辑（完整原文 + 评论框 + 取消/保存）。划词工具条等**拖拽结束**（pointerup）才出现，评论弹窗居中于工具条。

**7. 划词只在对话区生效**

工具条的唯一入口是 `readSelectionSnapshot()`（`SelectionToolbar.tsx` 的 refresh 调它）：选区的 anchor 与 focus 都必须在 `[data-chat-flow-key]` 消息里（`isInsideTranscript()`），且不在输入框 / 工具条自身里。侧边栏、设置、模型选择等其它面板划词不会有任何反应——这几处没有 flow item。宿主侧确认：`ChatView` 给每条消息的 div 写 `data-chat-flow-key: routedNode.key`，分组座位也带同一个属性（属于对话区，允许划词）。

**8. 样式与主题**

卡片几何对齐产品自带的文件卡片（`ui-deliverables` 的 `.nyYjTG_file`）：`.5px` 发丝边框、18px 圆角、64px 固定高、10px 内边距、hover 背景过渡；删除按钮绝对定位右上角，仅 hover / 键盘聚焦时淡入。

- 深色模式用产品自己的 `body[data-ds-dark-theme]`（由 `dsh-client-ui-layout` 挂在 body 上），**不是** `prefers-color-scheme`；
- 颜色一律走产品 token，但**不直接写 token 名**：`styles.ts` 的分层是
  1. **token 层**：产品 token 各包一次成 `--dsq-*` 别名（`--dsq-label`、`--dsq-line`、`--dsq-shadow-pop`…），兜底值只在这里出现一遍；别名块挂在 `body` 而不是 `:root`，因为产品在 `body[data-ds-dark-theme]` 上翻转调色板，挂在根元素会把亮色值冻结后继承进深色页；
  2. **原子层**：`.dsq_a_*`（`row` / `col` / `col-end` / `grid-mid` / `ell` / `plain` / `keep` / `grow` / `box` / `inline-row`），由 `ATOMS` 表同时生成 CSS 规则和 `A` 常量，两边不可能对不上；**只放形状，不放数字和颜色**；
  3. **组件层**：带数字的取值都留在这里，注入顺序在原子之后，所以组件规则总能盖住原子；
  4. **宿主层**：`@keyframes`、深色覆写、以及伸进产品 DOM 的那两条规则（`.dsq_cardPad` 给 composer 让位）。
  JSX 里用 `cx(styles.card, A.row)` 组合；`A.x` 和 `styles.x` 都是字面量类型，写错名字过不了 `pnpm run typecheck`；
- 同一段卡片几何在输入框和对话记录里不再各写一份：`.dsq_card` / `.dsq_cardIcon` / `.dsq_cardBody` / `.dsq_cardTitle` / `.dsq_cardSubtitle` 是共用基底，`.dsq_tCard` / `.dsq_tCardIcon` 只留真正不同的数字（宽度、40px 图标），基底里那些对 `position` / `display` 无意义的属性（如 `flex`）在 transcript 侧是惰性的；
- 样式通过 `ensureToolbarStyles()` 注入一个 `<style data-plugin-css="dsh-select-quote/toolbar.css">`，**改完 CSS 必须刷新页面**（函数只插入一次）；桌面端可用 `pnpm run sync:desktop` 热更新（见「桌面客户端的热更新」）。

**9. 装饰观察者会自我触发：一条 `return` 挡住了渲染进程楔死**

`decorateTextNode()` 的退出条件是文本不含字面量 `:dsh-annotation{`。协议头部原文里就带着这个字面量（`# Response annotations:` 那段指令在描述内联标记时逐字写出了 `:dsh-annotation{index="N"}`，`N` 是字母），而严格正则 `/:dsh-annotation\{index="([1-9]\d*)"\}/g` 只接受数字，于是「含字面量、零匹配」成立：`while` 一次都不进，`last` 停在 `0`，末尾仍然执行了

```js
if (last < value.length) frag.append(document.createTextNode(value.slice(last)))
parent.replaceChild(frag, node)   // 换成一个内容完全相同的新 Text 节点
```

`watchAnnotationDirectives()` 监听 `{childList: true, subtree: true, characterData: true}`，回调对新节点再调 `decorateTextNode()`，于是它一直在装饰自己刚产出的节点。`MutationObserver` 回调是微任务，队列永远排不空：**宏任务、定时器、`Runtime.evaluate` 全都得不到执行**，表现为主线程单核 100%、输入区不可点，连 `Debugger.pause` 都进不去（中断同样排不上队）。 [#1](https://github.com/latte03/dsh-select-quote/issues/1) 报告时只在 Electron 路径复现，是因为桌面端恰好把毒串送进了 Text 节点；缺陷与加载路径无关，在插件自己的装饰器里。

两道防线（`src/client/dom/decorateAnnotationDirectives.ts`）：

1. 严格正则一次都没匹配上就在碰 DOM 之前 `return`（`if (!matched) return`）；
2. composer 全程不碰：跳过列表加入 `textarea` / `input` / `[data-lexical-editor="true"]`，因为发送瞬间草稿里会短暂出现带该字面量的协议原文。

> 凡是"改写 DOM 的观察者"都要自检这两条：**没有实际命中就不要写 DOM**，以及**别把自己输出的节点当成新输入**。

**10. 界面语言由宿主决定，插件只提供词典**

文案语言来自 `@deepseek-ai/dsh-client-locale` 的服务 `ctx.locale`，插件不再自行判断：

| 调用 | 用途 |
|---|---|
| `register(ns, {zh, en})` | 一次注册全部内置语言的词典；宿主强制要求两种都在 |
| `addLanguage({id:'ru', label:'Русский', fallback:'en'})` | 把非内置语言加进设置里的候选；回退链必须以 `en` 结束，否则注册即抛 |
| `register(ns, 'ru', dict)` | 三参形式，给外部语言补词典 |
| `bind(ns)` | 拿到稳定的 `t(key, params)`，每次调用都按当前 active 语言解析 |
| `subscribe(fn)` | 语言或词典变化时通知（注册本身也会推进 `revision`） |

**为什么必须由宿主说了算**：桌面版是 Electron 外壳，渲染进程带着 `--lang=en-US` 启动，`navigator.language` 因此报 en，而用户在设置里选的是中文——插件若自查 `navigator`，界面会和产品反着来。宿主自己在 Client 挂载前通过 `__DSH_LOCALE__` 拿到 Host preference 与有序 OS 语言列表，这条通道只有 `ctx.locale` 能读；偏好本身持久化在 profile 的 `cordis.patch.yml` 里（`- id: locale / config.preference`）。

**即时切换**：React 侧经 `useLocale()`（`useSyncExternalStore` 挂在 `subscribe` 与 `revision` 上）重渲染；chip 是直接写 DOM 的，所以在 `apply()` 里订阅一次 `refreshDirectiveChips()` 重写文案。写 DOM 的订阅不会触发第 8 节那个循环——新文本不含指令字面量，`decorateTextNode()` 在入口就返回。

**复数**：宿主的词典是「键 → 单个模板字符串」，没有复数概念。带 `{count}` 的文案因此拆成 `key.one` / `key.few` / `key.many` / `key.other`，由 `i18n.ts` 按语言挑形式，挑不到就退 `key.other`。`pnpm run verify` 按复数组比对三种语言：组必须都存在，且**每组必须有 `.other`**，占位符名也不允许漂移——漏一个键会渲染出键名本身，漏一个占位符会把 `{count}` 直接印在界面上。

## 目录结构

```
src/index.ts                       # Node 半：占位，让包被 Loader 挂载
src/client/index.tsx               # Client 半入口：注册 Slot、语言词典与装饰观察者
src/client/SelectionToolbar.tsx    # 划词浮动条（复制 / 添加到任务）+ 评论气泡
src/client/composer/AnnotationPanel.tsx      # 输入框内批注摘要 + 发送动作拦截
src/client/composer/useSendIntercept.ts      # 发送手势时把待发批注折进草稿
src/client/composer/useDraftMarker.ts        # U+200B 让"只有批注"时发送按钮可用
src/client/dom/selection.ts        # 选区快照、工具条定位、复制、聚焦输入框
src/client/dom/message-text.ts     # 消息纯净文本遍历、选区→字符偏移定位
src/client/dom/annotate-text.ts    # 正文 mark（下划线+序号徽章）的注册表与装饰
src/client/dom/scrollToAnnotation.ts # 点击批注滚动到正文 mark 并闪烁
src/client/dom/decorateAnnotationDirectives.ts # 模型回的 :dsh-annotation{index="N"} 渲染成可点 chip
src/client/dom/popoverPlacement.ts # 浮层定位（翻转 + 视口夹取）
src/client/dom/composer-host.ts    # composer DOM 约定（[data-composer-card] 等）
src/client/state/annotation-store.ts # 每会话待发批注状态（内存 Map）
src/client/protocol/annotation-protocol.ts # 批注 wire 格式（含 source 定位）
src/client/protocol/quote-protocol.ts      # 旧 > 引用块协议 / U+200B 标记 / 文本工具
src/client/transcript/TranscriptQuoteCard.tsx # 对话记录里的批注卡片（由 UserMessageDisplay 渲染）
src/client/transcript/UserMessageDisplay.tsx  # 替换用户气泡（隐藏协议块、保留图片、内联批注卡片）
src/client/ui/AnnotationCardView.tsx  # 批注卡片与悬停列表面板（portal 到 body、内联编辑）
src/client/ui/icons.tsx               # 内联 lucide 图标（pencil / trash / x / copy / plus）
src/client/i18n.ts                   # 三份词典（zh / en / ru）、复数形式挑选、把 t() 转给宿主 bind 结果
src/client/useLocale.ts              # 语言变化时重渲染（useSyncExternalStore 挂在 ctx.locale）
src/client/styles.ts               # 全部 CSS，四层：token / 原子 / 组件 / 宿主（模板字符串注入）
src/client/runtime.ts              # 跨 slot 的运行时共享（sessionId）
src/client/context.d.ts            # 客户端 Context 服务的类型补充
scripts/build.mjs                  # tsdown 构建 + ModuleLoader 包装（--watch 时每次重建都重新包装）
scripts/sync-desktop.mjs           # 把 lib/ 写进桌面 profile 已安装副本，借宿主热更新（--watch 常驻）
scripts/dev-desktop.mjs            # 拉起 build --watch + sync --watch 两个子进程，任一退出就收摊
scripts/verify-bundle.mjs          # 无头 bundle 校验（EXPECTED = 上面 8 项，另查三种语言词典齐备）
cordis.patch.yml                   # bundle 加载层（按包名，随 npm 包发布）
dev.patch.yml                      # 本地 --patch 开发层（绝对路径，不发布）
lib/                               # 构建产物（已提交，运行时直接读它）
```

## 依赖的产品内部约定（升级 dsh 后逐条复核）

- `[data-composer-card]` 属性存在，且主发送按钮是卡片内 DOM 顺序上最后一个 `button`；停止按钮渲染 `svg rect`；
- `user/message` 事件的内容在 `data.content`（不是 `data.message.content`）；
- 深色属性 `data-ds-dark-theme` 由 `dsh-client-ui-layout` 挂在 `body`；
- 槽位名 `shell.overlay` / `conversation.input.overlay` / `conversation.chat.node` 及其 props（`useInput`、`inputActions.setDraft`）；
- `ctx.locale` 服务存在，且内置语言是 `zh` / `en`（`register` 两参形式要求两者齐全）；`addLanguage` 的回退链必须终止于 `en`；
- 开发期依赖：`client-hmr` 挂在 web 组合包里，按 500ms 轮询 client 产物并经 `/plugins/events` 推 `rebuilt`（`sync:desktop` 的热更新路径）；
- 类名 `.nyYjTG_file`、`.I17U7q_follow` 只是几何与层叠参照，产品改版不影响功能，但会影响观感。

## 排错

| 现象 | 先查 |
|---|---|
| 划词没有工具条 / 卡片不出现 | 跑 `pnpm run check`；确认页面已刷新；Host 的 boot 图里应包含 `dsh-select-quote`（`/plugins` 路由由 `ctx.clientModules` 提供） |
| 输入框里出现协议原文 | 发送前的注入没生效：确认草稿里存在 U+200B（发送按钮应可用），以及 composer 结构未变（`[data-composer-card]`） |
| 对话记录里没有卡片 | 该 `user/message` 事件的 `data.content` 是否含批注块；卡片由 `user` 节点的 `UserMessageDisplay` 内联渲染，先查 `conversation.chat.node` 的 `user` 单元是否注册成功，再查是否被 Turn 过程折叠隐藏（见关键机制 4） |
| 带图片的消息在记录里只剩卡片、图片没了 | `UserMessageDisplay` 是否拿到了 `renderMessageImages` |
| 改了 CSS 不生效 | `<style>` 只注入一次，刷新页面 |
| `sync:desktop` 推了但客户端没变 | 报 `already matches` 说明 `lib/` 还没重建（先跑 `pnpm run watch`）；报 `no installed bundle` 说明 profile 名不对（`--profile <name>`）；都正常仍不重载，看宿主 boot 日志里有没有 `client-hmr` |
| 界面语言不跟着 dsh 变 | `pnpm run verify` 是否列出 4 项 `locale.*` 贡献；宿主是否提供 `ctx.locale`（没有则文案退到 English）；用户在设置里选的语言是否已注册 |
| 按 Backspace 删不掉 / 中文输入被打断 | 检查是否有代码在响应草稿变化时调用 `setDraft()`（见关键机制 2） |
