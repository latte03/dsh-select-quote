# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 的客户端插件：在对话里**划词加批注**——选中的原文连同你的评论一起交给模型，并让它在回答里明确指出说的是哪一段。

- **划词工具条**：选中对话区任意文本，浮出「复制 / 添加到任务」；拖拽结束才出现，不挡操作
- **批注卡片**：添加后输入框内出现摘要卡片（可多条），草稿里不会出现任何协议文本
- **正文标记**：被划中的文字在原消息里留下虚线下划线 + 序号角标，点卡片条目会滚回那段文字
- **模型回指**：模型回答里指向某条批注的位置，渲染成可点击的 chip
- **对话记录**：已发送消息里的批注渲染成卡片，用户气泡只剩你打的问题
- **界面语言**：跟随 dsh 自己的语言设置，简体中文 / English / Русский

![screenshot](https://raw.githubusercontent.com/latte03/dsh-select-quote/main/assets/screenshot-1.png)

<sub>示意图（按产品真实设计 token 渲染，源文件 `assets/screenshot-1.mock.html`）</sub>

---

## 安装

网页版：

```bash
dsh plugin --profile web add dsh-select-quote
dsh --profile web
```

桌面版：在应用内输入`dsh-select-quote`安装，或者插件页搜索 `dsh-select-quote` 安装，重启客户端生效。

改了代码想立刻验证，用本地 checkout 加载：

```bash
git clone https://github.com/latte03/dsh-select-quote && cd dsh-select-quote
npm install && npm run build
dsh web --patch "$PWD/dev.patch.yml"
```

打开 `http://127.0.0.1:3080`，在对话消息里划词即可看到工具条。`dev.patch.yml` 里的插件路径必须是绝对路径，换机器或换目录时改那一行；该文件不随 npm 包发布。

## 用法

1. 在对话区选中一段文本，点「添加到任务」
2. 在弹出的评论框里写一句想说的话（可留空，只划不评），`⌘/Ctrl + Enter` 确认
3. 输入框上方出现批注卡片：悬停展开列表，可逐条编辑、删除或一键清空，点条目跳回正文对应文字
4. 正常打字发送，批注随消息一起交给模型，卡片随之消失
5. 模型回答里引用某条批注的位置显示为可点击 chip

## 语言

界面语言由 dsh 决定，插件不再自己判断浏览器语言。在 **设置 → 通用 → 语言** 里切换。


## 已知限制

- **待发批注只在内存里**：刷新页面或切换会话后会丢，卡片不持久化；已发送消息里的批注不受影响。
- **占用了用户气泡的渲染**：本插件以最低优先级替换内置 `user` 节点。其它插件若替换同一个键（例如 `dsh-easyrewrite` 用 `-1`），会被本插件屏蔽。
- **卡片宽度有限**：输入框内每条摘要最宽约为输入框的 1/4，超长标题走省略号。
- **划词只在对话区生效**：不介入编辑器、终端等面板。

## 常见问题

**升级 dsh 之后功能不对？** 先 `npm run check`；产物没问题就对照 [`docs/internals.md`](docs/internals.md) 的「依赖的产品内部约定」逐条复核，那里列了所有产品内部名。

**划词没有工具条？** 确认选区在对话区而不是编辑器里；刷新页面（样式与观察者是幂等注入的）；宿主 boot 日志里应出现 `dsh-select-quote`。

**输入框里出现了协议原文？** 发送前的注入没生效，一般是 composer 结构变了——检查 `[data-composer-card]` 是否还在。

**对话记录里没有批注卡片？** 卡片渲染在用户气泡内部，若 `user` 节点被别的接管者赢走，或那条消息里确实没有批注块，都不会出现。

**界面语言不跟着 dsh 变？** 文案取自宿主的语言服务；宿主没有该服务或语言未注册时回退到 English。此时确认 dsh 版本带 `dsh-client-locale`，以及设置里确有语言选项。

**改了 CSS 不生效？** 样式只注入一次，刷新页面。

## 开发

```bash
npm install
npm run check     # typecheck + build + verify
npm run watch     # 增量重建
```

`npm run verify` 无头执行产物，断言 8 项贡献都注册上，并检查三份词典的键与 `{placeholder}` 在每种语言里都齐备（复数消息必须有 `.other` 兜底）。

发布：先把源码与产物 `lib/` 一起提交，再跑

```bash
npm run release   # check → 追加 CHANGELOG.md → 提升版本号并打 tag
```

## 贡献

fork 后开分支，提交前跑 `npm run check`。一个 PR 只讲一件事，功能与文档分开，方便追溯。PR 里写清复现方式（环境、dsh 版本、操作步骤）。

## 致谢

- [@imallakov](https://github.com/imallakov)：多语言文案、跨平台构建、装饰器楔死修复与批注卡片归属（PR #2 / #3 / #4）
- [@EliteOtaku](https://github.com/EliteOtaku)：桌面端渲染进程楔死的定位报告与 CDP 探针方法（[#1](https://github.com/latte03/dsh-select-quote/issues/1)）

## License

[MIT](LICENSE) © 2026 agan
