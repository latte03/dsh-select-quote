# dsh-select-quote 实现说明（维护者向）

面向用户的介绍与安装在 [README](../README.md)。这里记录协议、槽位、以及踩过的坑——改代码前先读这份。

## 开发命令

```bash
npm run typecheck   # tsc --noEmit，应无输出
npm run build       # 产出 lib/index.js 与 lib/client.js
npm run watch       # 增量重建
npm run verify      # 无头执行 lib/client.js，断言 4 项贡献都注册上了
npm run check       # typecheck + build + verify（提交前跑这个）
```

**为什么有 `verify`**：`tsdown` 不做类型检查，一个语法坏掉的 bundle 也能构建"成功"。最典型的一次事故是 CSS 模板字符串里出现了反引号（`` `.nyYjTG_file` ``），字符串被提前截断，产出的 JS 无法执行，但 build 输出一切正常。`verify` 把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果——这是唯一能在浏览器之外发现这类错误的手段。改动 `src/client/index.tsx` 的注册项时，记得同步 `scripts/verify-bundle.mjs` 里的 `EXPECTED`。

**本地跑起来**：`dev.patch.yml` 里的插件路径必须是**绝对路径**（checkout 不在 profile 的 `node_modules` 里，Loader 没有包名可解析）。换机器/换目录时改那一行；该文件不随 npm 包发布，发布版走 `cordis.patch.yml`（按包名）。

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

## 客户端贡献（共 4 项）

| 位置 | 类型 | 说明 |
|---|---|---|
| `shell.overlay` | list slot | `select-quote-toolbar`（order 100）：划词工具条 + 评论气泡。挂 root 级，切会话/看历史都不会失去观察 |
| `conversation.input.overlay` | list slot | `select-quote-card`（order 20）：输入框内的批注摘要；`select-quote-session-bridge`（order 1）：只负责把 `sessionId` 发布给 root 工具条 |
| `conversation.chat.node` | keyed slot | `user`（`priority: -10`）：替换内置用户气泡，剥掉协议块并渲染批注卡片 |

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
- 卡片**由该组件自己渲染**（`<TranscriptQuoteCard>`），而不是注册一个独立的 `select-quote` Chat 节点；
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

**7. 样式与主题**

卡片几何对齐产品自带的文件卡片（`ui-deliverables` 的 `.nyYjTG_file`）：`.5px` 发丝边框、18px 圆角、64px 固定高、10px 内边距、hover 背景过渡；删除按钮绝对定位右上角，仅 hover / 键盘聚焦时淡入。

- 深色模式用产品自己的 `body[data-ds-dark-theme]`（由 `dsh-client-ui-layout` 挂在 body 上），**不是** `prefers-color-scheme`；
- 颜色一律用会随主题翻转的 `--dsw-alias-*` / `--dsw-static-*` token，只自己定义 `--dsq-card-fill` / `--dsq-card-hover` 两个填充变量；
- 样式通过 `ensureToolbarStyles()` 注入一个 `<style data-plugin-css="dsh-select-quote/toolbar.css">`，**改完 CSS 必须刷新页面**（函数只插入一次）。

## 目录结构

```
src/index.ts                       # Node 半：占位，让包被 Loader 挂载
src/client/index.tsx               # Client 半入口：注册 Slot 与装饰观察者
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
src/client/styles.ts               # 全部 CSS（模板字符串注入）
src/client/runtime.ts              # 跨 slot 的运行时共享（sessionId）
src/client/context.d.ts            # 客户端 Context 服务的类型补充
scripts/build.mjs                  # tsdown 构建 + ModuleLoader 包装
scripts/verify-bundle.mjs          # 无头 bundle 校验（EXPECTED = 上面 4 项）
cordis.patch.yml                   # bundle 加载层（按包名，随 npm 包发布）
dev.patch.yml                      # 本地 --patch 开发层（绝对路径，不发布）
lib/                               # 构建产物（已提交，运行时直接读它）
```

## 依赖的产品内部约定（升级 dsh 后逐条复核）

- `[data-composer-card]` 属性存在，且主发送按钮是卡片内 DOM 顺序上最后一个 `button`；停止按钮渲染 `svg rect`；
- `user/message` 事件的内容在 `data.content`（不是 `data.message.content`）；
- 深色属性 `data-ds-dark-theme` 由 `dsh-client-ui-layout` 挂在 `body`；
- 槽位名 `shell.overlay` / `conversation.input.overlay` / `conversation.chat.node` 及其 props（`useInput`、`inputActions.setDraft`）；
- 类名 `.nyYjTG_file`、`.I17U7q_follow` 只是几何与层叠参照，产品改版不影响功能，但会影响观感。

## 排错

| 现象 | 先查 |
|---|---|
| 划词没有工具条 / 卡片不出现 | 跑 `npm run check`；确认页面已刷新；Host 的 boot 图里应包含 `dsh-select-quote`（`/plugins` 路由由 `ctx.clientModules` 提供） |
| 输入框里出现协议原文 | 发送前的注入没生效：确认草稿里存在 U+200B（发送按钮应可用），以及 composer 结构未变（`[data-composer-card]`） |
| 对话记录里没有卡片 | 该 `user/message` 事件的 `data.content` 是否含批注块；`conversation.chat.node` 的 `select-quote` 单元是否注册 |
| 带图片的消息在记录里只剩卡片、图片没了 | `UserMessageDisplay` 是否拿到了 `renderMessageImages` |
| 改了 CSS 不生效 | `<style>` 只注入一次，刷新页面 |
| 按 Backspace 删不掉 / 中文输入被打断 | 检查是否有代码在响应草稿变化时调用 `setDraft()`（见关键机制 2） |
