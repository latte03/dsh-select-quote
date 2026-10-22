# dsh-select-quote

[DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) 的客户端插件：在对话里**划词加批注**——选中的原文连同你的评论一起交给模型，并让它在回答里明确指出说的是哪一段。

- **划词工具条**：选中对话区任意文本，浮出「复制 / 添加到任务」；选中的是链接时多一个「打开链接」，用系统默认浏览器打开（绕开应用内浏览器）；拖拽结束才出现，不挡操作
- **批注摘要**：添加后输入框上方出现一块「N 条批注」摘要，草稿里不会出现任何协议文本
- **正文标记**：被划中的文字在原消息里留下虚线下划线 + 序号角标，点摘要条目会滚回那段文字
- **模型回指**：模型回答里指向某条批注的位置，渲染成可点击的 chip
- **对话记录**：已发送消息仍由宿主气泡渲染（时间、复制、撤回都在），批注收成一块摘要，悬停展开列表
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
pnpm install && pnpm run build
cp dev.patch.example.yml dev.patch.yml   # 把 <CHECKOUT> 改成当前目录的绝对路径
dsh web --patch "$PWD/dev.patch.yml"
```

打开 `http://127.0.0.1:3080`，在对话消息里划词即可看到工具条。本地 patch 里的插件路径必须是绝对路径（checkout 不在 profile 的 `node_modules` 里）；`dev.patch.yml` 是每台机器自己的未跟踪文件，仓库只提供 `dev.patch.example.yml`。

## 用法

1. 在对话区选中一段文本，点「添加到任务」——到这一步批注就已经保存，输入框上方同步出现批注摘要。触屏下操作条固定在屏幕底部，不跟随选区挤在系统选择菜单旁边
2. 想补充的话在弹出的评论框里写一句，点「添加评论」或 `⌘/Ctrl + Enter`；不写就直接点空白处或「暂不评论」，批注同样保留。触屏下评论在底部抽屉里完成，抽屉顶部会带上选中的原文
3. 悬停（触屏点按）摘要展开列表，可逐条编辑、删除或一键清空，点条目跳回正文对应文字；键盘聚焦摘要后按 Enter / ↓ 展开，Tab 在面板内移动，Esc 关闭并回到摘要
4. 正常打字发送，批注随消息一起交给模型，摘要随之消失
5. 模型回答里引用某条批注的位置显示为可点击 chip

## 语言

界面语言由 dsh 决定，插件不再自己判断浏览器语言。在 **设置 → 通用 → 语言** 里切换。

## 插件页展示

插件管理页与设置项里的标题、描述、图标来自包自带的资源，宿主读取它们时**不会激活插件**：

- `locale/*.json` 的 `meta.title` / `meta.description`（`en.json` 是发现入口，其余语言文件与它同目录同名）
- `icon.svg`（SVG / PNG / JPEG / WebP，≤256 KiB，必须在包内）

标题按当前语言取，取不到回退 `package.json` 的 `name` / `description`；图标缺失时用面板的默认插画。要加一种语言，往 `locale/` 放一个同名 JSON 即可，`pnpm run check` 会按宿主的规则逐条校验（语言 id 文件名、字段非空、图标类型与体积、`exports` 与 `files` 覆盖、`npm pack` 实际清单）。


## 已知限制

- **待发批注按会话持久化**：刷新页面、重启客户端后回到原会话，未发送的批注会原样回来（与草稿同在 localStorage，键各自独立）；保留最近 20 个会话、7 天。发送即清除，切换会话跟着切，hero 里换工作区等于换会话，批注不跟着搬。同一会话开多个标签页时通过 `storage` 事件同步，按最后写入为准；一个标签发送清空后，另一个标签不会把旧批注写回。
- **占用了用户气泡的渲染**：本插件以最低优先级替换内置 `user` 节点，再把宿主 `UserMessageNodeView` 原样委托渲染。其它插件若替换同一个键（例如 `dsh-easyrewrite` 用 `-1`），会被本插件屏蔽。
- **摘要宽度有限**：输入框上方只有一块摘要（约输入框的 1/5，148–220px），条目标题在悬停列表里超长时省略。
- **划词只在对话区生效**：不介入编辑器、终端等面板。
- **创建选区仍依赖指针**：对话正文是静态渲染，没有可放置的键盘光标；键盘用户需借助光标浏览或辅助技术建立选区。选区建立后的工具条按钮可聚焦，摘要面板已支持 Enter / ↓ / Tab / Esc 与触屏点按。

## 常见问题

**升级 dsh 之后功能不对？** 先 `pnpm run check`；产物没问题就对照 [`docs/internals.md`](docs/internals.md) 的「依赖的产品内部约定」逐条复核，那里列了所有产品内部名。

**划词没有工具条？** 确认选区在对话区而不是编辑器里；刷新页面（样式与观察者是幂等注入的）；宿主 boot 日志里应出现 `dsh-select-quote`。工具条挂在对话滚动区里，随正文一起滚动，滚到顶部会像正文一样滑进 header 下面；选中行完全滚出视口后收起，滚回去重新出现。

**点空白处批注会丢吗？** 不会。点「添加到任务」时批注已经保存，空白点击只关闭评论框；已经写了一半的评论会一并保存到那条批注上。

**输入框里出现了协议原文？** 发送前的注入没生效，一般是 composer 结构变了——检查 `[data-composer-card]` 是否还在。

**对话记录里没有批注摘要？** 摘要块渲染在宿主用户气泡上方；若 `user` 节点被别的接管者赢走、或那条消息里确实没有批注块，都不会出现。块的开闭标记完整但 JSON 损坏时，气泡只剥掉协议原文、不显示摘要。宿主视图解析失败是另一回事：摘要还在，只是气泡退回纯文本、时间/复制行不再渲染。

**界面语言不跟着 dsh 变？** 文案取自宿主的语言服务。插件把 `dsh-client-locale` 列为必需服务（当前 dsh 版本均内置）；宿主缺少该服务时插件不会激活，而不是静默回退到 English。语言存在但词典缺键时按 `en` 兜底。确认设置里确有语言选项。

**改了 CSS 不生效？** 样式只注入一次，刷新页面。

## 开发

```bash
pnpm install
pnpm run check     # typecheck + build + verify
pnpm run watch     # 增量重建
```

依赖用 pnpm 管理（锁文件 `pnpm-lock.yaml`）；构建产物 `lib/` 随源码一起提交，运行时直接读它。

`pnpm run verify` 无头执行产物，断言 9 项贡献都注册上，并检查三份词典的键与 `{placeholder}` 在每种语言里都齐备（复数消息必须有 `.other` 兜底），外加插件页展示元信息（locale + icon）按宿主的读取规则解析、并核对 `npm pack` 的实际发货清单。

### 热更新到桌面客户端

宿主每半秒比较一次各插件 client 产物的文件状态，一旦变化就通过 `/plugins/events` 让页面只重载这个模块，所以运行中的客户端不用重启：

```bash
pnpm run sync:desktop             # 把 lib/ 推给已安装的副本
pnpm run sync:desktop -- --watch  # 常驻：lib/ 一变就推
pnpm dev:desktop                  # 增量重建 + 推送，一条命令
```

目标路径按 `$DSH_HOME`（默认 `~/.dsh`）与 profile 名推导，profile 用 `--profile <name>` 或 `$DSH_PROFILE` 指定，默认 `desktop`。字节没变就不写，避免空重载。模块级重载会重置内存状态，但未发送的批注已按会话持久化，重新挂载后会自己回来。

发布：先把源码与产物 `lib/` 一起提交，再跑

```bash
pnpm run release   # check → 追加 CHANGELOG.md → 提升版本号并打 tag
```

## 贡献

fork 后开分支，提交前跑 `pnpm run check`。一个 PR 只讲一件事，功能与文档分开，方便追溯。PR 里写清复现方式（环境、dsh 版本、操作步骤）。

## 致谢

- [@imallakov](https://github.com/imallakov)：多语言文案、跨平台构建、装饰器楔死修复与批注归属（PR #2 / #3 / #4）
- [@EliteOtaku](https://github.com/EliteOtaku)：桌面端渲染进程楔死的定位报告与 CDP 探针方法（[#1](https://github.com/latte03/dsh-select-quote/issues/1)）

## License

[MIT](LICENSE) © 2026 agan
