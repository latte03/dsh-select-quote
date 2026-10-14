# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 的 Web 客户端插件：在对话里**划词加批注**——把选中的原文连同你的评论一起交给模型，并让它在回答里明确指出说的是哪一段。

- **划词工具条**：选中对话区任意文本，浮出「复制 / 添加到任务」；拖拽结束才出现，不挡操作
- **批注卡片**：添加后输入框内出现一张摘要卡片（可多条），**草稿里不会出现任何协议文本**
- **正文标记**：被划中的文字在原消息里留下虚线下划线 + 序号角标；点卡片里的条目会滚回那段文字
- **模型回指**：模型回答时以内联指令标出它处理的每一条批注，插件把这些指令渲染成可点击的 chip
- **对话记录**：已发送消息里的批注渲染为卡片，用户气泡只剩你打的问题

![screenshot](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/screenshot-1.png)

<sub>示意图（按产品真实设计 token 渲染，源文件 `assets/screenshot-1.mock.html`）</sub>

---

## 兼容性

| 项 | 值 |
|---|---|
| dsh | `0.1.7-rc.1`（2026-09-24 实测：划词、批注卡片、正文标记、对话记录渲染全通） |
| profile | web（`dsh web`）与桌面端（desktop）都可用；桌面端在 0.2.0 及更早版本会楔死渲染进程，`0.3.0` 起修复，详见下节 |
| 运行时 | 只有浏览器半有业务；Node 半仅用于让包被 Loader 挂载 |

实现依赖若干产品内部约定（槽位名、composer DOM、深色主题属性等），升级 dsh 后请先跑 `npm run check`，再照 [`docs/internals.md`](docs/internals.md) 末尾的复核清单人工回归一遍。

### 桌面端（desktop profile）

桌面端是 Electron 外壳 + 同一个 Web 客户端，插件声明的 `dsh.client.platform: "web"` 在桌面端同样加载，槽位与 DOM 契约都在，功能本身可用（实测批注随消息送达模型、模型回指渲染为 chip 均正常）。

> ⚠️ **0.2.0 及更早版本在桌面端会楔死渲染进程**，见 [#1](https://github.com/latte03/dsh-select-quote/issues/1)：App 能启动、界面完整渲染，但整个输入区无法点击，renderer 子进程单核 100% 持续旋转。根因在插件自己的装饰器里——协议头部逐字写出了 `:dsh-annotation{index="N"}`，当文本含有这个字面量而严格正则一条都没匹配上时，装饰器仍然替换了一次内容完全相同的 Text 节点，于是被自己的 `MutationObserver` 反复触发，微任务队列永远排不空，宏任务和定时器再也得不到执行。触发条件是文本内容，与 Electron 或 `dsh-app://` 无关，桌面端只是恰好把那段文本送进了 Text 节点。完整机制与两道防线记录在 [`docs/internals.md`](docs/internals.md) 关键机制 8。

> **现在的状态**：修复已在 `0.3.0` 发布，Windows 桌面端 0.2.0-rc.2 实测重新启用插件后批注正常送达、Turn 正常结束、输入框可点击、没有新的崩溃日志。桌面端请安装或升级到 `0.3.0`；仍停在 `0.2.0` 的话，在升级之前先在 `dsh.profile.bundles` 中摘除本插件，或改用浏览器访问同一个端口。[#1](https://github.com/latte03/dsh-select-quote/issues/1) 保持 open，等报告人复验后关闭。

## 安装

### 方式一：从 npm 安装（bundle）

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

> npm 上的最新是 `0.3.0`（2026-10-14 发布）：修掉了桌面端楔死、加了简体中文 / English / Русский 三语，并把对话记录里的批注卡片改到用户气泡内。上一个版本 `0.2.0`（2026-09-24 发布）已经带批注卡片、正文标记与模型回指，但界面只有简体中文，且在桌面端会楔死渲染进程（见兼容性一节）；仓库里另有 `0.1.0`，那是旧版「引用块」，不要装错。

### 方式二：本地 checkout 加载（`--patch`）

```bash
git clone <repo> && cd dsh-select-quote
npm install && npm run build
dsh web --patch "$PWD/dev.patch.yml"
```

打开 `http://127.0.0.1:3080`，在对话消息里划词即可看到工具条。`dev.patch.yml` 里的插件路径按本机写死（必须是绝对路径），换机器或换目录时改那一行；该文件不随 npm 包发布。

## 用法

1. 在对话区选中一段文本 → 点「添加到任务」
2. 弹出评论框，写一句想说的话（可留空，只划不评）→ `⌘/Ctrl + Enter` 确认
3. 输入框上方出现批注卡片，悬停可展开列表：逐条编辑、删除，或一键清空；点条目会跳到正文里对应的那段文字
4. 正常打字、按 Enter 发送。批注随消息一起交给模型，卡片随之消失
5. 模型回答里指向某条批注的位置，会显示成可点的 chip

## 语言 / Localization

界面文案支持 **简体中文 / English / Русский**，默认跟随浏览器语言：

| 语言 | 默认值 |
|---|---|
| `zh` | 原文案，同时作为缺失键的兜底词典 |
| `en` | 非中文环境 |
| `ru` | `ru` / `ru-RU` 等标签 |

想固定语言，在 Web GUI 控制台里设置后刷新页面：

```js
localStorage.setItem('dsq-locale', 'ru') // 'ru' | 'en' | 'zh'
localStorage.removeItem('dsq-locale')    // 恢复跟随浏览器
```

**刻意不翻译的部分**：`> [选中文本]`、`<response-annotations>`、`:dsh-annotation{index="N"}` 这些是模型与解析器约定的传输格式；`# Response annotations:` 那段是给模型的指令正文，不是界面文案。只有面向人的 chrome 走 `t()`。

新增文案：在 `src/client/i18n.ts` 的三份词典里各加一条，再在组件里 `t('key', { ... })` 调用。带 `{count}` 的键可以写成复数形式对象（中文用 `other`，俄语用 `one` / `few` / `many`）。

## 已知限制

- **待发批注只在内存里**：刷新页面或切换会话后会丢，卡片不持久化（已发送消息里的批注不受影响）。
- **占用了用户气泡的渲染**：本插件以最低优先级替换内置 `user` 节点。若其它插件也替换同一个键（例如 `dsh-easyrewrite` 用 `-1`），会被本插件屏蔽。
- **卡片宽度有限**：输入框内每条摘要最宽约为输入框的 1/4，超长标题走省略号。
- 划词只在对话区生效，不介入编辑器、终端等面板。

## 开发

```bash
npm run check   # typecheck + build + verify，提交前跑这个
```

改 CSS 后要刷新页面（样式只注入一次）。协议格式、槽位注册、以及几处非显而易见的坑（U+200B 草稿标记、portal 到 body 的浮层、`--dsq-quote-pad` 高度补偿）记录在 **[docs/internals.md](docs/internals.md)**。

## License

[MIT](LICENSE) © 2026 agan
