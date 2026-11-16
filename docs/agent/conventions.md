# 模块化、样式与测试约定

根行为约束见 [AGENTS.md](../../AGENTS.md)；宿主内部约定见 [internals](../internals.md)。

## 模块化与交互单源

- 纯逻辑（无 DOM、可单测）单独成模块，视图只做编排；跨模块只走公开出口。
- 每条动作流程一个 hook：`useSelectionMenu` / `useAnnotationFlow` / `useSideQuestion` / `useHandoffFlow` / `useTranslatePopover` / `useSystemActions`；不反向 import 入口组件。
- 动作清单单源在 `selection/actions.ts`；图标只在 `ui/icons.tsx`（React `LucideIcon` / 纯 DOM `iconMarkup()`）。

## CSS 与材质

- CSS 拼接顺序即层叠顺序，不得调换：`tokens → atoms → components（子系统顺序见 components/index.ts）→ host`；`styles.ts` 只做拼接、注入与类名导出。
- 颜色只走 `--dsq-*` 别名（四层：token / atoms / components / host），组件层不写 `--dsw-*`。
- 磨砂浮层的动画绝不带 `opacity`（祖先 `opacity < 1` 会切断 `::before` 的 backdrop 采样）；`--dsq-shadow` 与描边写在 `.dsq_toolbar` / `.dsq_commentPop` / `.dsq_summaryHoverInner` 上——自定义属性在声明处展开。

## i18n

- 每语言一份 `src/client/i18n/<lang>.ts`，八份必须同时改、键集合一致；界面文字一律 `t()`。

## 视图测试

- 用 `react-dom/server` 的 `renderToStaticMarkup` 做结构冒烟（样板：`ui/views.test.tsx`、`settings/rows.test.tsx`）：挡崩溃、标签丢失、条件写反、i18n key 没绑定。
- `t()` 未 bind 时返回 key 本身，断言文案前先 `bindTestLocale()`。
- 不要引入 jsdom / @testing-library：几何、CSS 层叠与材质、Lexical、宿主 DOM 契约都必须真机验，jsdom 对它们全盲（见 [internals](../internals.md) 排错表）。
- 要测新的渲染分支，先把它抽成可渲染的纯视图或纯函数（`ui/comment-block.ts` + `SummaryComment` 是样板），改坏了要能变红。

## React 时序回归

- 与 React reconcile 的时序契约（文本节点身份、MutationRecord 顺序、镜像归属、计算样式）用 `scripts/mirror-harness/` 验：真实 React 18 + headless Chrome，`pnpm run verify:mirror`（已并入 check）。
- 改 `decorateAnnotationDirectives.ts` 必须跑它，并把新分支写成断言——纯函数单测与静态闸盖不住时序，两个真缺陷都是它抓到的。
