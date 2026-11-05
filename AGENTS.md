# dsh-select-quote

DeepSeek Harness（dsh）的 web 客户端插件：对话区**划词加批注**——选中原文连同评论随下一条消息交给模型，正文留下标记，模型可逐条回指。

## 命令

| 命令 | 用途 |
|---|---|
| `pnpm run check` | typecheck + test + build + verify，**提交前必跑** |
| `pnpm run test` | Vitest 纯逻辑用例（角标/定位/配置/快捷键矩阵） |
| `pnpm run build` / `watch` | 产出 `lib/`（**随源码一起提交**，运行时直读，别进 .gitignore） |
| `pnpm run verify` | 无头执行 `lib/client.js`：全部贡献注册、八语言词典齐备、包展示元信息按宿主规则解析、`npm pack` 发货清单核对 |
| `pnpm run sync:desktop` | 把 `lib/` 推给桌面客户端已安装副本（宿主 500ms stat 热更新；**换包版本仍需重启**） |
| `pnpm run release` | check → CHANGELOG → 版本号 + tag（`<1.0.0` 时 `feat:`/`fix:` 都只跳 patch） |

包管理用 pnpm。发布必须显式 `npm publish --registry=https://registry.npmjs.org/`——本机默认源是 npmmirror，滞后数小时；**tarball 落地（200）之后**再 `PUT https://registry.npmmirror.com/-/package/dsh-select-quote/syncs` 推镜像同步。

## 硬约束（违反即坏；原理与细节在 docs/internals.md）

- **改 CSS / 槽位 / 协议前先读** `docs/internals.md` 的「依赖的产品内部约定」和「关键机制」；每次升级 dsh 后逐条复核。
- **磨砂浮层的动画绝不带 `opacity`**（规范：`opacity<1` 的祖先会切断 `::before` 的 backdrop 采样源，磨砂整段消失）；`--dsq-shadow` 与描边覆写必须写在 `.dsq_toolbar` / `.dsq_commentPop` / `.dsq_summaryHoverInner` 选择器上——自定义属性在**声明处**展开，写在 body 上够不着也会外溢。
- **颜色只走 `--dsq-*` 别名**（`src/client/styles/` 四层：token / 原子 / 组件 / 宿主），组件层不直接写 `--dsw-*`；改完 CSS 要刷新页面或 `sync:desktop`。
- **不写宿主的语言偏好**（`ctx.locale` 只读）；**不 `require` 任何 Harness Client 包**（插件规范明令禁止，且抛错会清掉整个 slot 条目）。
- 提交进仓库的脚本**不含个人绝对路径**；`tmp/` 已被 gitignore，别把本地草稿提进去。
- **发布流程的推送由 agent 完成**（已授权）：release 后执行 `git push --follow-tags origin main`；commit 用中文 conventional 格式。
- **与 issue 相关的提交要在 message 里引用编号**（`Refs #N`）；确认修复后再用 `Fixes #N` 或手动关闭。

## 模块化约定（新增代码 / 重构直接照此执行）

- **按职责落位，不按大小堆文件**：纯逻辑（无 DOM、可单测）单独成模块，视图只做编排；持久化规则留在 store / persistence，DOM 生命周期留在组件或 hook。跨模块只走公开出口，不深引内部实现。
- **CSS 按层拆**：`src/client/styles/tokens.ts` / `atoms.ts` / `components/` / `host.ts` 各自负责一层；组件层再按子系统分成 `selection` / `model` / `annotations` / `composer` / `preview` / `handoff` / `a11y` / `settings`，由 `components/index.ts` 按原顺序拼接。`styles.ts` 只做四层拼接、注入与类名导出。拼接顺序 tokens → atoms → components → host 就是层叠顺序，不得调换；组件模块之间的顺序同样是层叠顺序，新增模块要插回对应位置并更新索引。
- **i18n 按语言拆**：每种语言一份 `src/client/i18n/<lang>.ts`，`i18n.ts` 只管类型、复数、绑定与 API。新增或修改文案必须八份同时改，键集合保持一致；界面文字一律走 `t()`，不要内联中文或英文。
- **交互单源**：工具条、右键菜单、触屏操作条共用 `selection/actions.ts` 的动作清单；删除确认、键帽、图标等重复出现第二份就抽共用组件或样式，不各写一套。图标只在 `ui/icons.tsx` 定义：React 用 `LucideIcon`，纯 DOM 用 `iconMarkup()`。
- **共享契约集中声明**：跨文件的 DOM 标记、事件语义放到小的常量模块（如 `picker-surface.ts`），避免同一个选择器散落在多个监听器里。
- **组件状态机留在组件，自洽流程拆 hook**：跨流程共享的相位、选中快照、收尾顺序由入口组件持有；每条动作流程各一个同目录 hook（`useSelectionMenu` / `useAnnotationFlow` / `useSideQuestion` / `useHandoffFlow` / `useTranslatePopover` / `useSystemActions`），通过参数拿回调与 ref，不反向 import 入口组件。
- **拆分要保持行为守恒**：CSS 拆分后做「去注释、压空白」的声明 diff；i18n 拆分后核对八语言键集合与占位符。入口模块保留原有导出，调用方不需要跟着改 import；这不等于兼容 shim，入口就是唯一公开面。
- **验证**：任何拆分后跑 `pnpm run check`，并在真实客户端确认受影响浮层/设置页仍正常。

## 文档

- [`docs/internals.md`](docs/internals.md) —— 机制、内部约定、排错（**只记现存**）
- [`docs/archive/`](docs/archive/) —— 历史调查记录（结论已并入正文，仅供溯源）
- `CHANGELOG.md` —— commit-and-tag-version 生成，勿手改
- 面向用户的是 `README.md`（简体中文）/ `README.en.md`（English），改功能说明要两份同步
