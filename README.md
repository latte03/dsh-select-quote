# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 的客户端插件：在对话里**划词加批注**——选中的原文连同评论随下一条消息交给模型，正文留下标记，模型可以逐条回指；也可以就任意一段原文在侧边开启**子代理对话**。

![dsh-select-quote](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/hero.png)

## 功能

- **划词工具条**：选中对话里的文字，浮出「复制 / 打开链接 / 添加到任务 / 在侧边提问」；可选显示在选区上方或下方
- **右键菜单与快捷键**：同一套操作也能从选区右键或键盘打开，键位可在宿主设置里改
- **批注摘要**：输入框上方显示「N 条批注」，可展开编辑、删除、跳回原文；发送后随消息清除
- **正文标记**：被划中的文字留下淡色底与序号角标，点击角标查看原文和评论
- **模型回指**：模型在回答里指向某条批注时渲染成带预览的 chip
- **侧边子代理**：就某段原文单独追问，在右侧栏开启子代理，不打断主会话；可独立选模型与推理等级，也可复用同一个子代理（目录只保留一条）
- **八种界面语言**：简体中文 / English / 日本語 / Español / Français / Deutsch / Русский / Português

## 安装

网页版：

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

桌面版：在应用内输入 `dsh-select-quote` 安装，或到插件页搜索安装，重启客户端生效。

本地开发：

```bash
git clone https://github.com/latte03/dsh-select-quote && cd dsh-select-quote
pnpm install && pnpm run build
cp dev.patch.example.yml dev.patch.yml   # 把 <CHECKOUT> 改成当前目录的绝对路径
dsh web --patch "$PWD/dev.patch.yml"
```

打开 `http://127.0.0.1:3080` 即可试用。`dev.patch.yml` 是未跟踪的本机文件，仓库只提供模板。

## 用法

1. 在对话区选中文字 → 点「添加到任务」，批注立即保存；可在评论框补充，`Enter` 或 `⌘/Ctrl + Enter` 提交，`Shift + Enter` 换行
2. 悬停（触屏点按）输入框上方的摘要展开列表，编辑、删除或跳回正文；点正文角标查看批注预览
3. 正常发送：批注随消息交给模型，摘要消失，正文标记保留；模型回指处显示 chip
4. 「在侧边提问」会先打开输入框，点发送才创建子代理并在右侧栏打开；目录用「在侧边提问 · 问题摘要」命名

选中文字后有三种方式打开菜单：自动浮出（默认）、选区右键、快捷键。触屏始终使用底部操作条。

| 操作 | 桌面 macOS | 桌面 Win/Linux | Web macOS | Web Windows | Web Linux |
|---|---|---|---|---|---|
| 打开划词菜单 | `⌘L` | `Ctrl+Shift+L` | `⇧⌘L` | `Ctrl+Shift+L` | `Ctrl+Shift+,` |
| 添加到任务 | `⇧⌘L` | `Ctrl+Shift+.` | `⌥⌘L` | `Ctrl+Shift+.` | `Ctrl+Shift+.` |

## 设置

插件页 → `dsh-select-quote`，配置直接显示在插件外层页面：

- **划词入口**：自动浮出 / 右键菜单 / 两者都开，默认自动浮出
- **浮层位置**：自动浮出或两者都开时可选上方（默认）/ 下方，放不下自动翻面
- **快捷键**：开关两个命令并显示当前生效键位，改键在宿主的「快捷键」设置里
- **侧边提问的子代理**：每次独立（默认）/ 复用同一个；复用时目录只保留一条，但上下文与模型停在第一次创建时

## 语言

界面语言跟随 dsh 的语言设置，插件界面与插件页标题、描述一起切换，共八种（见上）。

## 已知限制

- **批注按会话持久化**：刷新或重启后未发送的批注会回来（保留最近 20 个会话、7 天）；发送即清除，分叉会话不继承
- **接管用户气泡**：以 `priority: -10` 接管内置 `user` / `steering` 节点，再委托宿主视图渲染；其它插件要赢过它，优先级必须小于 `-10`
- **划词只在对话区生效**：不介入编辑器、终端等面板；键盘用户需借助光标浏览或辅助技术建立选区
- **侧边提问要先发送**：宿主不允许在空会话上直接开子代理；复用模式没有模型入口
- **Web Linux 快捷键受限**：宿主只接受 `Ctrl+/`、`Ctrl+Shift+,`、`Ctrl+Shift+.`，本插件用后两个

## 开发

```bash
pnpm run check          # typecheck + test + build + verify，提交前必跑
pnpm run watch          # 增量重建
pnpm run sync:desktop   # 推到桌面客户端已安装副本（500ms 热更新）
pnpm run release        # check → CHANGELOG → 版本号 + tag
```

`lib/` 随源码一起提交，运行时直接读取。发布走 `npm publish --registry=https://registry.npmjs.org/`，再推 npmmirror 镜像同步。

机制、内部约定与排错见 [`docs/internals.md`](docs/internals.md)；历史调查记录在 [`docs/archive/`](docs/archive/)。

## 致谢

[@imallakov](https://github.com/imallakov)（多语言与跨平台构建）、[@Ladersbt](https://github.com/Ladersbt)（chip 预览反馈）、[@EliteOtaku](https://github.com/EliteOtaku)（桌面端问题定位）。

## License

[MIT](LICENSE) © 2026 agan
