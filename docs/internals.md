# dsh-select-quote 实现说明（维护者向）

面向用户的介绍与安装在 [README](../README.md)。这里只记**现存**的协议、槽位与机制——改代码前先读这份。历史调查记录（含已失效的中间结论）在 [`archive/`](archive/)，只供溯源。

## 开发命令

```bash
pnpm run typecheck   # tsc --noEmit，应无输出
pnpm run build       # 产出 lib/index.js 与 lib/client.js
pnpm run watch       # 增量重建
pnpm run sync:desktop        # 把 lib/ 推给桌面客户端已安装的副本（热更新）
pnpm run sync:desktop -- --watch
pnpm run dev:desktop         # 上面两个一起开：增量重建 + 推送（scripts/dev-desktop.mjs 拉起两个子进程）
pnpm run verify      # 无头执行 lib/client.js：8 项贡献都注册上，三种语言词典键与占位符齐备，外加包展示元信息（locale + icon）按宿主规则解析、打包
pnpm run check       # typecheck + build + verify（提交前跑这个）
pnpm run release     # check → 追加 CHANGELOG.md → 提升版本号并打 tag
```

**为什么有 `verify`**：`tsdown` 不做类型检查，一个语法坏掉的 bundle 也能构建"成功"，而这是唯一能在浏览器之外发现这类错误的手段——它把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果。改动 `src/client/index.tsx` 的注册项时，记得同步 `scripts/verify-bundle.mjs` 里的 `EXPECTED`。（最初的事故现场见 [`archive/investigations.md`](archive/investigations.md)。）

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

**「打开链接」为什么用 `window.open`**：宿主自己的外链处理（`dsh-client-ui-chat` 的 `openExternalLink`）在用户把「链接打开方式」设成侧边栏时，会把 http(s) 链接塞进应用内的浏览器标签——那里加载任意 URL 就是客户端被搞崩的路径。工具条的「打开链接」因此直接 `window.open(url, '_blank', 'noopener,noreferrer')`：桌面主进程的 `setWindowOpenHandler` 只认 http/https，命中就转交 `shell.openExternal`（真·系统默认浏览器），其余协议一律 deny。所以按钮**只对 http(s) 亮起**（`selection-url.ts`），`chrome-extension://` 这类点了也不会有反应——要让它们也进系统浏览器，得宿主改那个白名单，是上游的事。检测逻辑无 DOM 依赖，`verify-bundle` 直接 import 跑用例（含全角括号/尾随标点/大小写/非 http  scheme）。

**chip 必须接住 characterData**：流式回复是**原地改文本节点**（`nodeValue` / `insertData`），这类 MutationRecord 的 `addedNodes` 是空的。观察者若只遍历 `addedNodes`，流式期间就永远不装饰——原文一直挂在那儿，直到消息 DOM 被重建（切会话、重挂载）才补上，表现就是"切个会话就好了"。所以回调里必须先分流 `record.type === 'characterData'` 并装饰 `record.target`。`verify-bundle` 有一条静态闸守这件事（`checkDirectiveObserver`）。

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

> **永远不要因为草稿变化就重写编辑器**：`inputActions.setDraft()` 的实现是 `root.clear()` + 逐行重建 + 光标移到末尾，在 `useEffect` 里依赖 `draft` 补标记会造成「删除失效」和「中文输入被打断」。所以标记由 `useDraftMarker.ts` 按 `itemCount` 变化驱动，不观察 `draft`。（事故现场见 [`archive/investigations.md`](archive/investigations.md)。）

**3. 输入框卡片布局**

`conversation.input.overlay` 的锚点是 `height: 0; position: absolute`，卡片本身也是绝对定位，因此**不会挤开下面的编辑器**，默认会盖住附件栏。做法是给 `[data-composer-card]` 加一个 `.dsq_cardPad` 类，用 `ResizeObserver` 实测卡片堆高度写进 `--dsq-quote-pad`：

```css
.dsq_cardPad { padding-top: var(--dsq-quote-pad, 88px) !important; }
```

绝对定位子元素相对**padding box** 定位，所以卡片仍在顶部，而附件栏与编辑器一起被推到它下方——这也顺带修掉了"传图时图片被卡片盖住"。

**4. 对话记录：气泡替换 + 卡片内联在 `user` 节点里**

- `UserMessageDisplay.tsx` 以 `priority: -10` 替换内置的 `user` 节点，把协议块从气泡里剥掉，**同时自己渲染消息携带的图片**——只批注、没有正文的消息气泡文本为空，若不接管图片渲染，整条消息（含图片）会消失；
- 卡片**由该组件自己渲染**（`<TranscriptQuoteCard>`），而不是注册一个独立的 `select-quote` Chat 节点；竖排顺序是 附件 → 卡片 → 气泡文本，与输入框里「卡片在草稿上方」保持一致；
- `TranscriptQuoteCard.tsx` 负责卡片本身：**每段批注一张 `AnnotationCardView`（`variant: 'transcript'`）**，纵向堆叠、与气泡同侧。卡片上直接显示**选中文本 + 用户评论**，点卡片滚回正文对应 mark——评论是用户认出自己那条批注的唯一凭据，不能只藏在悬停面板里。

> **卡片必须挂在 `user` 节点上**：`conversation.chat.node` 虽能注册任意 key，但 `ui-chat` 用 allowlist `TURN_PROCESS_INDEPENDENT_KINDS` 决定节点能否脱离「Turn 过程折叠块」；不在表里的 key 会被判为 turn-process 成员，Turn 折叠后被加 `hidden`——**挂载了、然后被隐藏**，且不报错。诊断方法：注册的节点永远先查这张表，再怀疑注册/匹配/解析链路（代码与定位过程见 [`archive/investigations.md`](archive/investigations.md)）。

**5. 正文 Mark：虚线下划线 + 末尾序号角标**

划中的文本在**原消息正文**里留下 `.dsq_annMark`：高亮色**虚线**下划线（`--dsw-static-blue-500`）+ 淡蓝底 + 圆形序号徽章。徽章是上标角标，挂在划词**末尾**（多片段选区只挂在最后一个片段），不挡阅读。定位靠 `message-text.ts`：选区落在哪条消息（`[data-chat-flow-key]`）、起止字符偏移多少——偏移在"跳过插件自身装饰节点"的纯净文本上计算，mark 本身透明（不计入偏移），所以装饰前后偏移稳定。比较时忽略空白（选区文本在段落间有换行、DOM 拼接没有）。定位随 `source` 写进 wire JSON，刷新页面后由 durable 消息重新解析、重新装饰；`annotate-text.ts` 用 MutationObserver 对抗 React 重渲染（节点被换掉就重新包）。

**6. 悬停摘要面板**

面板 **portal 到 `document.body`**：对话区的 `.I17U7q_follow` 带 `contain: layout`、滚动容器带 `container-type`，它们都是 `position: fixed` 的包含块，面板写在子树里会整体跑出屏幕。面板与摘要之间留 12px 透明"悬停桥"，指针离开集群有 320ms 宽限；resize / 滚动时面板重新定位而非失效。**默认优先放摘要上方**（`placePopover(anchor, panel, 'top', 0)`），只有上方确实放不下、且下方更宽裕时才翻到下方；gap 传 0，视觉间距与悬停桥都靠外层那 12px padding。条目序号与"选中的文本"同行，点击滚动到对应正文 mark。编辑批注**不另弹层**：点铅笔后该项在列表面板内原地展开编辑（完整原文 + 评论框 + 取消/保存）。划词工具条等**拖拽结束**（pointerup）才出现，评论弹窗居中于工具条。

**7. 划词只在对话区生效**

工具条的唯一入口是 `readSelectionSnapshot()`（`SelectionToolbar.tsx` 的 refresh 调它）：选区的 anchor 与 focus 都必须在 `[data-chat-flow-key]` 消息里（`isInsideTranscript()`），且不在输入框 / 工具条自身里。侧边栏、设置、模型选择等其它面板划词不会有任何反应——这几处没有 flow item。宿主侧确认：`ChatView` 给每条消息的 div 写 `data-chat-flow-key: routedNode.key`，分组座位也带同一个属性（属于对话区，允许划词）。

**8. 样式与主题**

卡片几何对齐产品自带的文件卡片（`ui-deliverables` 的 `.nyYjTG_file`）：`.5px` 发丝边框、18px 圆角、64px 固定高、10px 内边距、hover 背景过渡；删除按钮绝对定位右上角，仅 hover / 键盘聚焦时淡入。

- 深色模式用产品自己的 `body[data-ds-dark-theme]`（由 `dsh-client-ui-layout` 挂在 body 上），**不是** `prefers-color-scheme`；
- 颜色一律走产品 token，但**不直接写 token 名**：`styles.ts` 的分层是
  1. **token 层**：产品 token 各包一次成 `--dsq-*` 别名（`--dsq-label`、`--dsq-line`、`--dsq-shadow`…），兜底值只在这里出现一遍；别名块挂在 `body` 而不是 `:root`，因为产品在 `body[data-ds-dark-theme]` 上翻转调色板，挂在根元素会把亮色值冻结后继承进深色页；
  2. **原子层**：`.dsq_a_*`（`row` / `col` / `col-end` / `grid-mid` / `ell` / `plain` / `keep` / `grow` / `box` / `inline-row`），由 `ATOMS` 表同时生成 CSS 规则和 `A` 常量，两边不可能对不上；**只放形状，不放数字和颜色**；
  3. **组件层**：带数字的取值都留在这里，注入顺序在原子之后，所以组件规则总能盖住原子；
  4. **宿主层**：`@keyframes`、深色覆写、以及伸进产品 DOM 的那两条规则（`.dsq_cardPad` 给 composer 让位）。
  JSX 里用 `cx(styles.card, A.row)` 组合；`A.x` 和 `styles.x` 都是字面量类型，写错名字过不了 `pnpm run typecheck`；
- 同一段卡片几何在输入框和对话记录里不再各写一份：`.dsq_card` / `.dsq_cardIcon` / `.dsq_cardBody` / `.dsq_cardTitle` / `.dsq_cardSubtitle` 是共用基底，`.dsq_tCard` / `.dsq_tCardIcon` 只留真正不同的数字（宽度、40px 图标），基底里那些对 `position` / `display` 无意义的属性（如 `flex`）在 transcript 侧是惰性的；
- **三个浮层的磨砂材质用官方 material 图层同款 token**：工具条、评论气泡、悬停面板的底色与模糊都画在一个 `z-index:-1` 的 `::before` 图层上（`background: var(--dsq-menu)` + `backdrop-filter: var(--dsq-menu-backdrop)`，即宿主的 `--dsw-menu-surface-fill` / `--dsw-menu-backdrop-filter`，后者恒为 `blur(40px) saturate(150%)`，亮暗自动翻）。**必须画在独立图层上**：`backdrop-filter` 直接写在容器上会连容器自己的子树一起糊，而负 z 图层只取身后的页面。悬停面板为此把 `overflow-y: auto` 从面板挪到内层 `.dsq_summaryList`——绝对定位的图层留在会滚动的容器里会跟着内容跑掉，滚到底部时面板顶部就露空。老浏览器没有 `backdrop-filter` 时（`@supports not`）图层退成 `--dsq-bg-raised` 不透明底，避免半透明直接糊在文字上；
- **阴影统一用 `--dsw-elevation-prominent` 一档**（别名 `--dsq-shadow`）：和宿主自己的菜单/弹层同档，且它自带 `0 0 0 .5px` 的描边环（`--dsw-elevation-stroke`）——浮层因此不画 border 也有轮廓。以前工具条用 soft、两个气泡用 prominent 两档，现在合成一个别名；兜底值按真 token 的组成补齐那一圈描边。三个浮层把描边覆写成更淡的 `--dsw-alias-border-l1`（磨砂边缘自带分界，不需要再勾一道）——**覆写和 `--dsq-shadow` 的声明都必须写在浮层选择器上**：自定义属性在声明处展开，`--dsq-shadow` 留在 body 上时浮层上的覆写够不着；
- **磨砂的视觉验证只能在真实客户端里做**：本机 headless Chrome（CLI 与 MCP 两通道）不渲染 `backdrop-filter`，最小页面可复现——别把"没模糊"当代码缺陷，也别用那里的帧率数字下结论（2026-10-19 的教训，见 [`archive/investigations.md`](archive/investigations.md)）；
- **入场动画绝不带 opacity**：规范实锤祖先 `opacity<1` 会成为 backdrop root，`::before` 采样不到身后的页面，磨砂在整段淡入里消失、结束才糊上。transform 不在禁止列（用户已在真实客户端验证 scale 无恙），现行入场是 `translate(-50%,-100%) translateY(4px) scale(0.96) → 归位`；
- 样式通过 `ensureToolbarStyles()` 注入一个 `<style data-plugin-css="dsh-select-quote/toolbar.css">`，**改完 CSS 必须刷新页面**（函数只插入一次）；桌面端可用 `pnpm run sync:desktop` 热更新（见「桌面客户端的热更新」）。

**9. 装饰观察者不许自我触发**

`decorateTextNode()` 的退出条件是「严格正则零匹配」。协议头部原文里带着 `:dsh-annotation{index="N"}` 的字面量（`N` 是字母），而正则只接受数字——「含字面量、零匹配」时早期实现仍会走到 `replaceChild`，把文本换成一个内容完全相同的新 Text 节点；观察者监听着 `characterData`，回调对新节点再装饰一次，于是**它一直在装饰自己刚产出的节点**，微任务队列永远排不空，主线程单核 100%、连 `Debugger.pause` 都进不去（[issue #1](https://github.com/latte03/dsh-select-quote/issues/1)）。

两道防线（`src/client/dom/decorateAnnotationDirectives.ts`）：

1. 严格正则一次都没匹配上就在碰 DOM 之前 `return`（`if (!matched) return`）；
2. composer 全程不碰：跳过列表加入 `textarea` / `input` / `[data-lexical-editor="true"]`，因为发送瞬间草稿里会短暂出现带该字面量的协议原文。

> 凡是"改写 DOM 的观察者"都要自检这两条：**没有实际命中就不要写 DOM**，以及**别把自己输出的节点当成新输入**。（完整定位过程见 [`archive/investigations.md`](archive/investigations.md)。）

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

**11. 待发批注的持久化**

宿主**已经**按会话持久化 composer 草稿（`@deepseek-ai/dsh-client-store` 的 `defineStore({persist:'dsh.conversation'})`，实际键 `dsh.conversation.<sessionId>`，每敲一个字同步写），而 `useDraftMarker` 写的 U+200B 是草稿正文的一部分——所以这一层补的是「草稿回来了、批注列表空了」的那一半。

| 件 | 作用 |
|---|---|
| `state/annotation-persistence.ts` | 纯逻辑：载荷编解码、保留策略。不碰 DOM，`verify-bundle` 直接 import 它跑无头用例 |
| `state/annotation-storage.ts` | 环境探测：有 localStorage 就用纯 localStorage 后端，没有就退内存。单独放一份是为了让纯逻辑模块不碰 `globalThis` |
| `state/annotation-store.ts` | 内存 Map + 持久化钩子；`bindAnnotationSession()` 绑定会话并在微任务里 adopt |

- **键**：`dsh.select-quote.annotations.<sessionId>`，载荷 `{v, updatedAt, items}`。和草稿同一个形状，所以刷新、切会话、重启的行为与草稿一致。
- **写时机**：每次增删改之后立刻写（没有防抖，和草稿一样）。`clearAnnotations()` 连键一起删——发送即清，失败不回滚。
- **恢复时机**：会话 id 绑定时（composer 挂载 / 切会话）。`bindAnnotationSession` 在渲染期被调用，所以 adopt 走 `queueMicrotask`，避免在别人的 render 里 `setState`。内存里已有的条目按 id 覆盖恢复值（只可能是更新的），绑定前落在 `pending` 桶里的也会一起搬过去。
- **mark 为什么还对得上**：mark id 就是批注自己的 `id`（`ann_<时间戳>_<随机>`），而 `id` 随载荷一起存了，所以刷新后重新装饰得到同一个 mark，卡片点回去照样能找到。`index` 取列表下标，顺序也就跟着保住了。
- **保留**：最近 20 个会话 + 7 天，双条件，`apply()` 时扫一遍自己前缀。宿主自己不回收 per-session 键（本机实测留着 9 个会话的 `dsh.sidebar-right.v1.*`），所以这活儿归插件。
- **为什么不用宿主的 client-store**：新版插件规范明确**不要 require Harness Client 包**（原话：它们随时会变、纯 JS 无类型检查、抛错会把你整个 slot 条目清掉），而我们的后端选择发生在 `apply()` 的 effect 里——`defineStore().create()` 只要因为宿主改 API 而抛，就是 issue #7 那类"启动健康检查未激活 → 无错误信息的硬失败"。况且宿主的持久化底层本来就是 localStorage（构造时整值读入、每次变更整值写回、键 `${persist}.${scopeKey}`），与直接后端**同键同形**，换过来零迁移、零数据丢失；
- **对账**：挂载时双向对齐 marker 与批注列表（批注空 + 草稿有 marker → 抹掉；有批注 + marker 缺 → 补上），两边都幂等，和 `useDraftMarker` 的那次写入不冲突。**合成期间一律不写草稿**：宿主 store 的 draft 在 `compositionstart` 后会瞬态变空（候选串还没进 store），此时补写 marker 会让编辑器内容被整体替换，拼音第一个字符直接消失。`useComposing()` 在 document 捕获段听 composition 事件，对账 effect 见到就跳过；等 `compositionend`、候选文本作为一次 draft 变更落地，effect 自然会重跑。
- **不做的**：没有 sessionId 就只在内存（宿主能在打字前就 mint 好会话，这条是"不该发生"的退路）；多标签同会话 last-write-wins，不做跨页同步；hero 换工作区宿主只搬 draft + 附件，批注落在死 id 上，不处理；fork 会话宿主发全新 id，批注不继承。
- **验**：`pnpm run verify` 里用 query-bust 的 import 拿到第二个模块实例当"刷新"，跑一遍「存 → 清内存 → 回灌 → 对账 → 清除 → 保留」，另外单测 `bindAnnotationSession` 的同步发布 + 微任务 adopt。浏览器实测另算。

**12. 插件页的标题、描述、图标（包展示元信息）**

宿主**不激活插件**就能读出插件管理页与设置项里的展示信息：解析 `<包名>/locale/en.json` 发现英文入口，再枚举该目录下所有 `*.json`（文件名必须是语言 id，且都必须解析回同一个目录），读各自的 `meta.title` / `meta.description`；图标取 `<包名>/icon`（或 package.json 顶层的 `icon` 字段，优先级更高）转成 data URL。所以：

| 件 | 作用 |
|---|---|
| `locale/{en,zh,ru}.json` | 三份展示文案，`en` 是发现入口；与界面文案（`i18n.ts`）是两套东西，各管各的 |
| `icon.svg` | 36×36 对话气泡 + 加号，B2FFDA → 0099FF 渐变、透明底（面板自供背景）；≤256 KiB、自包含（data URL 里没有网络可谈，外链一律无效） |
| `package.json` | `exports` 加 `./locale/*.json` 与 `./icon`；`files` 加 `locale/*.json` 与 `icon.svg`——漏了 `files`，npm 包里的插件页就只剩默认插画 |

- **回退链**：标题 `locale meta.title → package.json name → 完整插件名`，描述 `locale meta.description → package.json description → 不显示`；字段写错（空串、非字符串）宿主出单插件诊断并保留其余文本；
- **为什么值得单独做**：没有这些，插件页显示的是技术名 `dsh-select-quote` 和默认插画——用户在两列插件列表里认不出它是干什么的；
- **验**：`checkPackageMeta()` 逐条复刻宿主的读取规则（自引用解析、语言 id、同目录、字段非空、图标类型/体积/包内路径），并跑 `npm pack --dry-run --json` 核对**实际发货清单**——`files` 写漏只有这一步能发现。改文案只改 JSON；改图标改完记得肉眼看一次渲染（文件名对不代表字节能画）。

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
src/client/state/annotation-store.ts # 每会话待发批注状态（内存 Map + 持久化钩子）
src/client/state/annotation-persistence.ts # 持久化纯逻辑：载荷、保留策略
src/client/state/annotation-storage.ts     # 环境探测（localStorage / 空），不碰 require
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
scripts/verify-bundle.mjs          # 无头 bundle 校验（EXPECTED = 上面 8 项，另查三种语言词典齐备、包展示元信息与发货清单）
cordis.patch.yml                   # bundle 加载层（按包名，随 npm 包发布）
dev.patch.yml                      # 本地 --patch 开发层（绝对路径，不发布）
docs/internals.md                  # 本文档（现存机制；历史记录在 docs/archive/）
docs/archive/                      # 历史调查记录（只读存档，结论已并入正文）
locale/                            # 插件页展示元信息（en/zh/ru 的 meta.title / meta.description，宿主不激活插件即可读）
icon.svg                           # 插件页图标（36×36 气泡 + 加号，随 npm 包发布）
lib/                               # 构建产物（已提交，运行时直接读它）
```

## 依赖的产品内部约定（升级 dsh 后逐条复核）

- `[data-composer-card]` 属性存在，且主发送按钮是卡片内 DOM 顺序上最后一个 `button`；停止按钮渲染 `svg rect`；
- `user/message` 事件的内容在 `data.content`（不是 `data.message.content`）；
- 深色属性 `data-ds-dark-theme` 由 `dsh-client-ui-layout` 挂在 `body`；
- 槽位名 `shell.overlay` / `conversation.input.overlay` / `conversation.chat.node` 及其 props（`useInput`、`inputActions.setDraft`）；
- `ctx.locale` 服务存在，且内置语言是 `zh` / `en`（`register` 两参形式要求两者齐全）；`addLanguage` 的回退链必须终止于 `en`；
- 开发期依赖：`client-hmr` 挂在 web 组合包里，按 500ms 轮询 client 产物并经 `/plugins/events` 推 `rebuilt`（`sync:desktop` 的热更新路径）；
- 插件页展示元信息的读取约定：`<包名>/locale/en.json` 为发现入口、同目录其余 `*.json` 为各语言词典、`<包名>/icon` 为图标，全部经 Node ESM 解析且**不激活插件**（见关键机制 12）；这些路径必须在 `exports` 与 `files` 里都出现；
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
