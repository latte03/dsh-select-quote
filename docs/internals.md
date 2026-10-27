# dsh-select-quote 实现说明（维护者向）

面向用户的介绍与安装在 [README](../README.md)。这里只记**现存**的协议、槽位与机制——改代码前先读这份。历史调查记录（含已失效的中间结论）在 [`archive/`](archive/)，只供溯源。

## 开发命令

```bash
pnpm run typecheck   # tsc --noEmit，应无输出
pnpm run test        # Vitest 纯逻辑用例（角标/定位/配置/快捷键矩阵）
pnpm run build       # 产出 lib/index.js 与 lib/client.js
pnpm run watch       # 增量重建
pnpm run sync:desktop        # 把 lib/ 推给桌面客户端已安装的副本（热更新）
pnpm run sync:desktop -- --watch
pnpm run dev:desktop         # 上面两个一起开：增量重建 + 推送（scripts/dev-desktop.mjs 拉起两个子进程）
pnpm run verify      # 无头执行 lib/client.js：10 项贡献都注册上，三种语言词典键与占位符齐备，外加包展示元信息（locale + icon）按宿主规则解析、打包
pnpm run check       # typecheck + test + build + verify（提交前跑这个；CI 同款）
pnpm run release     # check → 追加 CHANGELOG.md → 提升版本号并打 tag
```

**为什么有 `verify`**：`tsdown` 不做类型检查，一个语法坏掉的 bundle 也能构建"成功"，而这是唯一能在浏览器之外发现这类错误的手段——它把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果。改动 `src/client/index.tsx` 的注册项时，记得同步 `scripts/verify-bundle.mjs` 里的 `EXPECTED`。（最初的事故现场见 [`archive/investigations.md`](archive/investigations.md)。）

**本地跑起来**：把 `dev.patch.example.yml` 复制成 `dev.patch.yml`（后者已 gitignore），插件路径必须是**绝对路径**（checkout 不在 profile 的 `node_modules` 里，Loader 没有包名可解析）。换机器/换目录时改那一行；本地 patch 不进仓库、不随 npm 包发布，发布版走 `cordis.patch.yml`（按包名）。

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

- 读取：`scanAnnotatedMessage()` 剥掉整块，气泡只剩用户正文。展示层只认完整的开闭标记对：JSON 非法或不是数组时不产出批注，但块照样剥掉，协议原文永不出现在对话里；
- 回填：`readComposedDraft()` 是 `composeAnnotatedMessage()` 的逆。dsh-rewind 撤回时把它读到的持久文本原样写回输入框（`messageTextAt` → `setComposerText`），协议块也会跟着进编辑器；`AnnotationPanel` 检测到完整块后把批注重新挂回待发摘要、草稿还原成用户正文（见关键机制 1）。回填比展示保守：只认完整、JSON 合法且非空数组的块，被截断或手改过的块不碰；
- 回指：协议头要求模型对它处理过的每条批注内联 `:dsh-annotation{index="N"}`，客户端 `decorateAnnotationDirectives.ts` 把这些指令渲染成 chip。chip 的 hover / focus / click 都打开预览浮层（触屏点按同样只开预览），原文和评论由 `transcript/quote-registry.ts` 按用户消息 flow key 暂存，chip 通过前一条 mark 的 flow key 取回；跳转由浮层标题栏右侧的小按钮「原文」触发，点 chip 本身不再直接跳。取不到 registry 时退回 mark 文本并隐藏评论区。浮层在 `dom/chipPreview.ts`，body 级 fixed（消息表面的 contain: layout 会劫持 fixed 定位），复用 `placePopover` 做翻转/钳位（默认在上方），内容层用和批注卡列表相同的 `dsq-rise-in`（只动 transform），退场用反向的 `dsq-rise-out`、120ms 后才摘节点；滚动和缩放时重排，chip 被流式重渲染替换时自动关闭；mark 不可见或已被移除时按「批注摘要卡 → 批注所属用户消息 → quote.messageId 来源消息」逐级回退并闪烁，不再点了没反应；正文 mark 复用同一浮层：最后一个片段（带角标）有 `role=button` / `tabIndex=0` 和本地化 aria-label，点击或 Enter/Space 打开预览，待发批注按 store id 取原文/评论，历史批注按 `dqsm_` id 走 quote-registry，预览里不出现「原文」按钮；绑定用 document 级委托，宿主重渲染替换 mark 不会泄漏监听；
- **改格式要一起改**：`composeAnnotatedMessage()`（写）、`scanAnnotatedMessage()`（读）、`readComposedDraft()`（撤回回填）、`ANNOTATION_DIRECTIVE_RE`（chip）、`scripts/verify-bundle.mjs`。

**「打开链接」为什么用 `window.open`**：宿主自己的外链处理（`dsh-client-ui-chat` 的 `openExternalLink`）在用户把「链接打开方式」设成侧边栏时，会把 http(s) 链接塞进应用内的浏览器标签——那里加载任意 URL 就是客户端被搞崩的路径。工具条的「打开链接」因此直接 `window.open(url, '_blank', 'noopener,noreferrer')`：桌面主进程的 `setWindowOpenHandler` 只认 http/https，命中就转交 `shell.openExternal`（真·系统默认浏览器），其余协议一律 deny。所以按钮**只对 http(s) 亮起**（`selection-url.ts`），`chrome-extension://` 这类点了也不会有反应——要让它们也进系统浏览器，得宿主改那个白名单，是上游的事。检测逻辑无 DOM 依赖，`verify-bundle` 直接 import 跑用例（含全角括号/尾随标点/大小写/非 http  scheme）。

**chip 必须接住 characterData**：流式回复是**原地改文本节点**（`nodeValue` / `insertData`），这类 MutationRecord 的 `addedNodes` 是空的。观察者若只遍历 `addedNodes`，流式期间就永远不装饰——原文一直挂在那儿，直到消息 DOM 被重建（切会话、重挂载）才补上，表现就是"切个会话就好了"。所以回调里必须先分流 `record.type === 'characterData'` 并装饰 `record.target`。`verify-bundle` 有一条静态闸守这件事（`checkDirectiveObserver`）。

### 遗留：`> [选中文本]` 引用块

旧版把引用写成 Markdown 引用块。现在**不再写入**，只在 `quote-protocol.ts` 里保留读取与剥离能力（`parseQuoteMessage()` / `displayTextWithoutQuote()`），用于渲染历史消息。新消息一律走上面的 JSON 块。

## 客户端贡献

| 位置 | 类型 | 说明 |
|---|---|---|
| `shell.overlay` | list slot | `select-quote-toolbar`（order 100）：划词工具条 + 评论气泡。挂 root 级，切会话/看历史都不会失去观察 |
| `conversation.input.overlay` | list slot | `select-quote-card`（order 20）：输入框内的批注摘要；`select-quote-session-bridge`（order 1）：只负责把 `sessionId` 发布给 root 工具条 |
| `conversation.chat.node` | keyed slot | `user`（`priority: -10`）：替换内置用户气泡，剥掉协议块并渲染批注摘要块 |
| `plugins.bundle.config` | keyed slot | 按包名 `dsh-select-quote`：插件页**外层**（描述与行列表之间）直接渲染的分段控件、快捷键开关，以及开关下方从宿主 catalog 读取的当前键位；注册包在 `ctx.configForms.whileServed(['select-quote'], …)` 里，表单控制器经 slot `inject` 传入 |
| `ctx.shortcuts` | 命令 | `select-quote.openMenu` / `select-quote.addToTask`：`shortcut` 开启时一起注册；无选区返回 `blocked`，评论步骤未完成时也返回 `blocked`，命中时经 `runtime.selection` 打开菜单 / 保存批注并开评论框；设置区订阅 `ctx.shortcuts.catalog` 显示当前键位；缺该服务时插件照常工作（见机制 15） |
| `ctx.sessions` | 客户端服务 | 读会话摘要的 `origin`，让侧边子代理会话不接管主会话绑定（见机制 16） |
| `ctx.modelDirectories` | 客户端服务（可选） | 读主会话的模型目录快照，给侧边提问的模型 chip 提供分组、搜索与推理等级；只读，不调用 `select()`（见机制 16） |
| `remote.selectQuoteSideTask` | Typert Remote | Host 服务 `SelectQuoteSideTask` 经 `exports["./typert"]` 清单自动注册；客户端 `ctx.remote.$mount` 后按命名空间调用 `create(agentId, { prompt, label })`，返回 `childId`（见机制 16） |
| `ctx.locale` | 语言服务 | `addLanguage(ru)` + `register('select-quote', {zh,en})` + `register('select-quote','ru',…)` + `bind('select-quote')`，见下面第 10 节 |

不再注册 `select-quote` Chat 节点，也不再注册 Conversation Definition——摘要块内联在 `user` 节点里，原因见下面第 4 节。

## 关键机制

**1. 批注不进草稿，只在发送瞬间注入**

摘要块不是草稿的"可视化"，而是唯一的表示。草稿始终保持用户真正输入的内容，JSON 块在**发送动作的捕获阶段**才折进去：`document` 上的 `keydown`（宿主会提交的 Enter 手势：Enter / Ctrl+Enter / Cmd+Enter；Shift+Enter 换行，Alt、AltGraph 与 IME 合成不提交，判定见 `composer-host.ts` 的 `isSubmitKey`）或 `click`（composer 卡片内 DOM 顺序上的最后一个 `button`，且不是停止按钮——停止按钮渲染的是 `svg rect`）。捕获阶段早于 composer 自己的处理器，因此它读到的草稿已经包含批注块。见 `src/client/composer/useSendIntercept.ts`。

反向路径只有一个入口：**检测到完整协议块**。dsh-rewind 撤回时直接读持久消息的 `data.content` 并把文本写回 composer（不经过本插件），协议块也会跟着进编辑器。`AnnotationPanel` 的 layout effect 用 `readComposedDraft()` 把块拆回批注与正文：批注带 `source` 定位重新挂回待发摘要（`restoreAnnotations()`，同 text+comment 去重），编辑器里只留用户自己写的字。触发条件是**完整且 JSON 合法**的块；发送手势刚折进去的那份由 `foldingRef` 排除，普通地提到 `<response-annotations>` 的草稿不会被改写，IME 合成期间也一律跳过。展示层（`scanAnnotatedMessage()` 与回显剥离）的分工不同：只要开闭标记完整就剥掉，不要求 JSON 可读。写入时 JSON 里的 `<` 会转义成 `\u003c`（选中文本或评论自带闭合标记也不会提前截断）；读旧消息时按候选闭合位置逐个试解析，兼容没有转义的历史块。

**2. 不可见字符 U+200B 让发送按钮保持可用**

草稿为空时 composer 会把发送按钮置灰（`empty = draft.trim() === "" && attachments.length === 0`），而 U+200B 不是 JS 的 WhiteSpace，`trim()` 不会去掉它，于是"只有批注、没打字"也能直接发送。它只在**新增/移除批注**时写入或清除一次，发送前由 `stripDraftMarker()` 剔除，绝不进消息。

> **永远不要因为草稿变化就重写编辑器**：`inputActions.setDraft()` 的实现是 `root.clear()` + 逐行重建 + 光标移到末尾，在 `useEffect` 里依赖 `draft` 补标记会造成「删除失效」和「中文输入被打断」。所以标记由 `useDraftMarker.ts` 按 `itemCount` 变化驱动，不观察 `draft`。（事故现场见 [`archive/investigations.md`](archive/investigations.md)。）

**3. 输入框摘要布局**

`conversation.input.overlay` 的锚点是 `height: 0; position: absolute`，摘要容器本身也是绝对定位，因此**不会挤开下面的编辑器**，默认会盖住附件栏。做法是给 `[data-composer-card]` 加一个 `.dsq_cardPad` 类，用 `ResizeObserver` 实测摘要高度写进 `--dsq-quote-pad`：

```css
.dsq_cardPad { padding-top: var(--dsq-quote-pad, 88px) !important; }
```

绝对定位子元素相对**padding box** 定位，所以摘要仍在顶部，而附件栏与编辑器一起被推到它下方——这也顺带修掉了"传图时图片被摘要盖住"。

**4. 对话记录：委托宿主视图 + 摘要块内联在 `user` 节点里**

- `UserMessageDisplay.tsx` 以 `priority: -10` 替换 `user` 与 `steering` 两个节点（宿主把同一个 `UserMessageNodeView` 注册在这两个 key 下），但**不重画气泡、附件和动作行**：`host-user.ts` 从 `ctx.slots.entries('conversation.chat.node')` 里按 **key + 组件身份**排除自己，再找 `componentName() === 'UserMessageNodeView'` 的那条（兼容 memo 的 `.type.name` 与 forwardRef 的 `.render.name`），原样渲染 `<UserMessageNodeView {...kitProps} node={rewrittenNode} />`。宿主若改名，只有一个非自己候选时才敢用它；候选多于一个就返回 `undefined`，走下面的纯文本回退，不赌顺序。`rewrittenNode` 只改 `data.content`：把协议块从文本块里剥掉（完整块无论 JSON 是否合法都剥），图片/文件/其它块保留。时间、复制、附件、文件卡片、引用摘要，以及所有往动作行 portal 的插件（dsh-rewind 的 ↶）都仍由宿主渲染；宿主升级或别的插件改这一行，这里自动跟上（[issue #8](https://github.com/latte03/dsh-select-quote/issues/8)）。
- 委托的是宿主组件，所以 session 注册必须带 `locale: 'chat'`，让宿主拿到它自己的 `t`（复制/已复制等文案）；kit 的其余 props（`renderFactorySlot`、`loadImage`、hooks）原样透传。
- 摘要块（`<TranscriptQuoteCard>`）是唯一新增的 DOM，放在委托组件**前面**：顺序是 摘要块 → 宿主 `userRow`。只改文本时不渲染空泡——`text` 为空时宿主自己的 `showBubble` 也会跳过；批注-only 消息因此只剩摘要块与宿主动作行。
- 宿主视图解析失败（宿主改了内部组件名）时退回只读文本气泡，**绝不补一份私有的动作行**：宁可降级，也不要重新长出一份会跟宿主漂移的 chrome。
- `TranscriptQuoteCard.tsx` 渲染**一个** `AnnotationSummary`（和输入框完全同款）：块上只显示条数，悬停列表里逐条展示**选中文本 + 用户评论**，点条目滚回正文对应 mark。一条消息无论有几条批注都只有一个块——不要退回"一条批注一张卡"的排布。
- **发送瞬间还有一层宿主 UI**：本地回显气泡（`[data-submission-echo]`）由聊天流直接渲染提交文本，不经过 `conversation.chat.node`，慢接口下会把整段协议摆在屏幕上；运行中提交的消息还会在排队面板（`[data-queue-dock]`）里按原始 wire 内容预览同样的协议块。`dom/stripSubmissionEcho.ts` 在这两类表面上做展示层剥离：回显行本身或最深叶子持有完整块就改写（被会话 chip 拆分的结构不动）；队列预览走宿主的 `conversation.user.text` 工厂，文本被拆成逐词 `<span>`，开/闭标签永远不在同一叶子里，因此改为重写**最内层同时持有两端的纯文本容器**（每条排队行一个，行的图标/操作按钮不动），完整块的 JSON 非法或不是数组也照剥；持久消息里的块不受影响。MutationObserver 只看新增节点与 `characterData`，命中行后在下一帧统一处理；剥离是幂等的，宿主重建文本节点后还能再剥一次。`pnpm run verify` 的 `TRANSCRIPT SURFACE` 闸同时守回显、排队预览和单块摘要，剥离部分有 DOM 桩行为用例。

> **摘要块必须挂在 `user` / `steering` 节点上**：`conversation.chat.node` 虽能注册任意 key，但 `ui-chat` 用 allowlist `TURN_PROCESS_INDEPENDENT_KINDS` 决定节点能否脱离「Turn 过程折叠块」；不在表里的 key 会被判为 turn-process 成员，Turn 折叠后被加 `hidden`——**挂载了、然后被隐藏**，且不报错。诊断方法：注册的节点永远先查这张表，再怀疑注册/匹配/解析链路（代码与定位过程见 [`archive/investigations.md`](archive/investigations.md)）。

**5. 正文 Mark：虚线下划线 + 末尾序号角标**

划中的文本在**原消息正文**里留下 `.dsq_annMark`：高亮色**虚线**下划线（`--dsw-static-blue-500`）+ 淡蓝底 + 圆形序号徽章。徽章是上标角标，挂在划词**末尾**（多片段选区只挂在最后一个片段），不挡阅读。**徽章绝对定位、不占行内宽度**：加批注不会改变段落换行、也不会把后面的字挤走；跨行选区时用 `bottom` 而不是 `top` 定位——inline 包含块的底边才是最后一行，`top` 会按第一行算，徽章飞到段首。角标用 `z-index: 2` 压在原生选区高亮和后续 mark 的底色之上：选区贴到角标、或相邻批注的底色盖过来时，数字仍完整可见。**多个批注结尾重合或靠得很近**时，`dom/badge-layout.ts` 的 `placeBadges()` 做纯几何贪心避让：每个角标先试原位，再向右错开两格（每格 28px），还冲突就向上叠（每格 18px），同时受滚动容器右/上边界约束；结果写成 `--dsq-ann-badge-x/y`，由 `::after` 的 `transform` 应用，仍不参与文本排版；resize 与相关消息的重渲染会重新测量，并清掉不再需要的偏移。

**只有角标是点击目标**：`::after` 单独声明 `pointer-events: auto` 与 `cursor: pointer`；标记本身不能设 `pointer-events: none`——那会把正文的鼠标划选一并掐掉。点击收尾时 `chipPreview.ts` 用 `badgeHitBox()`（角标绘制位置 + 避让偏移 + 3px 容差，宽度按位数估）做命中判定，落在正文上的 click 直接忽略；键盘/辅助技术的激活事件不带可用坐标，走最后一个片段的 Tab 焦点与 Enter。定位靠 `message-text.ts`：选区落在哪条消息（`[data-chat-flow-key]`）、起止字符偏移多少——偏移在"跳过插件自身装饰节点"的纯净文本上计算，mark 本身透明（不计入偏移），所以装饰前后偏移稳定。比较时忽略空白（选区文本在段落间有换行、DOM 拼接没有）。定位随 `source` 写进 wire JSON，刷新页面后由 durable 消息重新解析、重新装饰。

**重渲染只扫受影响的消息**：`annotate-text.ts` 的 MutationObserver 按 mutation record 收集 flow item（target 所属的消息；新增节点可能是若干条新消息的包装层，取子树；删除的节点已断开，不必处理），合并到下一帧后调 `applyAnnotationMarks(root, only)`。该路径只对 `messageId` 命中的 job 重新定位/包裹；无定位的 job 也只在这些消息里搜索。嵌套在消息里的推理面板等 block 也有自己的 flow key，所以被改动的 block 会按**自身与所有祖先 key**归属，消息级 job 仍能命中。角标避让按消息 block 分组测量，向上叠不会爬进上一条消息，也不再每帧遍历整个对话。只有 job 注册表变化（upsert / 删除）与 resize 走全量扫描；`requestAnimationFrame` 在页面隐藏时会暂停，回到可见时再补这一帧。

**6. 悬停摘要面板**

面板 **portal 到 `document.body`**：消息内容里有带 `contain: layout` 的表面、滚动容器带 `container-type`，它们都会成为 `position: fixed` 的包含块，面板写在子树里会整体跑出屏幕。面板与摘要之间留 12px 透明"悬停桥"，指针离开集群只有 40ms 宽限（够跨桥，退场动画随即开始）；resize / 滚动时面板重新定位而非失效。**默认优先放摘要上方**（`placePopover(anchor, panel, 'top', 0)`），只有上方确实放不下、且下方更宽裕时才翻到下方；gap 传 0，视觉间距与悬停桥都靠外层只在朝向摘要一侧留的 12px padding（左右不留，面板卡面因此与摘要左缘对齐）。面板退场时保留节点 120ms 播 `dsq-rise-out` 再卸载，期间 `pointer-events: none`。条目序号与"选中的文本"同行，点击滚动到对应正文 mark。编辑批注**不另弹层**：点铅笔后该项在列表面板内原地展开编辑（完整原文 + 评论框 + 取消/保存）；编辑期间指针离开、点击面板外导致失焦都不关闭面板，退出编辑后才恢复关闭；编辑目标按批注 `id` 记录，删除其他条目不会串到旁边的批注。划词工具条等**拖拽结束**（pointerup）才出现，评论弹窗居中于工具条。

- **键盘**：摘要卡可聚焦；Enter 展开并把焦点移到面板第一个控件，↓ 在已展开时进入面板；Tab / Shift+Tab 在面板内循环，Esc 关闭并把焦点还给摘要卡。面板是 React portal 子节点，keydown 会按 React 树冒泡回摘要卡，所以面板处理过的键要 `stopPropagation()`，否则摘要卡的 Tab 会抢回第一个控件。
- **触屏**：`(hover: none), (pointer: coarse)` 下提示从「悬停查看批注」切成「点按查看批注」；`pointerup` 的 `pointerType === 'touch'` 时点按摘要展开，`pointerleave` 不触发自动关闭（触屏抬手也会发 pointerleave），点外部关闭。操作按钮在 coarse 指针下为 44px；角落关闭按钮保留视觉尺寸，用 `::after` 扩展命中区。
- **触屏的划词 chrome**：coarse pointer 下工具条和评论泡改走 `document.body` 级 fixed，不再挂滚动容器。操作条贴 visual viewport 底部（`visualViewport` 算软键盘 inset，再加 `env(safe-area-inset-bottom)`），评论是底部抽屉：带上选中原文预览、输入框 16px 防 iOS 聚焦缩放、按钮 44px，`maxHeight` 跟 visual viewport 走。抽屉打开时不自动聚焦评论框，关闭后也不把焦点抢回 composer，避免软键盘第二次弹出。细指针（鼠标）仍走内容坐标 + 滚动容器裁剪。

**7. 划词只在对话区生效**

工具条的唯一入口是 `readSelectionSnapshot()`（`SelectionToolbar.tsx` 的 refresh 调它）：选区的 anchor 与 focus 都必须在 `[data-chat-flow-key]` 消息里（`isInsideTranscript()`），且不在输入框 / 工具条自身里。侧边栏、设置、模型选择等其它面板划词不会有任何反应——这几处没有 flow item。宿主侧确认：`ChatView` 给每条消息的 div 写 `data-chat-flow-key: routedNode.key`，分组座位也带同一个属性（属于对话区，允许划词）。右键接管和快捷键桥复用同一个准入：工具条读不到的选区也打不开菜单（见机制 15）。

**8. 样式与主题**

摘要块、工具条和评论泡都复用宿主的材质/阴影 token（见下），不再有独立的文件卡片几何。

- 深色模式用产品自己的 `body[data-ds-dark-theme]`（由 `dsh-client-ui-layout` 挂在 body 上），**不是** `prefers-color-scheme`；
- 颜色一律走产品 token，但**不直接写 token 名**：`styles.ts` 的分层是
  1. **token 层**：产品 token 各包一次成 `--dsq-*` 别名（`--dsq-label`、`--dsq-line`、`--dsq-shadow`…），兜底值只在这里出现一遍；别名块挂在 `body` 而不是 `:root`，因为产品在 `body[data-ds-dark-theme]` 上翻转调色板，挂在根元素会把亮色值冻结后继承进深色页；
  2. **原子层**：`.dsq_a_*`（`row` / `col` / `col-end` / `grid-mid` / `ell` / `plain` / `keep` / `grow` / `box` / `inline-row`），由 `ATOMS` 表同时生成 CSS 规则和 `A` 常量，两边不可能对不上；**只放形状，不放数字和颜色**；
  3. **组件层**：带数字的取值都留在这里，注入顺序在原子之后，所以组件规则总能盖住原子；
  4. **宿主层**：`@keyframes`、深色覆写、以及伸进产品 DOM 的那两条规则（`.dsq_cardPad` 给 composer 让位）。
  JSX 里用 `cx(styles.summary, A.row)` 组合；`A.x` 和 `styles.x` 都是字面量类型，写错名字过不了 `pnpm run typecheck`；
- 输入框与对话记录复用同一套摘要组件与样式（`.dsq_summary` / `.dsq_summaryHover`）；历史侧只多一层 `.dsq_tSummary` 负责右对齐与宽度上限，不再有“一条批注一张卡”的独立几何；
- **浮层的磨砂材质用官方 material 图层同款 token**：工具条、评论气泡、悬停面板、右键菜单以及触屏/预览浮层的底色与模糊都画在一个 `z-index:-1` 的 `::before` 图层上（`background: var(--dsq-menu)` + `backdrop-filter: var(--dsq-menu-backdrop)`，即宿主的 `--dsw-menu-surface-fill` / `--dsw-menu-backdrop-filter`，后者恒为 `blur(40px) saturate(150%)`，亮暗自动翻）。**必须画在独立图层上**：`backdrop-filter` 直接写在容器上会连容器自己的子树一起糊，而负 z 图层只取身后的页面。悬停面板为此把 `overflow-y: auto` 从面板挪到内层 `.dsq_summaryList`——绝对定位的图层留在会滚动的容器里会跟着内容跑掉，滚到底部时面板顶部就露空。老浏览器没有 `backdrop-filter` 时（`@supports not`）图层退成 `--dsq-bg-raised` 不透明底，避免半透明直接糊在文字上；
- **阴影统一用 `--dsw-elevation-prominent` 一档**（别名 `--dsq-shadow`）：和宿主自己的菜单/弹层同档，且它自带 `0 0 0 .5px` 的描边环（`--dsw-elevation-stroke`）——浮层因此不画 border 也有轮廓。以前工具条用 soft、两个气泡用 prominent 两档，现在合成一个别名；兜底值按真 token 的组成补齐那一圈描边。所有浮层都把描边覆写成更淡的 `--dsw-alias-border-l1`（磨砂边缘自带分界，不需要再勾一道）——**覆写和 `--dsq-shadow` 的声明都必须写在浮层选择器上**：自定义属性在声明处展开，`--dsq-shadow` 留在 body 上时浮层上的覆写够不着；
- **磨砂的视觉验证只能在真实客户端里做**：本机 headless Chrome（CLI 与 MCP 两通道）不渲染 `backdrop-filter`，最小页面可复现——别把"没模糊"当代码缺陷，也别用那里的帧率数字下结论（2026-10-19 的教训，见 [`archive/investigations.md`](archive/investigations.md)）；
- **入场动画绝不带 opacity**：规范实锤祖先 `opacity<1` 会成为 backdrop root，`::before` 采样不到身后的页面，磨砂在整段淡入里消失、结束才糊上。transform 不在禁止列（用户已在真实客户端验证 scale 无恙），现行入场是 `translate(-50%,-100%) translateY(4px) scale(0.96) → 归位`；内容顶部没地方放时工具条翻到首行下方（`data-anchor="below"`），换成 `dsq-toolbar-in-below` 关键帧；
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

**即时切换**：React 侧经 `useLocale()`（`useSyncExternalStore` 挂在 `subscribe` 与 `revision` 上）重渲染；chip 和正文 mark 是直接写 DOM 的，所以在 `apply()` 里订阅一次 `refreshDirectiveChips()` / `refreshAnnotationMarkLabels()` 重写文案。写 DOM 的订阅不会触发第 9 节那个循环——新文本不含指令字面量，`decorateTextNode()` 在入口就返回。

**复数**：宿主的词典是「键 → 单个模板字符串」，没有复数概念。带 `{count}` 的文案因此拆成 `key.one` / `key.few` / `key.many` / `key.other`，由 `i18n.ts` 按语言挑形式，挑不到就退 `key.other`。`pnpm run verify` 按复数组比对三种语言：组必须都存在，且**每组必须有 `.other`**，占位符名也不允许漂移——漏一个键会渲染出键名本身，漏一个占位符会把 `{count}` 直接印在界面上。

**11. 待发批注的持久化**

宿主**已经**按会话持久化 composer 草稿（`@deepseek-ai/dsh-client-store` 的 `defineStore({persist:'dsh.conversation'})`，实际键 `dsh.conversation.<sessionId>`，每敲一个字同步写），而 `useDraftMarker` 写的 U+200B 是草稿正文的一部分——所以这一层补的是「草稿回来了、批注列表空了」的那一半。

| 件 | 作用 |
|---|---|
| `state/annotation-persistence.ts` | 纯逻辑：载荷编解码、保留策略。不碰 DOM，`verify-bundle` 直接 import 它跑无头用例 |
| `state/annotation-storage.ts` | 环境探测：有 localStorage 就用纯 localStorage 后端，没有就退内存。单独放一份是为了让纯逻辑模块不碰 `globalThis` |
| `state/annotation-store.ts` | 内存 Map + 持久化钩子；`bindAnnotationSession()` 绑定会话并在微任务里 adopt；`adoptStorageAnnotations()` 处理其它标签的 storage 变更 |

- **键**：`dsh.select-quote.annotations.<sessionId>`，载荷 `{v, updatedAt, items}`。和草稿同一个形状，所以刷新、切会话、重启的行为与草稿一致。
- **写时机**：每次增删改之后立刻写（没有防抖，和草稿一样）。`clearAnnotations()` 连键一起删——发送即清，失败不回滚。
- **恢复时机**：会话 id 绑定时（composer 挂载 / 切会话）。`bindAnnotationSession` 在渲染期被调用，所以 adopt 走 `queueMicrotask`，避免在别人的 render 里 `setState`。内存里已有的条目按 id 覆盖恢复值（只可能是更新的），绑定前落在 `pending` 桶里的也会一起搬过去。**重绑定本身也是一次发布**：新会话没有任何可恢复条目时（分叉出的全新会话），`adoptPersistedAnnotations` 什么都不改、返回 false，`bindAnnotationSession` 仍在微任务里补一次 `notify()`——「待发批注 → 正文 mark」的 job 同步（`syncPendingAnnotationJobs`）据此按**新分区**重读，旧会话的 job 被丢弃、正文 mark 被摘除；否则分叉会话里会出现「划词还在、批注卡没了」的错位（卡读新分区已经消失，mark 是全局注册表重渲染又画回来的）。原会话分区原样停在 `bySession` 与存储里，切回去时卡与 mark 一起恢复，无数据丢失。同一 tick 内连续绑定两次时只有最后一次算数：被覆盖的那次在微任务里发现活动会话已变，直接跳过 adopt——不发布、不搬 `pending` 桶；它的存储原样保留，等下次绑回该会话再恢复。
- **跨标签**：`apply()` 的持久化 effect 监听 `window.storage`，按 `dsh.select-quote.annotations.<sessionId>` 重新加载并**替换**本地分区（last-write-wins）。本地每次变更都同步写存储，所以收到事件时内存只会比存储旧；替换而不是合并，才不会把另一个标签已经发送清空的批注复活。`key === null`（`localStorage.clear()`）时重读本标签持有的全部分区。非活动且未缓存的分区忽略，绑定会话时自然会读存储。
- **mark 为什么还对得上**：待发批注的 mark id 就是批注自己的 `id`（`ann_<时间戳>_<随机>`），随载荷一起存，刷新后重新装饰得到同一个 mark；历史侧由 `TranscriptQuoteCard` 生成 `dqsm_<消息flowKey>_<序号>`，同一条消息内稳定。`index` 取列表下标，摘要条目点回去照样能找到；删除前面的批注时，`applyAnnotationMarks` 会同步已有 mark 的 `data-dsq-ann-index`，不重新包裹文本，摘要与正文角标始终一致。
- **保留**：最近 20 个会话 + 7 天，双条件，`apply()` 时扫一遍自己前缀。宿主自己不回收 per-session 键（本机实测留着 9 个会话的 `dsh.sidebar-right.v1.*`），所以这活儿归插件。
- **为什么不用宿主的 client-store**：新版插件规范明确**不要 require Harness Client 包**（原话：它们随时会变、纯 JS 无类型检查、抛错会把你整个 slot 条目清掉），而我们的后端选择发生在 `apply()` 的 effect 里——`defineStore().create()` 只要因为宿主改 API 而抛，就是 issue #7 那类"启动健康检查未激活 → 无错误信息的硬失败"。况且宿主的持久化底层本来就是 localStorage（构造时整值读入、每次变更整值写回、键 `${persist}.${scopeKey}`），与直接后端**同键同形**，换过来零迁移、零数据丢失；
- **对账**：挂载时双向对齐 marker 与批注列表（批注空 + 草稿有 marker → 抹掉；有批注 + marker 缺 → 补上），两边都幂等，和 `useDraftMarker` 的那次写入不冲突。**合成期间一律不写草稿**：宿主 store 的 draft 在 `compositionstart` 后会瞬态变空（候选串还没进 store），此时补写 marker 会让编辑器内容被整体替换，拼音第一个字符直接消失。`useComposing()` 在 document 捕获段听 composition 事件，对账 effect 见到就跳过；等 `compositionend`、候选文本作为一次 draft 变更落地，effect 自然会重跑。
- **不做的**：没有 sessionId 就只在内存（宿主能在打字前就 mint 好会话，这条是"不该发生"的退路）；hero 换工作区宿主只搬 draft + 附件，批注留在原会话 id 的分区里、不跟着搬，切回原会话时按上面的重绑定语义恢复（宿主若换发新 id 则不会回来）；fork 会话宿主发全新 id，批注不继承——但重绑定必发布（见上），分叉会话里划词与批注卡同进同退，不会只剩划词一边。跨标签只做 last-write-wins，不做字段级合并（跨页同时编辑同一条时后写覆盖）。
- **验**：`pnpm run verify` 里用 query-bust 的 import 拿到第二个模块实例当"刷新"，跑一遍「存 → 清内存 → 回灌 → 对账 → 清除 → 保留」，另用两个实例共享一份 Map 存储验证跨标签写入/清空/回填；单测 `bindAnnotationSession` 的同步切分区 + 微任务 adopt、分叉重绑定必发布、同一 tick 被覆盖的 bind 不 adopt。浏览器实测另算。
- **手工自验（分叉会话）**：原会话正文里选一段加上批注（不发送）→ 用宿主的分叉入口分叉 → fork 会话里该段不应有下划线与角标、输入框没有批注卡 → 切回原会话，下划线与批注卡一起恢复（`dsh.select-quote.annotations.<原 sessionId>` 仍在存储里）。
- **性能实测（2026-10-22，dsh 0.2.1-rc.2，Chrome）**：34 条批注 / 98 条消息，流式 15.6s 采样 937 帧，p95 17.2ms、最大 33.3ms，无 >50ms 长任务；滚动 + 工具条跟随 120 帧，p95 17.5ms、无长任务；JS heap 61MB → 61MB。空闲期优化：没有 job 时不调度 mark 的 rAF，没有待剥离表面时不调度回声的 rAF。历史 `dqsm_*` job 与已渲染批注一一对应；当前宿主不卸载旧消息，未观察到随时间增长，暂不做卸载清理（宿主若引入虚拟列表需补）。`bySession` 只保留有未发批注的会话，持久化本身限制 20 个会话 / 7 天。

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

**13. 工具条的生命周期：跟着选区走，不跟着选区死**

工具条不是「出现后常驻」的面板，存亡完全由**当前选区**决定，`refresh()` 是唯一入口（`pointerup` / `selectionchange` / `keyup` / `resize` / `scroll` 都只是触发它）：

- **出现**：拖拽结束（`pointerup`）后读一次活选区——非空、在对话区、不在输入框/工具条自身里；
- **挂载**：`dom/floating-layer.ts` 从选区所在的 flow item 往上找**真正的滚动容器**（桌面抽屉布局是 `.ST7X_W_scrollBody`，此时 `.icaHSq_scroll` 的计算 overflow 是 visible；普通布局是 `.icaHSq_scroll`），在容器里挂一个零尺寸的 absolute host（必要时把容器补成 `position: relative`），浮层 portal 进去。坐标是**相对滚动内容**的，所以滚动时工具条/评论泡随正文一起走，不需要逐帧重定位；容器负责裁剪——滚到容器上边缘就滑进 header 下面，和正文一致。host 的 `z-index` 平时 **6**：低于 composer seat 的 7（不穿过输入框），高于内容里吸顶元素的 6；**评论步骤打开期间抬到 8**——摘要卡在 composer 座位里、会伸进滚动区，z 6 的评论泡会被它盖住；关闭评论立即还原，空闲工具条仍不会压输入框；
- **跟随**：滚动时仍会触发 `refresh()`（合并同一 tick 的多次事件），但选区的**内容坐标**不变，`setActive` 去重后不重渲染。真正需要重排的只有 resize / 布局变化，以及内容顶部选中时改为挂在首行下方的翻转（`below`）；
- **收起**：选区真的没了、或**选中行的首行完全滚出视口**（`isFirstLineOnScreen`，没有可锚定的东西了）。滚回去会重新出现；半可见时由容器裁剪，不再用视口边缘钳位；
- **评论气泡例外**：`refresh` 只在 `idle` 相位收起工具条，`comment` 相位一律不动。评论泡与工具条共享同一套内容坐标，滚动时一起走；**垂直位置以整个选区的下边缘**（`selectionBottom`）为准，先试选区下方、放不下再放到工具条上方——不会盖住正在评论的文字。**「下方」的可用边界是 composer seat 的顶边，不是滚动容器自己的盒子**（`floating-layer.ts` 的 `bounds().bottom` 取两者较小值）：桌面布局里 composer 是 sticky、z-7 覆盖在滚动容器下半段，用容器盒子会把评论泡放到输入框底下（[data-composer-seat]，缺失时退回 [data-composer-card]；seat 从当前滚动容器沿祖先链就近解析，不取文档里第一个，避免多窗格时钳到别的输入框）。评论阶段工具条本身（「添加批注…」提示）改放到评论泡**上方、左对齐**，底边距评论泡顶边 6px；顶部空间不够时翻到评论泡下方。它和评论泡的重排都由 `placeCommentPop` 负责。评论框换行/变高时在 layout effect 里重排（滚动本身不重排），首帧不会闪位。**「添加到任务」即保存**：批注在打开评论步骤时就已写进 store（摘要块同时出现），评论只是它的可选补充。点空白处只是关闭评论泡，已保存的批注不撤销，已输入的评论会顺手写回该条批注；Esc / 「暂不评论」显式丢弃评论文本，批注仍在。`pendingIdRef` 记录这次要编辑的批注 id，`flushComment()` 是唯一的写回口。
- **触屏不走这套**：coarse pointer 下工具条/评论泡换成了 body 级 fixed 的底部操作条与评论抽屉（见机制 6 的触屏条目），因为系统选择菜单和软键盘占据了选区锚定所需的同一块空间；`placeCommentPop` 在触屏下直接返回，评论阶段也不再抬 host 的 z-index。

**14. 配置：Host 持有，client 通过 configForms 跟随**

- **Host 半**（`src/index.ts`）导出 schemastery `Config`，字段全部 `.volatile()`：`triggerMode`（`auto` / `contextmenu` / `both`，默认 `auto`）与 `shortcut`（默认 `false`）。只有 volatile 字段进入设置镜像，普通字段不可编辑。`lib/index.js` 现在由 `tsdown.host.config.ts` 编译，schemastery 打进产物——发布包不依赖 profile 如何解析宿主包。`apply(ctx, config)` 收到的是 volatile 引用，读取用 `.get()`。
- **client 拿不到 `apply` 的配置**。`src/client/config.ts` 在嵌套的 `ctx.inject(['configForms'], …)` 里按**行 id**（`select-quote`，不是包名）取 `configForms.get(ROW_ID)`，把快照 `value` 归一化后发布到模块级 store；缺服务、`loading`、非法枚举都落在默认 `auto/false`。`ROW_ID` 与 `PACKAGE_NAME` 只在 `src/shared/identity.ts` 定义；两份 patch 的行 id 由 verify 对齐。
- **配置区不是 `Config` 的副产物**：注册 `plugins.bundle.config`（key = 包名 `dsh-select-quote`），宿主把它渲染在插件页的**外层**——描述与行列表之间，不需要再进入某一行的「配置」页。Host 对这个槽位**不传 `form`**（只有 `plugins.row.config` 的 page 才传），所以注册项用 slot 的 `inject` 面把 `scope.configForms.get(ROW_ID)` 的控制器交给组件；组件用 `useSyncExternalStore` 订阅快照，写入走控制器的 `set(field, value)`。注册仍包在 `configForms.whileServed([ROW_ID], …)` 里：namespace 不在 describe 镜像中时不出现配置区，也不留半死的表单；`locale` 座位填 `select-quote`，文案走同一套词典。页面里有三块内容：`triggerMode` 分段控件、`shortcut` 开关、开关下方两条快捷键命令的**当前生效键位**。键位另有来源：`shortcut-menu.ts` 订阅 `ctx.shortcuts.catalog`，把本插件两条命令的 `label` / `keys` / `issue` / `conflicts` 发布到模块级 store，`ConfigRow` 用 `useSyncExternalStore` 读取；开关关闭、命令未注册时列表不显示，撞键或未绑定时分别显示提示，用户在宿主「快捷键」设置里改键后这里不问刷新就更新。
- **控件点击即提交**：`form.set('triggerMode' | 'shortcut', value)`。控制器负责写入排队、revision 与失败后的恢复；Host 校验后持久化到 profile 的用户层 patch（`id: select-quote` 下的 `config.*`），刷新/重启由 Host 重新解析；其它标签页改值会经设置文档推过来，`subscribeConfig()` 触发 `refresh()` / 快捷键重注册，工具条与命令即时跟上。
- **读取点在事件里**：`SelectionToolbar.refresh()` 每次都用 `resolveTriggers(getConfig()).auto` 判断，不是渲染时快照；触屏不受 `triggerMode` 影响，始终走底部操作条。`shortcut` 独立于 `triggerMode`，由 `shortcut-menu.ts` 在开启时向宿主注册命令（见机制 15）。
- **改字段要同步**：`src/index.ts` 的 `Config`、`src/client/config.ts` 的 `DEFAULT_CONFIG` / `normalizeConfig`、`ConfigRow` 组件、三份词典与 verify 的 host/client 对齐断言。verify 会直接加载 `lib/index.js` 核对字段集合、默认值、`.volatile()` 与非法值拒绝，并跑一次没有 `configForms` 的降级 `apply()`。

**15. 右键菜单与快捷键：只在选区上接管**

- **判定是纯矩阵**（`dom/menu-trigger.ts`，verify 直接 import 跑用例）：`shouldOpenSelectionMenu()` 要求 `contextMenuEnabled`（`triggerMode` 为 `contextmenu` / `both`）、非触屏、`!event.defaultPrevented`、右键目标在对话区（`isInsideTranscript`）、指针点落在选区的某一段 client rect 内（`pointInRects` 逐行判断，2px 容差）、选区非空，全部为真才接管。工具条/菜单自身和评论阶段不参与。
- **顺序**：新右键先关掉已打开的本插件菜单；`defaultPrevented` 最先检查，给别的插件让路；只有条件全过、且成功读到快照之后才同步 `preventDefault()` + `stopPropagation()`，再以**指针坐标**开菜单。任何一项不满足就完全不碰事件——选区外右键、编辑器/侧栏右键、别人处理过的右键都保留宿主原生菜单。
- **菜单**（`SelectionMenu.tsx`）：portal 到 `document.body`，fixed、z 64；`placePopover` 以指针为锚点默认朝下，放不下时翻转/钳位。测量完成前 `visibility:hidden`，避免首帧闪在原点。**指针打开时焦点落在菜单容器本身**（`tabIndex=-1`，没有任何条目预先高亮），快捷键打开时才把焦点给第一项，Enter 可直接执行；两者都在 placement 提交后的 layout effect 里做（hidden 元素无法聚焦）。悬停条目会把焦点移到该条目，键盘与鼠标只保留一个高亮。入场只动 transform（`dsq-menu-in` / `dsq-menu-in-up`），不带 opacity；条目由 `linkTarget(snapshot.text, snapshot.anchorHref)` 决定是否多一个「打开链接」。外部 pointerdown / 外部 contextmenu / 页面滚动（捕获）/ resize / window blur / Escape / Tab 关闭；菜单内部的 contextmenu 只 preventDefault，不再弹第二层。键盘支持 ↑/↓ 循环（从容器起步时 ↓ 到第一项、↑ 到最后一项）、Home/End、Enter。
- **关菜单必须同步失效 ref**：`dismissMenu()` 先把 `menuRef.current` 置空，再 `setMenu(null)`，然后调用方才能 `refresh()`。`refresh()` 在 `contextmenu` 模式里靠 `!menuRef.current` 判断该不该清掉 `active`；只调 `setMenu(null)` 的话 ref 要等下一次 render 才更新，紧跟其后的同步 refresh 会以为菜单还开着，把 `active` 留下，菜单关闭后自动工具条就冒出来（表现为空白点击后闪一下、按住 Esc 时一直悬着）。空白点击、右键改口、设置切换、选中文字变化都走同一个出口；`both` 模式下 refresh 会重新抬起工具条，这是预期。
- **快捷键桥**：工具条在非触屏时发布 `runtime.selection = { state, open, add }`。`state()` 按当前相位返回 `ready` / `busy`（评论步骤已开）/ `no-selection`。`open` 从**选区首行下边缘**（`selectionFirstLineRect()`）锚定，不用鼠标位置；`add` 读同一份选区后走 `beginComment()`，保存批注并打开评论框，与菜单里的「添加到任务」是同一条路径。`shortcut-menu.ts` 在 `shortcut` 开启时向 `ctx.shortcuts` 注册两条命令：`select-quote.openMenu` 与 `select-quote.addToTask`，都是 `regions: ['page']`、`modals: []`、label 走 i18n。默认键位按 profile 写死：桌面 macOS `⌘L` / `⇧⌘L`；桌面 Windows/Linux 的菜单是 primary+shift+L、添加是 primary+shift+Period（不用 Alt：`Ctrl+Alt+L` 在多种布局上是 AltGr 字符，且桌面壳会先于输入区判定消费快捷键）；Web macOS 是 primary+shift+L / primary+alt+L，Web Windows 同桌面；**Web Linux 只能声明宿主允许的组合**，`primary+Slash` 已被宿主的快捷键面板占用，所以菜单是 primary+shift+Comma、添加是 primary+shift+Period（声明 `KeyL` 会让 `register()` 抛错）。`resolve()` 在桥缺失或无选区时返回 `blocked` +「先在对话里选中一段文字」，评论步骤未完成时返回 `blocked` +「先完成当前批注」，否则 `handled` + `run`。注册/注销严格跟随设置，两条命令各自 try/catch；与别的插件撞键时只 warn，工具条与菜单继续可用。设置区的键位列表订阅 `ctx.shortcuts.catalog`（见机制 14），改键或冲突即时反映。
- **桌面原生菜单**：Harness 的 Electron 主进程在 `webContents.on('context-menu')` 里对任何非空 selection 弹原生 Copy 菜单。渲染进程在 `contextmenu` 里同步 `preventDefault()` 会抑制它（2026-10-23 在 Harness 0.2.1-rc.2 实测：命中选区时只有本插件的菜单；点选区外时本插件不接管，原生 Copy 照常弹出）。这条依赖 Chromium 的 contextmenu 默认行为；宿主若改成异步或独立通道弹菜单，必须重新验证。
- **边界**：触屏没有右键，也不发布快捷键桥（底部操作条仍然是唯一入口）；`triggerMode` 只影响入口，「添加到任务」之后的所有流程与原来一致。

**16. 侧边提问：先输入，发送时才创建 fork 子代理**

- **交互**：工具条「在侧边提问」只把相位切换到 `side`，复用评论泡的定位与层带放一个悬浮输入框。点击的瞬间**不调用宿主**——没有消息的会话不能创建子代理。输入框里用插件自己的批注块展示选中的原文（复用 `.dsq_summary` 的徽章/标题/底色，正文 3 行截断，宽屏与触屏共用 `SideQuote`），底部是宿主 composer 同款的控制行：左边模型 chip、右边取消/发送。批注块是 `width: 100%` 的边框盒，`box-sizing` 必须显式写 `border-box`，否则内边距和描边会把它顶出输入框；侧边相位的输入框额外挂 `.dsq_commentPopSide`（384px），评论相位保持 320px。点「发送」后 `runtime.sideTask(snapshot, question, model)` 用 `composeQuotedMessage()` 把问题与选中原文组成主会话同款的 `<response-annotations>` 协议块（原文带 `messageId` / 偏移，侧栏卡片因此能定位回源消息），创建成功才打开侧边对话；失败留在输入框里并显示「侧边提问创建失败」。创建时的 `label` 用「在侧边提问 · 问题前 24 字」，宿主的侧栏标签页标题和父会话子智能体目录都读这个字段，所以同一会话里多次侧边提问仍能区分。宿主的 `startActivation.request` 只有 `prompt: ContentBlock[]`（文本/图片），没有独立的隐藏上下文字段，所以协议块仍在消息内容里；显示层会把它剥掉——侧栏用户气泡只剩问题，顶部渲染同款批注摘要卡，fork 继承的历史消息里原文带划词标记，回答中的 `:dsh-annotation` 也照常变成 chip。⌘/Ctrl+Enter 发送，Esc 取消。
- **模型覆盖**：输入框左下角的模型 chip 由 `src/client/model/ModelSelect.tsx` 提供——宿主 composer 模型位的移植：触发按钮显示模型 + 推理等级，菜单是「模型 / 推理等级」两级单元格，目录超过 4 条时出现搜索（宿主同款有序子序列排序），键盘 ↑/↓、Tab、Enter、Esc 与宿主一致。数据来自 `ctx.modelDirectories.directoryFor(主会话 id)` 的只读面（`store` + `load()`），选择只写回侧边提问的本地状态（`null` = 跟随主会话，也是每次打开时的默认值），发送时以 `request.model` 过网关；Host 把它转成 `agentOptions: {provider, model, reasoningEffort?}`，由 fork provider 合并到父会话路由。**不调用 `directory.select()`**，主会话模型不变；换模型但没给 effort 时，宿主会清掉继承的 effort，让新模型取自己的默认值。宿主的 `conversation.input.model.label` 子槽位会给官方 Flash 挂固定 `1017` 标签（`@deepseek-ai/dsh-client-ui-deepseek-model-label-1017`：仅 `deepseek-account` / `deepseek-official` 下 `deepseek-flash` 且名称恰为 `DeepSeek-V4.1-Flash`），插件渲染不了宿主子槽位，所以在 `model/label.ts` 复刻判定，触发按钮、模型单元格和选项行都走同一个 `ModelLabel`。子代理会话自己的输入框里没有模型入口——宿主在 `subagentAddress` 非空时把模型位整个隐藏（`available=false`），所以换模型只能在新一次侧边提问里选。
- **宿主半**：`SelectQuoteSideTask.create(agent, request)` 用 `ctx.subagents.startActivation({provider: 'fork', delivery: 'caller', request: {parent: agent, prompt, agentOptions?}, signal})` 建子代理，返回 `{childId}`。fork 让子代理继承父会话**已完成**的轮次作为上下文；`delivery: 'caller'` 抑制父会话收到的结算通知，`origin: 'subagent'` 让子会话不进入普通会话列表。
- **复用模式**：设置项 `sideTaskMode`（`separate` 默认 / `reuse`，volatile 字段，客户端经 `configForms` 读同一份值）决定每次提问是否新建子代理。`reuse` 时客户端在请求里带 `reuse: true`，宿主用 `reusableChildId(父会话 id)`（sha256 折成 UUID 形状）得到**确定性**子会话 id：第一次用 `startActivation({childId})` 预留这个 id，之后走 `subagents.prompt({requestId, parentSessionId, childSessionId, mode: 'continuable', delivery: 'queue', content}, signal)` 续投——它带冷恢复，所以宿主重启后仍是同一个子代理；只有 `not-resumable`（还没有这个子会话）才回退到同 id 新建，其余拒绝（容量、授权、运行中）原样抛出，避免悄悄分叉出第二个。复用模式下输入框不显示模型 chip（`SelectionToolbar` 按配置跳过 directory），子代理沿用创建时的路由，继承的上下文也停在第一次 fork；目录因此只保留一条。切回 `separate` 后恢复每次新建与模型选择。
- **客户端半**：拿 `childId` 后 `scope.sidebarRight.openResource('dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=continuable', {kind: 'subagentchat'})`，侧栏用宿主内置的 subagent chat 面板渲染子会话，追问经它自己的 composer 走 `subagents/prompt`。
- **两半怎么连上**：`src/shared/side-task-remote.ts` 是唯一的方法描述（服务名、方法名、`wire: 'agentId'`、入参/出参编解码），`src/typert.ts` 把它导出成清单，`src/client/remote.ts` 用同一份描述 `$mount`。宿主端 `src/side-task-service.ts` 必须同时满足三条：暴露**可见的** `typertRemote` 绑定、类原型上挂 `@deepseek-ai/dsh-typert-protocol/remote-methods` 标记（`{version: 1, methods: [{method: 'create', invocation: {kind: 'direct'}}]}`）、清单经 `exports["./typert"]` 被 `typert-loader` 自动注册。`direct` 调用要传完整参数 `(agentId, request)`；网关回包是 `{ok: true, value}` / `{ok: false, error}`，客户端必须解包再取 `childId`。
- **会话归属**：侧边聊天也会挂 `conversation.input.overlay`，子会话的 `SessionBridge` 会把它的 id 绑过来。子代理会话的绑定被 `runtime.isSubagentSession`（读 `ctx.sessions.list` 摘要的 `origin`）挡掉，主会话绑定保持不变；否则下一次侧边提问会拿子会话当 parent，宿主直接拒绝（`session "…" is owned by subagent routing`）。子会话自己的批注仍按显式 `sessionId` 分区读写，不受这条守卫影响。

## 浮层名词与层带

改样式/层级前先认名字（z-index 一栏是**各自层叠上下文内**的值，不能横向直接比大小）：

| 名称 | 类名 | 挂载位置 | z-index | 作用 |
|---|---|---|---|---|
| 工具条 | `.dsq_toolbar` | 对话滚动容器内的 `[data-dsq-layer]` host | 2（host 6 / 评论阶段 8） | 复制 / 添加到任务 / 打开链接；评论阶段缩成提示 |
| 状态提示 | `.dsq_status` | 同上 | 3 | 复制失败等瞬时提示 |
| 评论泡 | `.dsq_commentPop` | 同上 | 1 | 可选评论框；放在整个选区下方，放不下时改到工具条上方；评论阶段「添加批注…」提示条在它上方左对齐、间距 6px。侧边提问复用同一浮层（原文引用 + 问题输入 + 取消/发送） |
| 触屏操作条 | `.dsq_touchBar` | `document.body`（fixed） | 60 | coarse pointer 下替代工具条：复制 / 添加到任务 / 打开链接，贴 visual viewport 底部 |
| 触屏评论抽屉 | `.dsq_touchSheet` | 同上 | 62（遮罩 61） | coarse pointer 下替代评论泡：选中原文预览 + 可选评论 + 跳过/添加 |
| 悬浮摘要 | `.dsq_summaryHover` | `document.body`（fixed） | 14 | 摘要块的悬停列表（composer 与历史消息共用） |
| 右键菜单 | `.dsq_ctxMenu` | `document.body`（fixed） | 64 | 选区上右键或快捷键打开的菜单：复制 / 打开链接 / 添加到任务；滚动、外部点击、resize 或失焦即关闭 |
| 模型菜单 | `.dsq_modelMenu` | `document.body`（fixed） | 1100 | 侧边提问的模型选择：模型 / 推理等级两级菜单、搜索、分组标题吸顶；样式与键盘对齐宿主 composer 的模型位 |
| 摘要块 | `.dsq_summary` | composer 内（`conversation.input.overlay`）/ 历史用户气泡上方 | 13（composer）/ 1（历史） | 「N 条批注」入口；历史侧外包 `.dsq_tSummary` 右对齐。历史卡必须留在内容层，否则会盖住 6/8 的评论泡 |
| 摘要容器 | `.dsq_cardStack` | composer 卡片内 | 12 | 输入框上方的摘要容器 |

- 工具条/状态/评论泡共用一个 host：平时 host 的 6 低于 composer seat 的 7，又被滚动容器裁剪，所以既不会穿过输入框，也会随正文滑进 header 下面（机制 13）。评论步骤打开时 host 抬到 8，让评论泡盖过伸进滚动区的摘要卡；关闭即还原。三者的内部次序是 status 3 > toolbar 2 > commentPop 1。
- 摘要块/摘要容器在 composer seat（z 7，自成层叠上下文）内部，12/13 只在 composer 内比较；悬浮摘要是 body 级 fixed，14 属于页面根层叠上下文。
- 右键菜单必须留在 body：它要逃出对话滚动容器的裁剪，且**不随内容滚动**（一滚就关，避免指向已经移走的行）；64 低于宿主菜单的 100，宿主自己的菜单/弹层仍能盖住它。

## 目录结构

```
.github/workflows/check.yml        # CI：push/PR 上跑 pnpm run check
src/index.ts                       # Node 半：导出 schemastery Config（triggerMode / shortcut，全部 volatile）并注册 SelectQuoteSideTask
src/shared/identity.ts             # 包名、Loader 行 id、配置槽 key 的唯一来源
src/shared/side-task-remote.ts     # 侧边提问的方法描述（Host 清单与客户端贡献共用）
src/shared/side-task-reuse.ts      # 复用模式：确定性子会话 id 与 not-resumable 判定
src/shared/remote-info.ts          # RemoteInfo / NamedInput / ResultValue 的最小实现（不 require 宿主协议包）
src/typert.ts                      # Host Typert 清单（exports["./typert"] 自动注册）
src/side-task-service.ts           # Host 服务：fork 子代理并返回 childId
src/client/remote.ts               # 客户端 Typert 贡献：$mount 同一份方法描述
src/client/index.tsx               # Client 半入口：注册 Slot、配置跟随、语言词典与装饰观察者
src/client/config.ts               # 配置默认值/归一化/resolveTriggers + configForms 订阅发布
src/client/settings/ConfigRow.tsx  # 插件页外层的配置区（划词入口 + 快捷键开关 + 当前键位列表，订阅 row 表单与宿主 catalog）
src/client/selection/SelectionToolbar.tsx # 划词控制器：状态机、批注保存、评论/侧边提问、动作与快捷键桥（state/open/add）
src/client/selection/useSelectionWatcher.ts # 指针/选区/右键/滚动的监听编排（只管何时 refresh）
src/client/selection/useCommentPlacement.ts # 评论泡与提示条的测量/落位生命周期（`side` 相位复用）
src/client/selection/ToolbarView.tsx # 纯视图：桌面工具条/评论泡、触屏底栏/抽屉、状态提示、侧边提问输入框
src/client/selection/SelectionMenu.tsx # 右键/快捷键菜单（body portal、键盘导航、外部关闭）
src/client/shortcut-menu.ts        # 宿主快捷键命令 openMenu / addToTask（按设置注册/注销；镜像 catalog 供设置页）
src/client/dom/menu-trigger.ts     # 右键接管纯判定：触发矩阵 + 点落选区矩形
src/client/composer/AnnotationPanel.tsx      # 输入框内批注摘要 + 发送动作拦截 + 撤回协议块还原
src/client/composer/useSendIntercept.ts      # 发送手势时把待发批注折进草稿
src/client/composer/useDraftMarker.ts        # U+200B 让"只有批注"时发送按钮可用
src/client/dom/selection.ts        # 选区快照、工具条定位、复制、聚焦输入框
src/client/dom/floating-layer.ts   # 找到对话滚动容器，挂内容坐标的浮层 host（裁剪 + 层带）
src/client/ui/touch.ts             # coarse pointer / visualViewport 探测（触屏底部操作条与抽屉）
src/client/model/types.ts          # 模型目录的只读面与选择类型
src/client/model/rank.ts           # 宿主同款有序子序列搜索排序（纯逻辑，可单测）
src/client/model/ModelSelect.tsx   # 宿主 composer 模型位的移植：两级菜单、搜索、键盘、跟随主会话
src/client/model/label.ts          # 官方 Flash 的 1017 发布标签判定（宿主 label 子槽位的本地复刻）
src/client/dom/message-text.ts     # 消息纯净文本遍历、选区→字符偏移定位
src/client/dom/annotate-text.ts    # 正文 mark（下划线+序号徽章）的注册表与装饰
src/client/dom/badge-layout.ts     # 角标碰撞避让的纯几何（右移两格→向上叠，带边界）
src/client/dom/scrollToAnnotation.ts # 点击批注滚动到正文 mark 并闪烁
src/client/dom/stripSubmissionEcho.ts # 发送回显气泡里剥掉协议块（只改展示）
src/client/dom/decorateAnnotationDirectives.ts # 模型回的 :dsh-annotation{index="N"} 渲染成可点 chip
src/client/dom/chipPreview.ts      # chip 的 hover/focus/click 预览 + 正文 mark 的点击/键盘回看（共用浮层）
src/client/dom/popoverPlacement.ts # 浮层定位（翻转 + 视口夹取）
src/client/dom/comment-placement.ts # 评论泡/提示条的纯几何（上下翻转 + 夹取，可单测）
src/client/dom/composer-host.ts    # composer DOM 约定（[data-composer-card] 等）
src/client/state/annotation-store.ts # 每会话待发批注状态（内存 Map + 持久化钩子）
src/client/state/annotation-persistence.ts # 持久化纯逻辑：载荷、保留策略
src/client/state/annotation-storage.ts     # 环境探测（localStorage / 空），不碰 require
src/client/protocol/annotation-protocol.ts # 批注 wire 格式（含 source 定位）
src/client/protocol/quote-protocol.ts      # 旧 > 引用块协议 / U+200B 标记 / 文本工具
src/client/transcript/host-user.ts     # 从 slot registry 按 key 解析宿主 UserMessageNodeView（纯逻辑，verify 直接 import）
src/client/transcript/TranscriptQuoteCard.tsx # 对话记录里的批注摘要块（单个块 + 悬停列表）
src/client/transcript/quote-registry.ts # 用户消息 flow key → 解析后的 quotes（chip 预览取原文/评论）
src/client/transcript/UserMessageDisplay.tsx  # 替换用户气泡：委托宿主 UserMessageNodeView，只改文本块并前置摘要块
src/client/ui/AnnotationCardView.tsx  # 摘要块与悬停列表面板（portal 到 body、内联编辑）
src/client/ui/icons.tsx               # 内联 lucide 图标（pencil / trash / x / copy / plus）
src/client/i18n.ts                   # 三份词典（zh / en / ru）、复数形式挑选、把 t() 转给宿主 bind 结果
src/client/useLocale.ts              # 语言变化时重渲染（useSyncExternalStore 挂在 ctx.locale）
src/client/styles.ts               # 全部 CSS，四层：token / 原子 / 组件 / 宿主（模板字符串注入）
src/client/runtime.ts              # 跨 slot 的运行时共享（sessionId、selection 快捷键桥、sideTask、子代理会话判定）
src/client/context.d.ts            # 客户端 Context 服务的类型补充
scripts/build.mjs                  # host 编译到 lib/index.js、typert 清单到 lib/typert.js，再跑 client tsdown 构建与 ModuleLoader 包装
tsdown.host.config.ts              # Host 半构建配置（ESM / Node，bundle schemastery）
tsdown.typert.config.ts            # Typert 清单构建配置（bundle zod，避免宿主解析依赖）
scripts/sync-desktop.mjs           # 把 lib/ 写进桌面 profile 已安装副本，借宿主热更新（--watch 常驻）
scripts/dev-desktop.mjs            # 拉起 build --watch + sync --watch 两个子进程，任一退出就收摊
scripts/verify-bundle.mjs          # 无头 bundle 校验（EXPECTED = 上面 10 项，另查配置链路、三种语言词典、包展示元信息与发货清单）
cordis.patch.yml                   # bundle 加载层（按包名，随 npm 包发布）
dev.patch.example.yml              # 本地 --patch 开发层模板（复制为 gitignored 的 dev.patch.yml）
docs/internals.md                  # 本文档（现存机制；历史记录在 docs/archive/）
docs/archive/                      # 历史调查记录（只读存档，结论已并入正文）
locale/                            # 插件页展示元信息（en/zh/ru 的 meta.title / meta.description，宿主不激活插件即可读）
icon.svg                           # 插件页图标（36×36 气泡 + 加号，随 npm 包发布）
lib/                               # 构建产物（已提交，运行时直接读它）
```

## 依赖的产品内部约定（升级 dsh 后逐条复核）

- `[data-composer-card]` 属性存在，且主发送按钮是卡片内 DOM 顺序上最后一个 `button`；停止按钮渲染 `svg rect`；
- 桌面（overlay）布局里 `[data-composer-seat]` 是 sticky、z 7 的输入区，**滚动容器的盒子会延伸**到它背后——浮层可放置区域的下边界要取它的顶边；seat 要从当前滚动容器的祖先链里就近找，不能取 `document` 里第一个（多窗格会钳错）；
- 提交瞬间宿主渲染本地回显 `[data-submission-echo]`（含 `clock: start` 动作行），走 `conversation.chat.user.content` / `conversation.user.text` 工厂，不经过 `conversation.chat.node`；运行中提交的消息在排队面板 `[data-queue-dock]` 里用同一份 wire 内容渲染预览（`_7yHdaG_preview`，类名带 hash，只认 dock 属性）；这两处都要做展示层剥离；
- `user/message` 事件的内容在 `data.content`（不是 `data.message.content`）；
- 深色属性 `data-ds-dark-theme` 由 `dsh-client-ui-layout` 挂在 `body`；
- 槽位名 `shell.overlay` / `conversation.input.overlay` / `conversation.chat.node` 及其 props（`useInput`、`inputActions.setDraft`）；
- `ctx.slots.entries('conversation.chat.node')` 可枚举全部条目（包括被遮蔽的宿主条目）；宿主把同一个 `UserMessageNodeView` 同时注册在 `user` 与 `steering` 两个 key 下，`component.type.name` 是 `UserMessageNodeView`、`options` 只有 `key`（没有 `priority`）——插件自己的注册项要用组件身份排除，不能靠 `priority` 值（解析时还要按 key 过滤，两个 key 的宿主项不能互相借用）；宿主改名时只有唯一的非自己候选才可退用，多候选必须走纯文本回退。委托渲染时要把 kit 里的 `renderFactorySlot`、`loadImage` 与 hooks 原样透传，并给注册项声明 `locale: 'chat'`——否则宿主的复制/已复制文案拿不到词典。`conversation.chat.user.content` 工厂（子槽 `conversation.chat.user.images` 渲染图片）由宿主视图自己调用，插件不再直接碰；**`renderMessageImages` 不是 0.2.1-rc.2 的宿主 prop**；
- `ctx.locale` 服务存在，且内置语言是 `zh` / `en`（`register` 两参形式要求两者齐全）；`addLanguage` 的回退链必须终止于 `en`；
- `ctx.configForms`（`dsh-client-ui-settings`）提供 `get(<Loader 行 id>)`、`whileServed(namespaces, register)` 与表单的 `getSnapshot` / `subscribe` / `set` / `unset` / `mutate`。插件页有两个配置槽：`plugins.row.config`（key 为 `<包名>#<行 id>`，页面以 `view: 'page'` 收到 `{ form: { state, mutate } }`）和 `plugins.bundle.config`（key 为包名，渲染在**包页外层**的描述与行列表之间，只传 `view: 'page'`，**不传 form**——组件要自己 `configForms.get(<行 id>)`，并可用 slot 注册项的 `inject` 面把控制器注入 props）。带设置区的 `dsh.client.inject` 需要列出 `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-ui-plugin-manager`、`@deepseek-ai/dsh-api-remotes`；
- `ctx.shortcuts`（`@deepseek-ai/dsh-client-shortcuts`，可选注入）：`register({id,label,aliases,defaults,regions,modals,resolve})` 会为全部 runtime/platform 预检默认值并在撞键、非法 Web 组合、保留键时抛错（必须 try/catch）；默认值按 `desktop:macos|windows|linux` / `web:macos|windows|linux` 给，Web Linux 只接受 `primary+Slash`、`primary+shift+Comma`、`primary+shift+Period`，其中 `primary+Slash` 被宿主的 `shortcuts.open` 占用；`resolve` 返回 `handled`（带 `run`）/ `blocked`（带 `reason`）/ `pass`。`ctx.shortcuts.catalog` 是当前窗口所有命令的生效行（`id` / `label` / `keys` / `issue` / `conflicts`，`keys` 已是平台化 keycap 文案），订阅它可在宿主改键或冲突后同步 UI。`dsh.client.inject` 里也要列出它，缺服务时本插件只少快捷键入口；
- **Typert 远程（0.2.1-rc.3 复核）**：`package.json` 的 `exports["./typert"]` 清单会被 `dsh-typert-loader` 自动注册；`wire: 'agentId'` 的 lookup 经 session controller 解析，子代理拥有的会话会被拒绝（`owned by subagent routing`）。服务实例必须有**可见的** `typertRemote`（`{service, serviceKey, namespace}`），类原型上挂 `@deepseek-ai/dsh-typert-protocol/remote-methods` 标记（`{version: 1, methods: [{method, invocation: {kind: 'direct'}}]}`），否则网关报 `gateway/binding-invalid`；客户端 `ctx.remote.$mount(contribution)` 后以动态服务 `remote.<namespace>` 调用，回包是 `{ok: true, value}` / `{ok: false, error}`；`direct` 调用传完整参数（`agentId` + request）；
- `ctx.subagents.startActivation({provider: 'fork', delivery: 'caller', request: {parent, prompt, agentOptions}, signal})` 返回 `{childId}`；fork 继承父会话已完成的轮次，`delivery: 'caller'` 抑制父会话的结算通知，子会话摘要带 `origin: 'subagent'`（因此不在普通会话列表）。侧边对话资源是 `dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=continuable`，由 `ctx.sidebarRight.openResource(address, {kind: 'subagentchat'})` 打开；`ctx.sessions.list` 快照里的 `byId[id].origin` 是判定「是否子代理会话」的唯一依据；`dsh.client.inject` 要列出 `@deepseek-ai/dsh-api-gateway` 与 `@deepseek-ai/dsh-client-ui-sidebar-right`；
- **模型目录（0.2.1-rc.3 复核）**：`ctx.modelDirectories`（`@deepseek-ai/dsh-client-ui-model-selection`）的公开面是 `directoryFor(sessionId)`，返回 `{store: {getSnapshot, subscribe}, load(), select()}`；快照含 `groups`（provider → models，模型可带 `reasoning.defaultEffort` / `reasoning.efforts`）、`current`、`status`、`failures`、`error`。`directoryFor` 要求会话已有 binding，未知会话抛错；对子代理会话 `load()` / `select()` 抛 `model selection is unavailable for addressed subagent sessions`，读目录要用**主会话**的 directory。宿主自己的 `ModelSelect` 组件不导出（模块只导出 `ModelDirectory` / `ModelDirectoryResolver` / `apply` / `inject`），且插件不能 require 客户端包，所以 UI 是移植实现；`agentOptions` 由 fork provider 声明支持并合并到父路由；
- 桌面 Electron 主进程在 `webContents.on('context-menu')` 里对非空 `selectionText` 弹原生 Copy 菜单（`app/lib/main.js`）；渲染进程在 `contextmenu` 里同步 `preventDefault()` 可以抑制它（2026-10-23 在 0.2.1-rc.2 实测）。升级 dsh 后右键验证要覆盖「选区上只有我们的菜单」与「选区外只有原生菜单」两条；
- dsh-rewind 的撤回读持久 `user` / `steering` 节点的文本块（`block.type === 'text'`）并原样写回 composer——消息里的任何文本协议都会回到编辑器，所以本插件必须能把它反向还原（见关键机制 1）；
- 开发期依赖：`client-hmr` 挂在 web 组合包里，按 500ms 轮询 client 产物并经 `/plugins/events` 推 `rebuilt`（`sync:desktop` 的热更新路径）；
- 插件页展示元信息的读取约定：`<包名>/locale/en.json` 为发现入口、同目录其余 `*.json` 为各语言词典、`<包名>/icon` 为图标，全部经 Node ESM 解析且**不激活插件**（见关键机制 12）；这些路径必须在 `exports` 与 `files` 里都出现；
- **对话滚动容器与浮层挂载（0.2.1-rc.2 复核）**：`_6Qf49G_frame` 是 `position:relative; z-index:auto`，不建层叠上下文；对话 header（`ST7X_W_header`，"标准模式"那一排）是滚动容器**之外**的非定位 flex 子项，composer seat 是 `position: sticky; z-index: 7`。因此 body 级 positioned 浮层无论 z-index 多低都会压过 header（非定位元素永远输给 positioned 元素）——这正是旧版 z-index 降到 0 仍浮在 header 上的原因。工具条/评论泡改挂进滚动容器：桌面抽屉布局滚的是 `.ST7X_W_scrollBody`（`.icaHSq_scroll` 此时是 visible），普通布局滚 `.icaHSq_scroll`；host 在容器内 `position:absolute`、z-index 6（低于 composer 7；评论阶段抬到 8），靠容器裁剪实现"滑进 header 下面"（见机制 13）。宿主顶栏座位 `_6Qf49G_leadingSeat` 是 z-15、全帧 overlay 层 z-20，仅 `darwin && sidebarCollapsed` 时挂载；宿主菜单 100、弹层 1100-1250、模态 900-1005；
- macOS 顶部净空由 `--dsh-frame-overlay-top` 给出（`--dsh-frame-top-clearance:48px` + 20px = **68px**，全屏时 20px），要算顶部空间时读它；
- 宿主菜单/弹层是 z-index 100（菜单）与 1100-1250（弹层），模态 900-1005，都在我们之上；它们同样把 `--dsw-elevation-stroke-color` 覆写成 `--dsw-alias-border-l1`（"覆层不描边"，与本插件一致）。
- **已失效的旧类名**（0.2.0-rc.2 时期）：`.nyYjTG_file`（文件卡片几何）、`.I17U7q_follow`（对话滚动区）随 0.2.1-rc.2 重构消失。消息行的 `data-chat-flow-key` 仍在，另有 `data-chat-anchor-key` / `data-chat-group-key` / `data-chat-flow-kind` / `data-chat-turn`。

## 排错

| 现象 | 先查 |
|---|---|
| 划词没有工具条 / 摘要不出现 | 跑 `pnpm run check`；确认页面已刷新；Host 的 boot 图里应包含 `dsh-select-quote`（`/plugins` 路由由 `ctx.clientModules` 提供） |
| 滚动后工具条不见了 / 滚回来也没有 | 设计如此：选中行首行完全滚出视口时收起，滚回去会重新出现（见关键机制 13）。若滚回来仍不出现，查 `refresh` 链路——`selectionchange` 是否被宿主吞掉、选区是否被虚拟列表重建 |
| 工具条浮在 header / 输入框上面 | 检查工具条是否还 portal 在 `document.body`：它应挂在 `[data-dsq-layer]` 里，host 的父级是 `ST7X_W_scrollBody` 或 `icaHSq_scroll`（见机制 13 与依赖约定）。body 级浮层压不过非定位 header，也拦不住 composer |
| 在消息列表最底部划词时，评论泡被输入框盖住 | `floating-layer.ts` 的 `bounds().bottom` 是否还是滚动容器底边：必须取 composer seat 顶边（`[data-composer-seat]`，缺失退回 `[data-composer-card]`）与容器底边的较小值，否则桌面布局里容器盒子的下半段在 composer 后面；seat 还必须按当前滚动容器就近解析（机制 13） |
| 点空白处批注没了 | 应当保留：批注在点「添加到任务」时已保存，空白点击只会关闭评论泡（见机制 13）。若真丢了，查 `openComment` 是否走到 `saveSelection` |
| 输入框里出现协议原文 | 发送前的注入没生效：确认草稿里存在 U+200B（发送按钮应可用），以及 composer 结构未变（`[data-composer-card]`） |
| 发送后、模型返回前的气泡或排队预览里出现整段协议 | 这是宿主的本地回显（`[data-submission-echo]`）或排队面板预览（`[data-queue-dock]`），都不走本插件的 chat node。查 `watchSubmissionEcho()` 是否注册（`pnpm run verify` 的 `TRANSCRIPT SURFACE` 闸，两类表面都有 DOM 桩行为用例）；完整块无论 JSON 是否合法都该被剥掉。回显仍有原文，说明文本被会话 chip 拆成多个 run——按设计不重建（只处理包含完整块的单个 run，行本身是文本时会直接剥行）；队列预览仍有原文，查最内层纯文本容器是否被工厂套了非文本子节点（`textContainers` 只选不含子候选的容器） |
| 撤回（dsh-rewind 的 ↶）后输入框里是整段协议 JSON | 撤回把持久文本原样写回 composer，正常应由 `readComposedDraft()` 反向还原成正文 + 待发摘要卡。先看 `pnpm run verify` 的 `COMPOSED DRAFT` / `REWIND RESTORE` 两道闸；再用 DevTools 确认写回的是**完整且 JSON 合法**的块——被截断或手改过的块按设计不碰，以免误删用户草稿 |
| 对话记录里没有摘要块 | 该 `user/message`（插话发送则是 steering）事件的 `data.content` 是否含批注块；摘要块由 `user` / `steering` 节点的 `UserMessageDisplay` 内联渲染，先查 `conversation.chat.node` 对应 key 是否注册成功，再查是否被 Turn 过程折叠隐藏（见关键机制 4） |
| 带图片的消息在记录里只剩摘要块、图片没了 | `UserMessageDisplay` 是否成功解析并渲染了宿主 `UserMessageNodeView`；图片/文件由宿主视图从改写后的 `node.data.content` 自己渲染 |
| 用户消息下方的时间 / 复制（以及 dsh-rewind 的 ↶）整行消失 | 先查宿主视图解析：`ctx.slots.entries('conversation.chat.node')` 里是否还有 `UserMessageNodeView`，注册项是否带 `locale: 'chat'`；`pnpm run verify` 的 `USER CHROME` 闸会回放身份排除与候选选择。**不要再自己补动作行**——这正是 issue #8 的复发路径 |
| 改了 CSS 不生效 | `<style>` 只注入一次，刷新页面 |
| `sync:desktop` 推了但客户端没变 | 报 `already matches` 说明 `lib/` 还没重建（先跑 `pnpm run watch`）；报 `no installed bundle` 说明 profile 名不对（`--profile <name>`）；都正常仍不重载，看宿主 boot 日志里有没有 `client-hmr` |
| 界面语言不跟着 dsh 变 | `pnpm run verify` 是否列出 4 项 `locale.*` 贡献；宿主是否提供 `ctx.locale`（没有则文案退到 English）；用户在设置里选的语言是否已注册 |
| 插件页外层没有配置区（或仍要点进「配置」才看到） | 先看 `lib/index.js` 是否真的导出了 `Config`（不是旧的两行空壳），再确认注册的是 `plugins.bundle.config` 且 key 是包名 `dsh-select-quote`（不是 `plugins.row.config`）。行 id 仍要对齐：patch 里 `id: select-quote`、`src/shared/identity.ts` 的 `ROW_ID`、`configForms.whileServed(['select-quote'])` 三处必须一致。`pnpm run verify` 的 `HOST CONFIG` / `ROW IDENTITY` / `CONFIG WIRING` / `BUNDLE FORM` 覆盖这些点 |
| 改了「划词入口」但工具条行为不变 | 行必须能写：`--patch` / home patch 注入的行会被 Host 以 `settings/rejected` 拒绝，要在正常安装的 profile 里改。再查 `configForms.get` 的 key 是否仍是行 id、`refresh()` 是否读 `resolveTriggers(getConfig())`；服务缺失时按设计停在默认 `auto` |
| 右键没出菜单，或原生菜单和划词菜单一起出现 | 先确认「划词入口」选了右键菜单/两者都开；再确认指针真的落在**选区矩形**内（空白/行首缩进都不算，`pointInRects` 有 2px 容差）、右键目标在 `[data-chat-flow-key]` 里、且没有别的监听器先 `preventDefault`。一起出现只可能发生在没接管的那次右键（设计如此：我们不动宿主菜单）；命中时 Electron 原生菜单会被 `preventDefault` 抑制 |
| 快捷键列表里没有「打开划词菜单」/「添加到任务」，或按了没反应 | 设置里的快捷键开关是否打开（关闭时两条命令都不注册）；快捷键设置里是否被别的插件占了键（register 抛错只会在控制台 warn，不会停掉插件）；没有选中文字、或当前批注还没完成时命令按设计返回 `blocked`；设置区会直接显示两条命令当前生效的键位、冲突或未绑定。Web Linux 只能用默认的 `Ctrl+Shift+,` / `Ctrl+Shift+.`，宿主不允许字母键 |
| 侧边提问点「发送」报 `owned by subagent routing` | 主会话绑定被侧边子会话顶掉了：查 `runtime.isSubagentSession` 是否注册、`ctx.sessions.list` 摘要里该会话的 `origin` 是否为 `subagent`（见机制 16） |
| 侧边提问选了模型但子会话仍用旧模型 | Host 半在启动时加载：改完 `lib/typert.js` / `lib/index.js` 必须重启 dsh（HMR 只热更 `lib/client.js`）。再看子会话日志里 `session/end-seed` **之后**那条 `request/header` 的 `provider` / `model`；没有 `agentOptions` 就是 Host 还是旧代码 |
| 设置成「复用同一个」后每次仍新建子代理 | 先确认设置页的分段控件真的写进了 configForms（`sideTaskMode` 是 volatile 字段）；复用依赖 `reusableChildId(父会话)` 的确定性 id 和 `subagents.prompt` 冷恢复，只有 `not-resumable` 才回退新建——若日志里是 `delivery-unavailable` / `unauthorized`，说明子会话还在但不能续投，原样抛错是设计行为。复用模式没有模型 chip 也是预期：模型固定在创建时 |
| 模型菜单点开就被关掉 / 点菜单时输入框消失 | 菜单根必须带 `data-dsq-menu`（划词观察者据此放行 outside pointerdown）并 portal 到 `document.body`；缺属性会被当成「点击空白」连带关掉侧边输入框 |
| 选完模型后点输入框不进焦点、打不了字 | 评论泡外层 `pointerdown` 会 `preventDefault()` 保住正文选区，但文本入口必须放行（`closest('textarea, input, [contenteditable="true"]')`），否则浏览器原生的聚焦与光标定位被一并取消；按钮仍保持阻止，焦点由组件自己管理 |
| 侧边提问点「发送」一直「创建中…」或报 `gateway/binding-invalid` | Host 半三条缺一不可：`exports["./typert"]` 清单、可见的 `typertRemote`、类原型的 `remote-methods` 标记；再确认客户端 `$mount` 成功（console 里不应有 mount failed）并能取到 `remote.selectQuoteSideTask`（见机制 16） |
| 侧边提问创建成功但侧栏没开 / 打开的是空白页 | 检查资源地址 `dsh-resource://subagentchat/session/<child>?parent=<parent>&mode=continuable` 与 `{kind: 'subagentchat'}`；子代理会话必须由 `origin: 'subagent'` 建立，父会话 id 必须是主会话（不是子会话） |
| 按 Backspace 删不掉 / 中文输入被打断 | 检查是否有代码在响应草稿变化时调用 `setDraft()`（见关键机制 2） |
