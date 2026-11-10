---
title: 将批注放入其他会话
status: implemented (MVP)
date: 2026-11-04
scope: dsh-select-quote 0.4+
---

# 将批注放入其他会话

本文是功能设计，不是现存机制说明。实现完成后，其中稳定下来的协议、槽位与排错条目应并入 [`docs/internals.md`](../internals.md)，本文只保留设计决策与边界。

## 1. 结论

可实现，不需要新增宿主 RPC。核心只有两步：

1. 把批注写进目标会话自己的待发分区；
2. 用 `ctx.uiWorkspace.openSession(sessionId)` 切换主视图。

关键难点不在“发送”，而在四份状态不能互相污染：

- 源会话的**待发批注**（现有 `items`）；
- 源会话的**已放入记录**（本文新增 `outbound`）；
- 源会话正文里的**箭头 mark**；
- 目标会话消息里的 **wire JSON**。

推荐把 `outbound` 与待发批注彻底分开。否则源会话下一次发送会触发 `clearAnnotations()`，把“已放入他处”的记录一起清掉；源会话的 U+200B 也会因为 outbound 计数而误加，导致空草稿也能发送。

## 2. 已确认的产品决策

| 决策点 | 结论 |
|---|---|
| 源会话角标 | 单独的箭头角标，不显示数字 |
| 角标点击 | 统一点击打开预览；预览里点「前往」；触屏相同 |
| outbound 是否出现在源会话输入框批注卡 | 不出现，只在正文留下箭头 mark |
| 目标侧编辑/删除 | 同步回源侧 outbound 记录 |
| 源侧是否可删除 | 提供「取消放入」；内联两步确认（点一次变「确认移除」） |
| 目标会话发送后 | 源侧 mark 保留，状态标为「已发送」 |
| 默认目标 | 当前工作区中排除当前会话后，按 `updatedAt` 最近的会话 |
| 新会话 | 作为目标选择器的一项；立即静默创建；建在当前工作区；复用当前工作区空白会话 |
| 新会话 agent preset | 交给宿主默认，不继承源会话 |
| 按钮文案 | 「放入 <会话>」/「放入并前往」；成功提示用「已放入」 |
| 箭头下划线颜色 | 沿用现有 accent，不新增高亮色 |
| 目标/源会话已归档 | 不自动取消归档；toast 提示；跳转按钮禁用，tooltip「【xxx】已归档」 |
| 多目标 | 同一处选区合并为一个箭头 mark，预览按目标分行；不同选区不合并 |
| 侧栏目标会话标记 | 不做 |
| outbound 保留 | `state=pending` 时与目标 pending 共用 20 会话 / 7 天自动淘汰，两边一起清除；目标发送后 `state=sent` 才永久保留 |

## 3. 宿主能力（已核实）

本机桌面端随包版本为 0.2.1-rc.5。插件 `engines` 允许 `>=0.2.1-rc.2`，实现时应做特性检测，缺少服务时隐藏入口，而不是让插件启动失败。

| 能力 | 结论 |
|---|---|
| 会话列表 | `ctx.sessions.list.getSnapshot()` 有 `ids`、`byId`；每项含 `displayTitle`、`updatedAt`、`cwd`、`title`、`parentId`、`origin`、`blank`、`running`、`projectionValues` |
| 工作区列表 | `ctx.workspaces.list.getSnapshot()` 有 `items[]`（`workspaceId`、`title`、`path`、`sessionIds`）、`archivedSessionIds`、`pinnedSessionIds` |
| 切换会话 | `ctx.uiWorkspace.openSession(target)`，同步替换 mainView，主区域回到 Conversation |
| 静默创建空白会话 | `ctx.sessions.create({ workspaceId } \| { cwd }, sessionId?, agentPreset?)`，返回新会话 id，只发布 catalog 行，**不导航** |
| 打开/保留会话 | `ctx.sessions.retain(target, { source })`，会加载历史并返回 binding |
| 新会话带草稿 | `uiWorkspace.startSession(workspaceId, options)`、`openWorkspace(..., beforeOpen)` + `prepareDraft`；只适用于新建/空白会话 |
| 给已有会话写草稿 | 没有文档化的跨会话草稿注入 API；不要依赖 `conversation.input.shell(id)` 这类内部面 |

**重要推论**：不要用 `startSession` 携带批注。它只服务“新建/空白会话”，不是用户选中的已有会话。目标会话的批注载体就是我们自己的 `dsh.select-quote.annotations.<sessionId>` 分区。

**新会话为什么能“放入但不去”**：`ctx.sessions.create` 只建会话、不切页。因此“新会话”可以立即静默创建，源页保持不变；侧栏会多出一行“新会话”。这解决了「放入」与「新建会话必然导航」的冲突。

## 4. 交互规格

### 4.1 工具条与右键菜单

工具条和右键菜单共用 [`src/client/selection/actions.ts`](../../src/client/selection/actions.ts) 这一份动作清单，新动作必须同时出现在两处。

- 有默认目标时：`放入 <默认会话名>` + 下拉箭头。
  - 点主按钮：直接进入评论面板，目标为默认会话。
  - 点箭头：打开目标选择器。
- 没有默认目标时：`放入会话…`，点开打开选择器。
- 没有其他会话但可以新建时：默认目标为「新会话」，主按钮显示 `放入新会话`。
- 既没有其他会话、也没有可用工作区/cwd 时：隐藏该动作。
- 触屏：不使用原生 `<select>`；和底部操作条一致，打开 body 级底部菜单/抽屉，行高 44px。
- 右键菜单：显示 `放入会话…`，点开后复用同一个选择器；选择器根节点必须带 `data-dsq-menu`，否则会被划词观察者当成“点空白”关掉。

### 4.2 目标选择器

建议布局：

```
放入到
┌──────────────────────────────────┐
│ ＋ 新会话 · 当前工作区            │  ← 始终第一行
├──────────────────────────────────┤
│ 当前工作区                        │
│   Fix login bug          3 分钟前 │  ← 默认选中
│   Refactor parser        昨天     │
├──────────────────────────────────┤
│ 其他工作区                        │
│   project-b / 修复上传       2 天  │
├──────────────────────────────────┤
│ 未分组                            │
│   …                               │
└──────────────────────────────────┘
```

规则：

- **默认选中**：当前工作区中排除当前会话后，`updatedAt` 最近的一条。
- **没有其他会话时**：默认选中「新会话」；如果连工作区/cwd 都没有，则隐藏入口。
- **排除**：当前会话、`origin === 'subagent'`、`archivedSessionIds`。
- **空白会话**：不单独列出，统一由「新会话」表达；否则侧栏会出现多个同名“新会话”。
- **排序**：严格按 `updatedAt` 倒序。不要用侧栏手动顺序，避免“最近”语义漂移。
- **分组**：当前工作区、其他工作区、未分组；每行显示标题 + 工作区名 + 相对时间。
- **重名**：标题重复时靠工作区名区分；标题过长省略，`title` 属性给全名。
- **Latch**：选择器打开时确定默认项；本次选区不变就不重算，避免用户打字导致 `updatedAt` 变化、默认目标跳走。
- **键盘**：↑/↓ 跨分组移动，Enter 选择，Esc 关闭；打开时焦点落在当前选中项，关闭后回到触发按钮。
- **搜索**：会话多时提供搜索框，按标题和工作区名过滤；输入法合成期间不要重建列表。
- **实时性**：订阅 `ctx.sessions.list` 与 `ctx.workspaces.list`；新会话、改名、归档要即时反映。
- **定位**：body portal，z-index 与 `.dsq_ctxMenu` 同档（64）；不要放在滚动容器里，否则会被裁剪。

### 4.3 评论面板

现有流程是“打开评论面板即保存”（[`SelectionToolbar.tsx`](../../src/client/selection/SelectionToolbar.tsx) 的 `beginComment`）。跨会话**不能沿用**：否则用户按 Esc 取消，目标会话里已经多了一条批注。

推荐布局：

```
添加批注
┌──────────────────────────────────┐
│ 放入至：Fix login bug       更改 │
│ 将在目标会话输入框中等待发送       │
├──────────────────────────────────┤
│ [可选评论                       ] │
│                                  │
│            [取消] [放入] [放入并前往] │
└──────────────────────────────────┘
```

规则：

- 评论可选；评论为空时两个按钮都必须可用。
- 「放入」：写入目标会话待发分区和源会话 outbound；关闭面板；留在当前页；状态提示 `已放入 <目标>`。
- 「放入并前往」：同上，然后关闭工具条/评论泡、清掉原生选区、调用 `openSession(target)`。
- 目标显示在独立 chip 里，不塞进两个按钮的文案，避免长标题把按钮撑爆。chip 可点「更改」重新打开选择器。
- **取消语义**：Esc / 点外部 / 「取消」都不写目标，也不创建新会话。跨会话面板建议像“编辑批注”一样钉住，避免点外部误关丢掉长评论；至少要在取消时保留已输入评论的草稿。
- **IME**：合成期间不提交；读取 textarea 当前值，和现有评论泡一致。
- **进行中**：创建新会话或写入时两个按钮都显示 `放入中…` 并禁用，评论保留。
- **失败**：创建/写入失败时面板不关，显示错误；不要留下源 mark。

### 4.4 源会话 mark 与预览

- outbound 记录在源会话正文里画 mark，角标用**单独的箭头**（例如 `↗`），不显示数字。
- 角标尺寸与现有数字角标同一档；因为只有一个字形，宽度可固定（例如 15px），不必按位数计算。
- mark 的下划线沿用现有 accent，不新增第二种高亮色；箭头已经足够区分。若后续觉得不够显眼，再单独评估独立 token。
- 桌面与触屏统一：点击角标 → 打开现有预览浮层；前往由预览里的箭头图标触发。
- **合并**：同一处选区（`text + source.messageId + startOffset + endOffset` 相同）发往多个会话时，合并为一个箭头 mark；预览按目标分行列出。不同选区即使文本相同也不合并。
- 预览内容：
  - 选中文本；
  - 每个目标一个块：弱化行 `会话名 · 工作区 · 状态`，工作区与会话名相同时省略，状态为「待发送」/「已发送」；
  - 评论正文单独一行；没有评论就整行不画（不留「未添加评论」占位，与批注卡、预览卡一致）；
  - 单目标时右上角是 `编辑 / 前往 / 删除` 三个图标按钮；多目标时同一组按钮下放到各自目标行右侧；
  - 编辑和删除只在 `state === 'pending'` 时出现；「前往」始终可用，目标归档时禁用；
  - 不再提供「复制」。
- **编辑**：仅待发送可用；修改评论后同时写回源 outbound 和目标 pending（`updateHandoffComment`），两边保持一致。
- **删除 / 取消放入**：图标按钮。第一次点击就地展开为「图标 + 确认移除」，再点执行，不弹新浮层。确认后删除该目标会话的待发批注和对应 outbound 记录；同一 `selectionKey` 还有其他目标时箭头 mark 保留并重算预览，没有目标了才摘掉 mark。目标侧不存在该条目时，提示「目标侧已不存在」，只清理源记录。
- **已发送**：目标会话发送后，源 mark 保留；预览中该目标状态变为「已发送」，不再显示编辑和删除。
- **已归档**：目标会话归档后，该目标的「前往」禁用，tooltip 显示「【xxx】已归档」，并在打开预览时给一次 toast。不自动取消归档。
- **统一删除确认**：这套「图标 → 图标 + 确认移除」的内联二次确认也是插件里所有批注删除入口的统一交互——输入框摘要的单条删除、清空全部、待发批注预览、跨会话预览共用同一组样式与 0.16s 展开过渡，不各写一套。

### 4.5 目标会话的待发批注卡

- 目标会话输入框上方出现正常批注卡，计数包含跨会话条目。
- 条目在选中文本下方增加一行：`来自：<源会话>`，带小箭头，整行可点。
- 点击「来自」：打开源会话，并定位到源 mark；源会话已归档时禁用跳转，tooltip 显示「【xxx】已归档」，并给一次 toast。
- 编辑评论：写回目标条目，同时同步源 outbound 记录。
- 删除单条：两步确认后删除目标条目和对应的源 outbound 记录；同一 `selectionKey` 组内没有其他目标时才摘掉源 mark。
- 清空全部（非发送）：两步确认后删除目标全部条目；跨会话条目清理对应的源 outbound；组内没有其他目标时才摘 mark；本地条目只删目标。
- 发送：先把跨会话条目的源 outbound 标为「已发送」，再清空目标待发；顺序不能反，否则兜底对账可能把刚发送的记录误判为过期。
- 发送后撤回（dsh-rewind）：`readComposedDraft` 还原条目时保留 `origin`；源 outbound 状态回到「待发送」。
- 新增的按钮/控件必须留在 composer 卡片的发送按钮之前。发送拦截依赖“卡片内 DOM 顺序最后一个 button 是发送按钮”（[`useSendIntercept.ts`](../../src/client/composer/useSendIntercept.ts)）；不要让「来自」变成新的最后一个 button。

### 4.6 目标会话的历史批注卡

- 消息发送后，`TranscriptQuoteCard` 照常渲染摘要卡；条目在选中文本下方显示 `来自：<源会话>`。
- 点击条目：打开源会话并定位，**不要**调用 `scrollToAnnotation`。跨会话条目在目标会话里没有正文 mark，按文本搜索会命中无关内容。源会话已归档时禁用跳转，tooltip 显示「【xxx】已归档」，并给一次 toast。
- 历史卡片不提供编辑/删除，沿用现有行为。同步只发生在待发阶段。
- 助手回复里的 `:dsh-annotation{index="N"}` chip 仍然工作；chip 预览标题栏的箭头图标按钮对跨会话条目应打开源会话，而不是在当前会话里找 mark。源会话已归档时同样禁用 + tooltip + toast。

### 4.7 新会话

「新会话」是目标选择器里的一个伪目标，不是真实的会话行。

创建规则：

1. 目标工作区 = 源会话所属工作区。
2. 源会话未归组时，用源会话的 `cwd` 作为 `ctx.sessions.create({ cwd })`。
3. 优先复用当前工作区内已有的空白会话，匹配条件与宿主 `createInWorkspace` 一致：
   - `blank === true`；
   - `cwd === workspace.path`；
   - `workspace.sessionIds` 包含该 id；
   - 不在 `archivedSessionIds` 中。
4. 没有可复用空白时，调用 `ctx.sessions.create({ workspaceId })`（或 `{ cwd }`）创建。
5. 拿到 id 后，先写目标待发分区，再写源 outbound；两步都完成才显示成功。源写入失败时回滚目标条目；持久化降级但内存写入成功时，提示“只保留到本次刷新”。
6. 「放入」不导航；「放入并前往」再调用 `openSession(newId)`。
7. 创建失败：面板不关，显示错误，不写源 mark；不留下半条 outbound。

行为细则：

- 选择「新会话」但最终取消：不创建任何会话。
- 点「放入」后创建成功：侧栏立即多出一行“新会话”，源页不变。之后点源 mark 的「前往」或侧栏行即可打开。
- 连续两次「放入新会话」：第二次仍能匹配到第一行空白，复用同一个新会话；这符合宿主“空白会话复用”的行为。
- 复用的空白会话如果已有未发送草稿，批注会和草稿共存；这是宿主“新会话”的既有行为，不额外清空用户草稿。
- 新会话有标题前，源/目标两边显示 `新会话`；宿主生成标题后，用 live title 覆盖。
- 「取消放入」只删批注，不删除已创建的空白会话；会话保留为空的新会话。
- Agent preset：已决定交给宿主默认，不继承源会话；后续需要继承再单独加设置项。
- 源会话没有工作区也没有 cwd 时：禁用「新会话」，并在没有其他目标时隐藏整个入口。

### 4.8 无障碍、触屏与键盘

- 工具条动作：`aria-haspopup="dialog"`，展开后 `aria-expanded`。
- 选择器：`role="listbox"` 或 `role="menu"`；选项 `aria-selected`；搜索框有关联 label；焦点不逃出浮层。
- 箭头 mark：`role="button"`，`aria-label` 例如「批注，已放入 <目标会话>，按 Enter 查看」；Enter/Space 打开预览。
- 预览按钮：`编辑`、`前往`、`删除` 都是图标按钮，必须带可读名称；删除用内联两步（第一次点击变「图标 + 确认移除」），不弹新浮层。
- 触屏：44px 行高/按钮；`visualViewport` 处理软键盘；输入框 16px 防 iOS 聚焦缩放。
- 所有新浮层沿用现有规范：磨砂底色画在负 z 的 `::before`，入场动画只动 transform，不带 opacity；`prefers-reduced-motion` 下关闭过渡。

## 5. 数据模型

### 5.1 源会话 outbound（新增）

```ts
interface OutboundAnnotation {
  id: string
  text: string
  comment?: string
  sources: AnnotationSource[]
  /** 同一处选区的合并键：text + source 定位的稳定 hash。 */
  selectionKey: string
  destination: {
    sessionId: string
    kind: 'existing' | 'new'
    title: string          // 发送时快照；渲染时优先读 live title
    workspaceId?: string
  }
  state: 'pending' | 'sent'
  createdAt: number
  updatedAt: number
}
```

一个目标一条 outbound 记录；同一处选区发往多个目标时，多条记录共享 `selectionKey`，但各自保留目标、状态和评论。mark job 按 `selectionKey` 分组，只画一个箭头。

它只负责源会话的 mark、预览和跳转；**不进入** `getAnnotations()`、`clearAnnotations()`、`useSendIntercept()` 的待发路径。

### 5.2 目标会话的待发批注（扩展现有）

```ts
interface SelectionAnnotation {
  id: string
  text: string
  comment?: string
  sources: AnnotationSource[]
  origin?: {
    sessionId: string
    title: string          // 源会话标题快照；渲染时优先读 live title
    handoffId: string      // 对应源 outbound 记录的 id，用于编辑/删除/撤回同步
  }
}
```

目标侧它就是一个普通待发批注，参与发送、清空、编辑、U+200B 标记。`origin.handoffId` 让目标侧编辑/删除时能精确找到源记录；撤回还原后也靠它恢复关联。

### 5.3 存储格式与保留

推荐同一个 key、payload 升到 `v: 2`：

```ts
interface AnnotationPayload {
  v: 2
  updatedAt: number
  items: SelectionAnnotation[]
  outbound: OutboundAnnotation[]
}
```

- 读取 `v: 1` 时 `outbound = []`，零迁移。
- `prune` 对本地 pending 仍按会话 `updatedAt` 计算；handoff 按自身的 `createdAt`/`updatedAt` 判定，见下。
- 保留策略按 handoff 状态分两档：
  - 本地 pending（没有 `origin`）：维持 20 会话 / 7 天。
  - 未发送的 handoff：目标 pending（带 `origin`）与源 outbound（`state=pending`）共享同一生命周期，沿用 20 会话 / 7 天自动淘汰；两边必须一起清除，不能只清一侧。
  - 已发送的 handoff：目标发送后 `state=sent`，源 outbound 永久保留；目标 pending 已在发送时清空，不再参与淘汰。
  - 含 `sent` outbound 的会话 key 不参与 20/7 淘汰，否则“永久保留”会被会话级 prune 破坏。
  - 会话级 prune 不能因为目标会话 key 旧就删掉新放入的跨会话 item；带 `origin` 的 item 交给 handoff 对账单独判定。
  - 淘汰判定用 handoff 的 `createdAt`/`updatedAt`，不要分别用源/目标会话 key 的 `updatedAt`，否则一侧可能先过期。
  - 兜底对账（不是自动淘汰）：自动淘汰只负责按 20/7 移除过期记录；对账负责在会话绑定、启动恢复、`storage` 事件或全局 prune 后检查 handoff 两侧是否仍然成对。任一侧不存在且不是 `sent`，清理另一侧和 mark。它不按时间轮询，也不替代用户操作的事件同步。
  - 用户操作是主路径：放入、编辑、删除、清空、发送、撤回、取消都在动作发生时立即更新另一侧；兜底对账只修复一侧被淘汰、写入失败、跨标签页竞态、旧版本/半写等异常。
  - 20 的计数口径建议按 handoff 记录数统计，不要分别按源/目标会话 key 计数，避免一侧先被淘汰。
  - 上限是 localStorage：清站点数据/换 profile 会丢。写入失败时提示，不静默丢。
- 写入失败仍按现有静默降级：同标签页内 store 还有内存，跨会话在本次页面生命周期内可用；刷新/换标签页会丢。跨会话写入失败时应额外提示“只保留到本次刷新”。

### 5.4 去重与 id

- 目标 `saveAnnotation` 现在只按 `text + comment` 去重；跨会话条目必须把 `origin.sessionId` 纳入去重键，否则同一段文字发往两个目标会错误复用。
- 源 outbound 按 `text + destination.sessionId` 去重；重复「放入」同一目标不要叠加第二条记录。
- `selectionKey`：由 `text + source.messageId + startOffset + endOffset` 生成稳定键；没有定位时退化为 `text`。同一 `selectionKey` 的多条 outbound 合并为一个箭头 mark。
- 同一选区发往多个目标：允许多条 outbound（每条一个目标），`selectionKey` 相同；mark job 按 `selectionKey` 分组，只画一个箭头；预览按目标分行。
- 不同选区即使文本相同，也不合并，避免把不同段落的相同句子混在一起。
- markId：outbound 用 `out_<selectionKey 的稳定 hash>`，目标 pending 沿用 `ann_<...>`，避免未来源/目标同屏时 job 冲突；某个目标被删除后，组内 markId 不变。

### 5.5 状态机

用户触发的转换都是**直接事件同步**：动作发生时立刻写另一侧，不依赖对账。下面的图是状态转换，不是定时任务；兜底对账只处理“一侧不存在”的异常分支。

```
source 放入（一个目标一条 outbound，同一选区共享 selectionKey）
   │
   ├─ target pending 存在 ──► outbound.state = pending
   │        │
   │        ├─ target 编辑评论 ──► 对应 outbound.comment 同步
   │        ├─ target 删除单条/清空 ──► 对应 outbound 删除；selectionKey 组内无记录时才摘 mark
   │        ├─ target 发送 ──► outbound.state = sent，mark 保留
   │        ├─ target 撤回还原 ──► outbound.state = pending
   │        └─ source 取消放入 ──► 该目标条目删除 + 对应 outbound 删除；组内无记录时才摘 mark
   │
   └─ target pending 不存在但 outbound 存在
        ├─ state = sent ──► 已发送，mark 保留
        └─ state = pending ──► 过期或目标侧丢失；兜底对账清理 outbound + mark，并给出提示
```

## 6. 同步矩阵

用户操作（放入/编辑/删除/清空/发送/撤回/取消）是**事件驱动的直接同步**，动作发生时立刻写另一侧；同标签页直接调用 store 的跨会话同步函数，跨标签页由既有 `storage` 事件驱动，不需要额外的全局事件总线。“保留策略淘汰”是唯一由时间/数量触发、需要兜底对账的路径。

| 事件 | 目标 pending | 源 outbound | 源 mark | 备注 |
|---|---|---|---|---|
| 源「放入」 | 新增带 `origin` 的条目 | 新增 `state=pending` | 新增箭头 mark | 先目标后源；失败回滚 |
| 源「放入并前往」 | 同上 | 同上 | 同上 | 写入完成后导航 |
| 目标编辑评论 | 更新该条目 | 更新对应记录的 comment | 预览更新 | 目标侧权威 |
| 目标删除单条 | 删除该条目 | 删除对应记录 | 组内无记录时才摘 mark | 目标侧权威 |
| 目标清空全部（非发送） | 删除全部 | 删除全部跨会话记录 | 组内无记录时才摘 mark | 本地条目只删目标 |
| 目标发送 | 清空全部 | 保留，`state=sent` | 保留 | 先标 `sent` 再清目标 pending；`clearAnnotations({reason:'sent'})` |
| 目标撤回还原 | 还原带 `origin` 的条目 | `state=pending` | 保留 | `restoreAnnotations` 保留 origin/handoffId |
| 源「取消放入」 | 删除该条目 | 删除对应记录 | 组内无记录时才摘 mark | 内联两步确认；仅 pending 时可用 |
| 源 mark「前往」 | 不变 | 不变 | 不变 | `openSession(target)`；目标归档则禁用 + tooltip |
| 目标「来自」点击 | 不变 | 不变 | 不变 | `openSession(source)` + 定位；源归档则禁用 + tooltip |
| 目标会话归档 | 不变 | 保留 | 保留 | toast「【xxx】已归档」；前往禁用 + tooltip |
| 源会话归档 | 不变 | 保留 | 保留 | 目标侧「来自」禁用 + tooltip + toast |
| 保留策略淘汰 | 本地 pending 与未发送 handoff 按 20/7；sent 不淘汰 | pending outbound 与目标 pending 一起清；sent 永久 | pending 过期时摘 mark；sent 不摘 | 两侧成对清除；兜底对账修复单边 |

## 7. wire 协议

目标会话发送时，wire item 增加 `origin`：

```json
{
  "text": "选中的原文",
  "annotation": "用户评论",
  "source": {
    "messageId": "源消息 flow key",
    "startOffset": 12,
    "endOffset": 34,
    "text": "选中的原文"
  },
  "origin": {
    "sessionId": "源会话 id",
    "title": "源会话标题",
    "handoffId": "源 outbound 记录 id"
  }
}
```

- `source` 仍保留源消息的定位信息，用于跳回；`origin` 只负责展示、判断和撤回后的同步关联。
- 协议头增加一句：

  > Items with `origin` were selected in a different conversation. Their `source` offsets refer to that conversation and cannot be resolved in the current transcript. Treat them as external context.

- 读路径同步改：`composeAnnotatedMessage()`、`scanAnnotatedMessage()`、`readComposedDraft()`、`ParsedAnnotation`、`RestoredAnnotation`。
- 兼容：旧版本读新消息会忽略 `origin`，批注仍显示，只是没有“来自”；新版本读旧消息没有 `origin`，按普通批注处理。
- 撤回：`readComposedDraft()` 必须保留 `origin`，否则跨会话批注会退化成普通本地批注，源链接丢失。
- 去重：`restoreAnnotations` 的去重键加入 `origin.sessionId + origin.handoffId`，避免两条同文同评但来源/交接不同的批注被合并。
- `stripSubmissionEcho` 不需要改逻辑，但 verify 的回显/排队用例要覆盖更长的 JSON。

## 8. 导航与定位

### 8.1 源 → 目标

1. 关闭工具条、评论泡、目标选择器；
2. `clearNativeSelection()`；
3. 若目标是新建：已创建的直接 `openSession(id)`；
4. `ctx.uiWorkspace.openSession(targetId)`；
5. 失败时保留源 outbound，提示“已放入，但打开会话失败”。

### 8.2 目标 → 源

1. `openSession(sourceSessionId)`；
2. 等待源会话 composer 绑定、`outbound` job 注册、正文渲染；
3. 用 `markId = out_<selectionKey hash>` 查找 mark，找到就 `flashAnnotationMark`。入口带 `origin.handoffId` 时直接从中取 mark id（`handoffMarkIdOf`），不要用目标侧文本/偏移重算——目标侧的 `source` 可能已漂移，重算会得到另一个 hash；
4. mark 还没渲染出来时按 100ms 间隔重试，最长 8 秒。冷会话、长历史的首屏加载通常需要数秒，重试窗口必须覆盖这段；
5. 重试期间用户切走会话就静默停止，不再提示；
6. 超时后仍找不到 mark：提示“已打开原会话，但原文不在当前已加载的历史中”。不做全文文本搜索兜底，避免误标同文的无关段落。

历史加载是异步的，消息窗口也可能不包含目标消息，所以不能用单次 `requestAnimationFrame` 判定失败。

如果源会话已归档：目标侧「来自」禁用，tooltip 显示「【xxx】已归档」，并给一次 toast；不自动取消归档。

### 8.3 源 mark → 目标

- 打开目标会话即可；如果目标批注仍在待发，目标输入框里的卡片就是落点。
- 如果目标批注已发送，目标消息可能在历史里。MVP 只打开会话；第二阶段可以在目标消息渲染时记录 `flowKey`，回写到源 outbound，实现精确滚动。
- 目标已归档：检查 `archivedSessionIds`；打开预览时给一次 toast「【xxx】已归档」；「前往」禁用，tooltip 显示「【xxx】已归档」；不自动取消归档。
- 冷会话：`openSession` 会加载历史，首屏有加载过程，属于正常。

### 8.4 新会话的导航

- 「放入」：创建/复用空白会话后不导航；源页不变。
- 「放入并前往」：创建后 `openSession(newId)`。
- 新会话的 `displayTitle` 在宿主生成标题前是“新会话”；源 mark 预览、目标卡片都用 live title 解析。

## 9. 边界与风险

### 必须处理

1. **outbound 与 pending 分开**。否则 `clearAnnotations()` 会清掉 outbound，U+200B 也会误加。
2. **目标会话不给跨会话条目画正文 mark**。`TranscriptQuoteCard` 现在无条件 `upsertAnnotationJobs`；跨会话条目必须跳过，只保留摘要卡和 chip registry，否则会在目标会话里按文本乱标。
3. **发送拦截的“最后一个 button”假设**。新增控件必须留在发送按钮之前，不能成为 composer 卡片内最后一个 button。
4. **发送与删除要分开**。目标发送时保留源 outbound 并标 `sent`；目标删除/清空时才删除源 outbound。两者不能共用同一个 `clearAnnotations()` 语义。
5. **取消放入的跨会话删除**。内联两步确认；只删当前目标，不误删同一 `selectionKey` 的其他目标；目标条目已不存在时只清理源记录并提示。
6. **撤回保留 origin/handoffId**。否则源链接和目标侧同步关联都会丢失。
7. **去重带 origin/destination/selectionKey**。否则同文同评会错误复用，或把不同选区错误合并。
8. **存储失败提示**。同标签页内存仍可用，但刷新/换标签页会丢。
9. **保留策略按状态分档**。未发送 handoff 的目标 pending 与源 outbound 共用 20/7，必须成对清除；只有目标发送后 `state=sent` 的 outbound 才永久保留。用户操作直接事件同步；自动淘汰只按 20/7 移除过期记录，单边异常由兜底对账修复。上限是 localStorage，写入失败要提示，不静默丢。
10. **新会话创建的副作用**。取消放入不会删除已创建的空白会话；多个空白会话按宿主规则复用。
11. **同选区合并的稳定性**。删除/取消一个目标后，同一 `selectionKey` 的其他目标仍应共用一个 mark；markId 不变，避免正文重排和滚动定位失效。
12. **归档不是删除**。目标或源会话归档后，记录和 mark 都保留；跳转禁用 + tooltip + toast，不自动取消归档。

### 体验与边界

13. **目标标题/源标题过期**。用 `ctx.sessions.list` 的 live snapshot 解析，存快照只做 fallback。
14. **跨标签页**。目标标签页 active 时收到 `storage` 事件会 adopt；两边同时写仍是 last-write-wins。
15. **取消与发送的竞态**。源侧取消、目标侧同时发送时可能 last-write-wins；取消前重新检查目标 pending，降低概率，但无法完全消除。
16. **历史未加载**。目标→源、源→目标的精确滚动都受宿主历史窗口限制；必须给可见提示。
17. **跨工作区语义**。目标 cwd 可能不同，模型可能把原文里的文件路径当成目标工作区路径；协议头要明确“来自另一个会话/工作区”。
18. **跨 provider**。不同会话可能用不同模型/供应商；用户主动触发，但目标名必须清晰。
19. **多目标合并**。同一处选区合并为一个箭头 mark，预览按目标分行；不同选区即使文本相同也不合并。删除一个目标时只重算组，不误删其他目标。
20. **无撤销**。误点放入会留下源 mark 和目标待发；建议在成功提示里提供「撤销」，或在源预览里用「取消放入」兜底。
21. **历史卡片不可编辑**。目标已发送的批注不再提供编辑/删除；同步只发生在待发阶段。
22. **i18n**。新增文案要进八份词典；带 `{count}` 的按现有复数规则拆 `.one/.few/.many/.other`。
23. **无障碍与触屏**。角标 aria-label、选择器焦点管理、44px 触控目标、输入框 16px；归档禁用按钮的 tooltip 要可被键盘/辅助技术读到。
24. **宿主版本兼容**。缺少 `uiWorkspace`/`workspaces`/`sessions.create` 时隐藏入口，不要让插件启动失败。

## 10. 影响面

| 区域 | 文件 |
|---|---|
| 动作清单/工具条 | `src/client/selection/actions.ts`、`SelectionToolbar.tsx`、`ToolbarView.tsx`、`SelectionMenu.tsx` |
| 目标选择器 | 新增 `src/client/selection/SessionTargetPicker.tsx`、`src/client/selection/session-targets.ts`（纯逻辑） |
| 会话/工作区读取 | `src/client/context.d.ts` 扩展 `sessions.create`、`sessions.list` 字段、`workspaces.list`、`uiWorkspace.openSession` |
| 批注 store | `src/client/state/annotation-store.ts` 增加 outbound、跨会话写入、同步 API |
| 持久化 | `src/client/state/annotation-persistence.ts` 升 `v: 2`、`outbound`、保留策略 |
| 协议 | `src/client/protocol/annotation-protocol.ts` 的 compose/scan/restore |
| mark | `src/client/dom/annotate-text.ts`、`badge-layout.ts`、`styles.ts` 的箭头变体 |
| 预览/摘要 | `chipPreview.ts`、`ui/AnnotationCardView.tsx`、`transcript/TranscriptQuoteCard.tsx`、`UserMessageDisplay.tsx` |
| 导航 | `runtime.ts` 或新增 `selection/navigation.ts`；`uiWorkspace.openSession` 的失败处理 |
| 文案/图标 | `src/client/i18n.ts`、`locale/*.json`、`src/client/ui/icons.tsx` |
| 包声明 | `package.json` 的 `dsh.client.inject` 增加 workspace 相关包（配合特性检测） |
| 测试/文档 | `*.test.ts`、`scripts/verify-bundle.mjs`、`docs/internals.md`、`README.md`、`AGENTS.md` |

## 11. 测试计划

### 纯逻辑单测

- 目标目录：工作区分组、`updatedAt` 排序、排除当前/子代理/归档、默认目标、无其他会话时的默认“新会话”。
- 新会话：复用空白、无空白时创建、无工作区时用 cwd、都不可用时禁用。
- handoff store：目标写入 + 源 outbound；编辑/删除/清空/发送/撤回/取消的同步矩阵；去重；幂等；删除一个目标后同 `selectionKey` 组仍保留。
- 保留：本地 pending 按 20/7；未发送 handoff 的目标 pending 与源 outbound 成对按 20/7 淘汰；`sent` outbound 永久保留；只清一侧的异常由兜底对账修复。
- 事件同步：编辑/删除/清空/发送/撤回/取消在动作发生时立即更新另一侧，不依赖兜底对账；兜底对账只修复人为构造的单边异常。
- 发送顺序：先写 `sent` 再清目标 pending；模拟刷新后兜底对账不会把已发送记录误判为过期。
- 协议：`origin`（含 `handoffId`）往返、旧 payload v1、旧 wire 无 origin、`readComposedDraft` 保留 origin/handoffId、非法 origin 容忍。
- mark：pending 数字 job 与 outbound 箭头 job 共存；同 `selectionKey` 合并为一个 job；目标会话跳过跨会话 job；箭头角标宽度/命中框。
- i18n：八种语言键齐备、占位符守恒、复数形式正确。

### DOM 测试

- 选择器：键盘 ↑/↓/Enter/Esc、搜索、焦点返回、`data-dsq-menu` 放行。
- 评论面板：两个按钮、空评论可用、取消不写、IME 不提交。
- 源预览：标题栏图标（编辑 / 前往 / 删除）、编辑就地展开、取消放入内联两步、已发送状态、多目标分行、归档目标禁用 + tooltip。
- 目标卡片：来自点击、编辑同步、删除同步、清空同步、源归档禁用 + tooltip。
- 删除确认：输入框摘要、清空全部、待发预览、跨会话预览共用同一套「图标 → 图标 + 确认移除」两步交互。
- 发送拦截：新增控件不破坏“最后一个 button”判定。

### verify-bundle

- 协议闸更新；
- 持久化 `v: 2` 读取/回灌；
- 缺少 workspace 服务时入口隐藏、插件仍能激活；
- 现有贡献与八语言词典回归。

### 真实客户端手工验

- 源 → 已有会话：放入 / 放入并前往；目标输入框出现带“来自”的卡片；目标发送后源 mark 标“已发送”。
- 源 → 新会话：放入后侧栏出现“新会话”、源页不跳；前往打开新会话。
- 目标编辑评论 → 源预览更新；目标删除 → 源 mark 消失；目标清空 → 源 mark 消失；目标撤回 → 源状态回到待发送。
- 源取消放入 → 目标待发消失、源 mark 消失。
- 刷新两个会话、两个标签页、深色模式、八语言、触屏。
- 目标已归档、冷会话、长历史、跨工作区。

## 12. 分期

### MVP

- 目标选择器（当前工作区优先 + 其他工作区 + 未分组 + 新会话）。
- 「放入」/「放入并前往」。
- 源 outbound + 箭头 mark + 预览 + 取消放入（内联两步）。
- 预览标题栏图标：编辑（仅待发送）、前往、删除；编辑同时写回源 outbound 与目标 pending。
- 全插件删除入口共用内联两步确认（含 0.16s 展开过渡）。
- 未发送 handoff 与本地 pending 一样按 20/7 成对淘汰；目标发送后的 outbound 永久保留。
- 同一处选区多目标合并为一个箭头 mark，预览按目标分行。
- 目标 pending “来自” + 编辑/删除/清空/发送/撤回同步。
- 目标历史卡“来自” + 跳回源（只保证已加载历史）。
- 归档目标/源：toast + 跳转禁用 + tooltip；不自动取消归档。
- 不做目标消息精确滚动、不做撤销、不做侧栏标记。

### 第二阶段

- 目标消息 `flowKey` 回写，源 mark 精确滚到目标消息。
- 成功提示里的撤销。
- 源预览读取目标 pending 的最新评论（跨标签页）。
- 发送到其他工作区的新会话。

## 13. 已关闭的待定项

1. **outbound 保留**：未发送 handoff 的目标 pending 与源 outbound 共用 20 会话 / 7 天，成对淘汰；目标发送后 `state=sent` 的 outbound 才永久保留。
2. **新会话空白复用**：复用当前工作区已有的空白会话，没有才新建。
