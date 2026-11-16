# dsh-select-quote

DeepSeek Harness（dsh）web 客户端插件：划词批注、就地翻译、侧边提问。

## 行为约束

- 提交前 `pnpm run check` 必须全绿；任何拆分/重构后重跑，并在真实客户端确认受影响的浮层与设置页。
- 改 CSS / 槽位 / 协议前先读 [docs/internals.md](docs/internals.md) 的「依赖的产品内部约定」与「关键机制」；每次升 dsh 逐条复核。
- **绝不覆写 `conversation.chat.node`**；批注卡挂 `conversation.chat.user.before`，协议块交给 `uiConversation.userText` 规则。
- 磨砂浮层的动画**绝不带 `opacity`**；`--dsq-shadow` 与描边写在浮层元素自身。
- 组件层颜色只走 `--dsq-*`，不写 `--dsw-*`；CSS 拼接顺序不得调换：`tokens → atoms → components → host`。
- 不写宿主语言偏好（`ctx.locale` 只读）；**不 `require` 任何 Harness Client 包**。
- 仓库内脚本不含个人绝对路径（`tmp/` 已 gitignore）；自己创建的临时文件在任务完成且确定不再需要时删除。
- `sync:*` 必须先删后写，别改回原地写（pnpm 副本是硬链接）。
- 发布只认显式 `npm publish --registry=https://registry.npmjs.org/`，随后触发 npmmirror 同步；**PUT 202 即成功**，别拿 `npm view` 判成败。
- commit 用中文 conventional；issue 关联写 `Refs #N`，确认修复后 `Fixes #N`；发布后的推送由 agent 完成。
- 纯逻辑（无 DOM、可单测）单独成模块，视图只做编排；跨模块只走公开出口。
- i18n 八份 `src/client/i18n/<lang>.ts` 必须同时改、键集合一致；界面文字一律 `t()`。
- 动作清单只在 `selection/actions.ts`，图标只在 `ui/icons.tsx`；每条动作流程一个 hook，不反向 import 入口组件。
- 改 `decorateAnnotationDirectives.ts` 必须为新分支在 [mirror harness](scripts/mirror-harness/) 写断言。
- 视图层测试只用 `renderToStaticMarkup`，**不引入 jsdom / @testing-library**；要测新分支先抽可渲染的纯视图或纯函数。

## 常用命令

- `pnpm run check` —— typecheck + test + build + verify + verify:mirror。
- `pnpm run verify:mirror` —— 真实 React + headless Chrome 的 DOM 契约回归（Chrome 可用 `CHROME_BIN` 指定）。
- `pnpm run sync:desktop` / `sync:web` —— 推到已安装副本；client 半热更，Host 半改动需重启。

完整命令、同步与发布流程见 [workflow](docs/agent/workflow.md)。

## 文档

- [docs/internals.md](docs/internals.md) —— 机制、产品内部约定、排错（只记现存）
- [docs/agent/workflow.md](docs/agent/workflow.md) —— 命令、同步、发布、验证流程
- [docs/agent/conventions.md](docs/agent/conventions.md) —— 模块化、CSS、i18n、测试细则
- [docs/limitations.md](docs/limitations.md) —— 限制与已知问题（中英双语）
- [docs/releases/](docs/releases/) —— 可选的手写 Release 开篇
- `docs/archive/` —— 历史调查（结论已并入正文）
- `CHANGELOG.md` 自动生成勿手改；`README.md` / `README.en.md` 改动两份同步。
