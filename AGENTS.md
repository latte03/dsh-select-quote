# dsh-select-quote

DeepSeek Harness（dsh）的 web 客户端插件：对话区**划词加批注**——选中原文连同评论随下一条消息交给模型，正文留下标记，模型可逐条回指。

## 命令

| 命令 | 用途 |
|---|---|
| `pnpm run check` | typecheck + build + verify，**提交前必跑** |
| `pnpm run build` / `watch` | 产出 `lib/`（**随源码一起提交**，运行时直读，别进 .gitignore） |
| `pnpm run verify` | 无头执行 `lib/client.js`：8 项贡献注册、三语言词典齐备、包展示元信息按宿主规则解析、`npm pack` 发货清单核对 |
| `pnpm run sync:desktop` | 把 `lib/` 推给桌面客户端已安装副本（宿主 500ms stat 热更新；**换包版本仍需重启**） |
| `pnpm run release` | check → CHANGELOG → 版本号 + tag（`<1.0.0` 时 `feat:`/`fix:` 都只跳 patch） |

包管理用 pnpm。发布必须显式 `npm publish --registry=https://registry.npmjs.org/`——本机默认源是 npmmirror，滞后数小时；**tarball 落地（200）之后**再 `PUT https://registry.npmmirror.com/-/package/dsh-select-quote/syncs` 推镜像同步。

## 硬约束（违反即坏；原理与细节在 docs/internals.md）

- **改 CSS / 槽位 / 协议前先读** `docs/internals.md` 的「依赖的产品内部约定」和「关键机制」；每次升级 dsh 后逐条复核。
- **磨砂浮层的动画绝不带 `opacity`**（规范：`opacity<1` 的祖先会切断 `::before` 的 backdrop 采样源，磨砂整段消失）；`--dsq-shadow` 与描边覆写必须写在 `.dsq_toolbar` / `.dsq_commentPop` / `.dsq_summaryHoverInner` 选择器上——自定义属性在**声明处**展开，写在 body 上够不着也会外溢。
- **颜色只走 `--dsq-*` 别名**（`styles.ts` 四层：token / 原子 / 组件 / 宿主），组件层不直接写 `--dsw-*`；改完 CSS 要刷新页面或 `sync:desktop`。
- **不写宿主的语言偏好**（`ctx.locale` 只读）；**不 `require` 任何 Harness Client 包**（插件规范明令禁止，且抛错会清掉整个 slot 条目）。
- 提交进仓库的脚本**不含个人绝对路径**；`tmp/` 已被 gitignore，别把本地草稿提进去。
- **发布流程的推送由 agent 完成**（已授权）：release 后执行 `git push --follow-tags origin main`；commit 用中文 conventional 格式。

## 文档

- [`docs/internals.md`](docs/internals.md) —— 机制、内部约定、排错（**只记现存**）
- [`docs/archive/`](docs/archive/) —— 历史调查记录（结论已并入正文，仅供溯源）
- `CHANGELOG.md` —— commit-and-tag-version 生成，勿手改
- 面向用户的是 `README.md`（安装 / 用法 / 已知限制）
