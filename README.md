# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 客户端插件：为 DSH 增加**划词批注、引用**、**划词翻译**、**侧边子代理提问**，链接用**默认浏览器**打开。选中的原文连同评论随下一条消息交给模型，正文保留高亮与序号角标、可跳回原文；菜单可划词浮出或从右键打开，翻译可单独指定模型。

[![开放插件市场](https://img.shields.io/endpoint?url=https%3A%2F%2Fdshopen.org%2Fbadge%2Fdsh-select-quote.json)](https://dshopen.org/zh/plugins/dsh-select-quote/)
[![dsh.so risk](https://cdn.dsh.so/badge/dsh-select-quote.svg)](https://www.dsh.so/artifact/dsh-select-quote/?ref=badge)
[![npm version](https://img.shields.io/npm/v/dsh-select-quote)](https://www.npmjs.com/package/dsh-select-quote)
[![npm monthly downloads](https://img.shields.io/npm/dm/dsh-select-quote)](https://www.npmjs.com/package/dsh-select-quote)
[![license](https://img.shields.io/npm/l/dsh-select-quote)](LICENSE)
[![awesome-dsh-plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/)
[![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.2-blue)](package.json)

![dsh-select-quote](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/hero.png)

## 功能

- **划词工具条**：选中对话里的文字，浮出「打开链接 / 复制 / 翻译 / 添加批注 / 在侧边提问」；可选显示在选区上方或下方
- **就地翻译**：把选中文字直接翻成目标语言，译文在选区旁流式出现；模型思考时显示进度图标并实时展开推理，译文出现后推理折叠可查，目标语言默认跟随界面语言，可随时切换，结果可一键复制；同一段原文与设置再次打开时直接复用本次会话的内存缓存，不再调用模型
- **右键菜单与快捷键**：同一套操作也能从选区右键或键盘打开，键位可在宿主设置里改
- **批注摘要**：输入框上方显示「N 条批注」，可展开编辑、删除、跳回原文；发送后随消息清除
- **正文标记**：被划中的文字留下淡色底与序号角标，点击角标查看原文和评论；待发批注可在角标浮层里直接编辑或删除，与输入框展开的操作一致
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

1. 在对话区选中文字 → 点「添加批注」，批注立即保存；可在评论框补充，`Enter` 或 `⌘/Ctrl + Enter` 提交，`Shift + Enter` 换行
2. 悬停（触屏点按）输入框上方的摘要展开列表，编辑、删除或跳回正文；点正文角标查看批注预览
3. 正常发送：批注随消息交给模型，摘要消失，正文标记保留；模型回指处显示 chip
4. 「在侧边提问」会先打开输入框，点发送才创建子代理并在右侧栏打开；目录用「在侧边提问 · 问题摘要」命名
5. 「翻译」直接打开译文浮层并开始流式翻译：顶栏可换语言，「停止」可中断；完成后「复制译文」；Esc 或点外面关闭

选中文字后有三种方式打开菜单：自动浮出（默认）、选区右键、快捷键。触屏始终使用底部操作条。

| 操作 | 桌面 macOS | 桌面 Win/Linux | Web macOS | Web Windows | Web Linux |
|---|---|---|---|---|---|
| 打开划词菜单 | `⌘L` | `Ctrl+Shift+L` | `⇧⌘L` | `Ctrl+Shift+L` | `Ctrl+Shift+,` |
| 添加批注 | `⇧⌘L` | `Ctrl+Shift+.` | `⌥⌘L` | `Ctrl+Shift+.` | `Ctrl+Shift+.` |

## 设置

插件页 → `dsh-select-quote`，配置直接显示在插件外层页面：

- **划词入口**：自动浮出 / 右键菜单 / 两者都开，默认自动浮出
- **浮层位置**：自动浮出或两者都开时可选上方（默认）/ 下方，放不下自动翻面
- **快捷键**：开关两个命令并显示当前生效键位，改键在宿主的「快捷键」设置里
- **侧边提问的子代理**：每次独立（默认）/ 复用同一个；复用时目录只保留一条，但上下文与模型停在第一次创建时
- **翻译目标语言**：自动（默认，跟随界面语言；原文已是该语言时译成英文）或固定八种语言之一
- **翻译模型**：默认跟随当前对话，也可以单独选一个更快的模型
- **自定义提示词**：输入框的占位文字就是内置提示；留空使用内置提示，填写后整段覆盖，`{target}` 会替换为目标语言

## 语言

界面语言跟随 dsh 的语言设置，插件界面与插件页标题、描述一起切换，共八种（见上）。

## 已知限制

- **批注按会话持久化**：刷新或重启后未发送的批注会回来（保留最近 20 个会话、7 天）；发送即清除，分叉会话不继承
- **接管用户气泡**：以 `priority: -10` 接管内置 `user` / `steering` 节点，再委托宿主视图渲染；其它插件要赢过它，优先级必须小于 `-10`
- **划词只在对话区生效**：不介入编辑器、终端等面板；键盘用户需借助光标浏览或辅助技术建立选区
- **侧边提问要先发送**：宿主不允许在空会话上直接开子代理；复用模式没有模型入口
- **翻译只发选区**：请求不带会话上下文，也不写入批注；需要交给模型时请复制译文。单次上限约 6000 字，超时 90 秒；失败时浮层显示错误摘要，详情在控制台
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
