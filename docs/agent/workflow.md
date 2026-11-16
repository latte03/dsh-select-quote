# 命令、同步与发布

根行为约束见 [AGENTS.md](../../AGENTS.md)；机制与宿主约定见 [internals](../internals.md)。

## 命令

包管理用 pnpm。

| 命令 | 用途 |
|---|---|
| `pnpm run check` | typecheck + test + build + verify + verify:mirror，**提交前必跑** |
| `pnpm run build` / `watch` | 产出 `lib/`（**不入库**，见 .gitignore；发布由 prepublishOnly 自动构建） |
| `pnpm run verify` | 无头跑 `lib/client.js`：贡献注册、八语言词典、包元信息、`npm pack` 清单、Host 半 side-task activation 契约 |
| `pnpm run verify:mirror` | 真实 React + headless Chrome 跑 `scripts/mirror-harness/`：批注镜像切分的 DOM 契约回归（需要 Chrome，可用 `CHROME_BIN` 指定） |
| `pnpm run sync:desktop` / `sync:web` | 把 `lib/` 推到已安装副本；client 半热更，Host 半改动需重启 |
| `pnpm run release` | check → CHANGELOG → 版本 + tag（`<1.0.0` 时 `feat:`/`fix:` 都只跳 patch） |
| `node scripts/release-body.mjs <tag>` | 预览该版本的 Release 正文（可选开篇 + CHANGELOG 节 + 页脚），推 tag 后由 workflow 自动用到 |

## 同步到已安装副本

- 宿主每 500ms 检查 client 产物，`lib/client.js` 热更无需重启（机制见 [internals](../internals.md) 的「桌面客户端的热更新」）。
- Host 半（`lib/index.js` / `lib/typert.js`）在宿主启动时加载，改完必须完全退出并重启客户端；换包版本同样要重启。
- **必须先删后写**：pnpm 把每个 profile 的副本装成指向同一 store 文件的硬链接，原地写会连带改掉别的 profile 和 store（曾把桌面端改成开发构建，也出现过「profile 写 0.4.3、跑的是 0.4.1」）。`scripts/sync-desktop.mjs` 已 `rmSync` 再写，别改回去。
- 确认安装副本与构建一致：对 `index.js` / `client.js` / `remote.js` / `typert.js` 逐个 `cmp`。

## 发布

- `pnpm run release` 生成 CHANGELOG、版本与 tag；需要解释设计取舍时先写 `docs/releases/<version>.md`，workflow 会把它拼在 CHANGELOG 节前面。
- 必须显式发布到官方源：`npm publish --registry=https://registry.npmjs.org/`（本机默认源是 npmmirror）。
- 随后触发镜像同步：`PUT https://registry.npmmirror.com/-/package/dsh-select-quote/syncs`。**PUT 返回 202 是成功**；packument 与镜像要几十秒才更新，别拿 `npm view` 判成败。
- 发布后的推送（main + tag）由 agent 完成。

## 验证

- `pnpm run check` 是唯一提交闸，纯函数与视图测试不能替代真机：几何、CSS 层叠与材质、Lexical、宿主 DOM 契约必须在真实客户端验。
- 改 CSS / 槽位 / 协议后，在真实客户端确认受影响的浮层与设置页。
