# dsh-select-quote

DeepSeek Harness（dsh）web 客户端插件：对话区划词加批注——选中原文连同评论随下一条消息交给模型，正文留标记，模型可逐条回指。

## 命令

| 命令 | 用途 |
|---|---|
| `pnpm run check` | typecheck + test + build + verify，**提交前必跑** |
| `pnpm run build` / `watch` | 产出 `lib/`（**随源码提交**，运行时直读） |
| `pnpm run verify` | 无头跑 `lib/client.js`：贡献注册、八语言词典、包元信息、`npm pack` 清单 |
| `pnpm run sync:desktop` / `sync:web` | 把 `lib/` 推到已安装副本（宿主 500ms 热更新；**换版本仍需重启**） |
| `pnpm run release` | check → CHANGELOG → 版本 + tag（`<1.0.0` 时 `feat:`/`fix:` 都只跳 patch） |

包管理 pnpm。发布必须显式 `npm publish --registry=https://registry.npmjs.org/`（本机默认源是 npmmirror），随后 `PUT https://registry.npmmirror.com/-/package/dsh-select-quote/syncs`。**PUT 返回 202 是成功**：packument 与镜像都要几十秒才更新，别拿 `npm view` 判成败。

## 硬约束（违反即坏；原理见 docs/internals.md）

- 改 CSS / 槽位 / 协议前先读 `docs/internals.md` 的「依赖的产品内部约定」与「关键机制」；每次升 dsh 逐条复核。
- **绝不覆写 `conversation.chat.node`**：0.2.2 的注册表只返回胜出者，宿主条目会永久离开 `entries()`，气泡与动作行一起消失。批注卡挂 `conversation.chat.user.before`，协议块交给 `uiConversation.userText` 规则。
- 磨砂浮层的动画**绝不带 `opacity`**（会切断 `::before` 的 backdrop 采样）；`--dsq-shadow` 与描边必须写在 `.dsq_toolbar` / `.dsq_commentPop` / `.dsq_summaryHoverInner` 上——自定义属性在声明处展开。
- 颜色只走 `--dsq-*` 别名（`src/client/styles/` 四层：token / atoms / components / host），组件层不写 `--dsw-*`。
- 不写宿主语言偏好（`ctx.locale` 只读）；**不 `require` 任何 Harness Client 包**。
- 仓库内脚本不含个人绝对路径；`tmp/` 已 gitignore。
- commit 用中文 conventional；与 issue 相关写 `Refs #N`，确认修复后 `Fixes #N`。发布后的推送由 agent 完成。

## 模块化约定

- 纯逻辑（无 DOM、可单测）单独成模块，视图只做编排；跨模块只走公开出口。
- CSS 拼接顺序即层叠顺序，不得调换：`tokens → atoms → components（子系统顺序见 components/index.ts）→ host`；`styles.ts` 只做拼接、注入与类名导出。
- i18n 每语言一份 `src/client/i18n/<lang>.ts`，**八份必须同时改、键集合一致**；界面文字一律 `t()`。
- 交互单源：动作清单在 `selection/actions.ts`；图标只在 `ui/icons.tsx`（React `LucideIcon` / 纯 DOM `iconMarkup()`）。
- 每条动作流程一个 hook（`useSelectionMenu` / `useAnnotationFlow` / `useSideQuestion` / `useHandoffFlow` / `useTranslatePopover` / `useSystemActions`），不反向 import 入口组件。
- 任何拆分后跑 `pnpm run check`，并在真实客户端确认受影响的浮层与设置页。

## 文档

- `docs/internals.md` —— 机制、内部约定、排错（**只记现存**）
- `docs/archive/` —— 历史调查（结论已并入正文）
- `CHANGELOG.md` —— 自动生成，勿手改
- `README.md` / `README.en.md` —— 面向用户，改动要两份同步
