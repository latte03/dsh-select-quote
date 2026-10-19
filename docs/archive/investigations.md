# 历史调查记录（归档）

只读存档。每条结论都已并入 [`../internals.md`](../internals.md) 正文或代码注释，这里保留过程与证据，仅供溯源——**不要据此推断现状**，以 internals.md 和当前代码为准。

---

## 2026-10-19 · 磨砂浮层与入场动画的冲突（backdrop-filter × animation）

**背景**：工具条、评论气泡、悬停面板统一改用宿主菜单材质（`--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter`，画在 `z-index:-1` 的 `::before` 图层上）后，用户报告「动画时卡顿，怀疑 backdrop-filter 合成」。

**过程**：
1. 先做帧率测量，全部 0% 丢帧——但随后发现**测量无效**：本机 headless Chrome（CLI `--headless=new --disable-gpu` 与 chrome-devtools MCP 实例两个通道）**根本不渲染 backdrop-filter**，最小页面（div + `backdrop-filter: blur(20px)` + 斜纹背景）即可复现——截图里只有半透明填充、条纹完全没被糊。同一环境里「磨砂消失」的截图因此全是假象。
2. 规范层面唯一实锤的一条：**祖先带上 `opacity<1` 就会成为 backdrop root**，`::before` 采样不到身后的页面，磨砂在整段淡入里消失、结束才「啪」糊上。据此删掉工具条与面板的所有入场 opacity（面板的 `opacity:0` 定位前守卫保留，改成瞬时翻转）。
3. 「祖先带 transform 也切断采样源」一度被当成结论，来源正是上面那个假象，**未能验证**。用户随后在真实客户端 A/B：scale 放在 `.dsq_toolbar` 容器上磨砂全程正常，与规范一致（transform 不形成 backdrop root）。于是入场定稿为 `translate(-50%,-100%) translateY(4px) scale(0.96) → 归位`，无 opacity。
4. 收窄描边覆写时踩到第二个坑：`--dsw-elevation-stroke-color` 的覆写从 body 挪到三个浮层选择器后**没生效**——自定义属性是在**声明处**展开的，`--dsq-shadow` 留在 body 上时 `var(--dsw-elevation-prominent)` 在 body 就被替换成默认描边那一版并继承下来。把 `--dsq-shadow` 的声明一起挪过去才生效（无头实测：三个浮层 0.04、宿主面板仍 0.16）。

**结论**：opacity 绝不进场；transform 可以；磨砂的视觉验证与开销测量只能在真实客户端做。已并入 internals.md 关键机制 8 与 styles.ts 注释。

## 2026-10-15 · 待发批注持久化：为什么最终不用宿主 client-store

最初的方案（Q2=(a)）是用宿主种子模块 `@deepseek-ai/dsh-client-store` 的 `defineStore`（和 composer 草稿同一机制、按 sessionId 自动分片）。核实两点后推翻：

1. 新版插件规范明确**不要 require Harness Client 包**（原话：它们随时会变、纯 JS 无类型检查、抛错会把你整个 slot 条目清掉）。而本插件的后端选择发生在 `apply()` 的 effect 里，`try/catch` 只包得住 `require`——`defineStore().create()` 只要因宿主改 API 而抛，就是 issue #7 那类「启动健康检查未激活 → 无错误信息的硬失败」。
2. 宿主的持久化底层本来就是 localStorage（`yI()`：构造时整值读入、每次变更整值写回、键 `${persist}.${scopeKey>`），与直接后端**同键同形**——换过去零迁移、零数据丢失，0.3.3–0.3.5 用户已存数据原样可见。

**结论**：纯 localStorage 单后端（`createStoragePersistence` + `createNoopPersistence`），`annotation-storage.ts` 只剩环境探测。

## 2026-10-08 · 对话记录卡片必须挂在 `user` 节点上

现象：注册了独立的 `select-quote` Chat 节点，**挂载了、然后被隐藏**——外部表现「卡片不存在」，不报错、不写 crash log。定位：`conversation.chat.node` 虽可注册任意 key，但 `ui-chat` 用 allowlist `TURN_PROCESS_INDEPENDENT_KINDS` 决定节点能否脱离「Turn 过程折叠块」：

```js
// dsh-client-ui-chat, ChatNodeSeat
const TURN_PROCESS_INDEPENDENT_KINDS = new Set([
  "system-prompt", "user", "steering", "turn-trigger", "turn-process",
  "turn-error", "turn-max-tokens", "turn-tail"
])
const processMember = ... && !TURN_PROCESS_INDEPENDENT_KINDS.has(routedNode.kind) && ...
const processHidden  = controllerInactive || foldable && processMember && !processOpen
```

`select-quote` 不在表里 → 被判为 turn-process 成员 → 已结束的 Turn 折叠 `process` 区块后 `processHidden = true`，`useSearchableHidden` 给外层加 `hidden`。`user` 在表里，所以只有挂在 `user` 节点上才稳定可见。

**结论**：卡片由替换 `user` 节点的 `UserMessageDisplay` 内联渲染（priority -10）。诊断方法：注册的节点永远先查这张表，再怀疑注册/匹配/解析链路。

## 2026-09 · 装饰观察者自我触发导致渲染进程楔死（issue #1）

现象：桌面端主线程单核 100%、输入区不可点，`Debugger.pause` 都进不去（中断同样排不上队）。根因在插件自己的装饰器里，与加载路径无关（报告时只在 Electron 路径复现，是因为桌面端恰好把毒串送进了 Text 节点）：

`decorateTextNode()` 的退出条件是文本不含字面量 `:dsh-annotation{`。协议头部原文里就带着这个字面量（`# Response annotations:` 那段指令在描述内联标记时逐字写出了 `:dsh-annotation{index="N"}`，`N` 是字母），而严格正则只接受数字，于是「含字面量、零匹配」成立：`while` 一次都不进，`last` 停在 `0`，末尾仍然执行

```js
if (last < value.length) frag.append(document.createTextNode(value.slice(last)))
parent.replaceChild(frag, node)   // 换成一个内容完全相同的新 Text 节点
```

`watchAnnotationDirectives()` 监听 `{childList, subtree, characterData}`，回调对新节点再调 `decorateTextNode()`——它一直在装饰自己刚产出的节点。`MutationObserver` 回调是微任务，队列永远排不空，宏任务、定时器、`Runtime.evaluate` 全得不到执行。

**结论**：两道防线——① 严格正则一次都没匹配上，就在碰 DOM 之前 `return`；② composer 全程不碰（跳过 `textarea` / `input` / `[data-lexical-editor="true"]`）。通用规则：**没有实际命中就不要写 DOM**；**别把自己输出的节点当成新输入**。

## 2026-09 · `verify` 的由来：CSS 模板字符串反引号事故

`tsdown` 不做类型检查。一次事故：CSS 模板字符串里出现了反引号（`` `.nyYjTG_file` ``），字符串被提前截断，产出的 JS 无法执行，而 build 输出一切正常。于是有了 `scripts/verify-bundle.mjs`：把 `lib/client.js` 放进假的 `window.__ModuleLoader__` 里跑一遍，用 mock ctx 调 `apply()`，逐项核对注册结果——这是唯一能在浏览器之外发现这类错误的手段。改动 `src/client/index.tsx` 的注册项时，记得同步 `EXPECTED`。

## 2026-09 · 草稿重写与输入法（早期 `setDraft` 坑）

早期版本在 `useEffect` 里依赖 `draft`，一旦发现 U+200B 标记缺失就补写——而 `inputActions.setDraft()` 的实现是 `root.clear()` + 逐行重建 + 光标移到末尾。后果：用户按 Backspace 删到标记时会被立刻补回（表现为「删除失效」）；输入法组字期间甚至会把正在组字的编辑器内容整段清掉（表现为「打完中文按 Backspace 没反应」，即 2026-10-15 修复的「拼音第一个字符被删」的同一族问题）。

**结论**：标记只按 `itemCount` 变化驱动（`useDraftMarker.ts`），**永远不要因为草稿变化就重写编辑器**；对账期间一律不写草稿。
