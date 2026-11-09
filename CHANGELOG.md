# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.4.3](https://github.com/latte03/dsh-select-quote/compare/v0.4.2...v0.4.3) (2026-11-09)

### Features

* 划词按钮增补批注开关，并保证至少留一个 ([204b0be](https://github.com/latte03/dsh-select-quote/commit/204b0be59cbd1f65e89efb092bc6833b97c0dfb1)), references [#11](https://github.com/latte03/dsh-select-quote/issues/11) [#11](https://github.com/latte03/dsh-select-quote/issues/11)
* 设置页改为五个 tab，记住上次所在组 ([2c8a60b](https://github.com/latte03/dsh-select-quote/commit/2c8a60b501d8d64f6f82bcba5922410004554bfc))
* 语言与模型下拉改用锚定式入场 ([b2f9161](https://github.com/latte03/dsh-select-quote/commit/b2f91614b283bcd8974b8b8c754687db2d08f3c6))

### Bug Fixes

* 去掉 tab 条的 mask-image 渐隐 ([aa2e338](https://github.com/latte03/dsh-select-quote/commit/aa2e338023a85a278599b4700c7c12865b4dfa32))

## [0.4.2](https://github.com/latte03/dsh-select-quote/compare/v0.4.1...v0.4.2) (2026-11-09)

### Features

* 并入宿主划词浮层，浮层位置默认改到下方 ([ce60fb5](https://github.com/latte03/dsh-select-quote/commit/ce60fb5262776cca967624ec9e9637d21979cf54))
* 批注分裂按钮、宿主浮层保活与窄列折叠 ([0d8bca6](https://github.com/latte03/dsh-select-quote/commit/0d8bca60e02ddcb65efccac0d86c032bf7a32b44))

### Bug Fixes

* 角标改为真实元素后点击穿透，恢复批注预览的点击目标与实测命中 ([b703e59](https://github.com/latte03/dsh-select-quote/commit/b703e59801fd391bf231cca7514f29ca348c732e))

## [0.4.1](https://github.com/latte03/dsh-select-quote/compare/v0.4.0...v0.4.1) (2026-11-06)

### Features

* 划词范围扩展到右侧文件预览 ([843433d](https://github.com/latte03/dsh-select-quote/commit/843433dee48ef9db18b05c97ec398a84a353c19c))
* 更新 hero.png 和 screenshot-1.png 资源文件 ([4661588](https://github.com/latte03/dsh-select-quote/commit/46615881e48f002bd1ef5465a7be9a4ad9b5bac1))

### Bug Fixes

* 对齐 0.2.2 插件文档规范 ([8ece5ab](https://github.com/latte03/dsh-select-quote/commit/8ece5abced89e1f418b18f9d38ff670c929ab0ee))
* 让 README 徽章在宿主 Markdown 预览中横排 ([9809480](https://github.com/latte03/dsh-select-quote/commit/9809480bad2b2a15b5183c0f972212c87d21bea1))

## [0.4.0](https://github.com/latte03/dsh-select-quote/compare/v0.3.21...v0.4.0) (2026-11-05)

### Features

* 状态提示改为表面配色并加错误图标，不可用入口改为禁用+悬浮说明 ([8595173](https://github.com/latte03/dsh-select-quote/commit/859517329ba84a81a61d8f2631fc9bf41a28bf03))

### Bug Fixes

* 草稿卡确认chip改为固定宽度绝对定位，卡内元素不再抖动 ([c29f263](https://github.com/latte03/dsh-select-quote/commit/c29f26306aedcb80e659f73b10d3cbc8b75d078c))
* 草稿卡确认chip回到标题行，提示hint保持满宽，卡片最小宽度210px ([df9a8e6](https://github.com/latte03/dsh-select-quote/commit/df9a8e6e841cd742ab6f115b0c246f44426fd8d6))
* 侧边提问的 mark 用机器人徽章并隔离父会话标记，修正换行 mark 的角标锚点 ([af9721a](https://github.com/latte03/dsh-select-quote/commit/af9721ae0eaf5672fe42736c34d292361e43b9f6))
* 侧边提问发送成功后消费对应待发批注，避免草稿卡片残留 ([4859abd](https://github.com/latte03/dsh-select-quote/commit/4859abdd5854bb4b781ab0a68a4ba91707032b0b))
* 翻译浮层关闭按钮居中对齐，复制改为图标按钮并补剪贴板兜底 ([d3fb048](https://github.com/latte03/dsh-select-quote/commit/d3fb0487683c5039580733e2b4a395fc84ecf19f))
* 角标设为不可选中，并让 mark 文本比对跳过角标字形 ([7a3d21a](https://github.com/latte03/dsh-select-quote/commit/7a3d21ac4a6cf8df58fb2c9b71d300d0f2da903a))
* 确认态改回流内撑开，chip 内 x 在左，不再遮挡或隐藏内容 ([af0e3b4](https://github.com/latte03/dsh-select-quote/commit/af0e3b4fbc1b947fe29c0ee71fb3babdebd78054))
* 确认态让静态文案让位，避免「确认移除」盖住标题与 × ([37f2811](https://github.com/latte03/dsh-select-quote/commit/37f28118f75c512b6a559b9bc43dbe46f2ba4f94))
* 删除确认退场先收文字再收宽度，进入则先开宽度 ([2104ee8](https://github.com/latte03/dsh-select-quote/commit/2104ee8dfa1721de95154e91f0118625649315d8))
* 适配 dsh 0.2.2 气泡管线，修复批注卡缺失与动作行丢失 ([50209c0](https://github.com/latte03/dsh-select-quote/commit/50209c077426f402b69b5b9a955626ed0123fa49))
* 修复状态提示白底白字，侧边提问按 Remote 可用性发布 ([e747bdb](https://github.com/latte03/dsh-select-quote/commit/e747bdba2a664fcae75ce2f5023dc17f1de5c45a))
* 修空气泡、确认移除挤压与历史卡来源跳转，新增 sync:web ([1529ffd](https://github.com/latte03/dsh-select-quote/commit/1529ffdc00cfd40eedef24cad0c8ca821285db0b))
* 子会话按 flow key 渲染自己的批注卡，并隔离父会话草稿与继承行的卡片 ([7ebc816](https://github.com/latte03/dsh-select-quote/commit/7ebc816ced810901a3f4a44e3842003b013b9fa8))

## [0.3.21](https://github.com/latte03/dsh-select-quote/compare/v0.3.20...v0.3.21) (2026-11-05)

### Features

* 增加同语言隐藏翻译开关 ([17036e2](https://github.com/latte03/dsh-select-quote/commit/17036e2773f2339af8fa4fb79a483c6733ec0a96))
* 支持将批注放入其他会话 ([2b3bfa4](https://github.com/latte03/dsh-select-quote/commit/2b3bfa49ed186ecab49b3098afe8fca3700a5398))

### Bug Fixes

* 修复右键菜单下会话选择器无法滚动 ([6bb0616](https://github.com/latte03/dsh-select-quote/commit/6bb06166e5ef5a35c61fde41a9a2cf6d78c88e60))
* 加固会话选择器生命周期与同语言判断 ([bdaeec4](https://github.com/latte03/dsh-select-quote/commit/bdaeec47644e620b3648f6aa9d500851691dde23))

## [0.3.20](https://github.com/latte03/dsh-select-quote/compare/v0.3.19...v0.3.20) (2026-11-03)

## [0.3.19](https://github.com/latte03/dsh-select-quote/compare/v0.3.18...v0.3.19) (2026-11-03)

### Features

* 声明 DSH 兼容范围，README 补收录徽章 ([49fb31f](https://github.com/latte03/dsh-select-quote/commit/49fb31f6343d2c69e79bce94884c13f13b43bc73)), references [polang233/dsh-plugin-index#209](https://github.com/latte03/dsh-select-quote/issues/209)

## [0.3.18](https://github.com/latte03/dsh-select-quote/compare/v0.3.17...v0.3.18) (2026-11-02)

### Features

* 划词工具条新增就地翻译 ([d65b1bb](https://github.com/latte03/dsh-select-quote/commit/d65b1bbdc94cc87b67d6ef0f89d309e0c94c9524))
* 角标预览支持编辑与删除待发批注 ([16dbeaa](https://github.com/latte03/dsh-select-quote/commit/16dbeaa34d58486ab692c5a9fc3343e21b26c09e))

## [0.3.17](https://github.com/latte03/dsh-select-quote/compare/v0.3.16...v0.3.17) (2026-10-29)

### Features

* 划词工具条支持固定显示在选区上方或下方 ([902ccf4](https://github.com/latte03/dsh-select-quote/commit/902ccf412deacea1ce0f45eb54981db505849052))
* 覆盖宿主全部八种界面语言 ([bddb7ea](https://github.com/latte03/dsh-select-quote/commit/bddb7ea5b3804abb381596531d51a88b44856ae8))

## [0.3.16](https://github.com/latte03/dsh-select-quote/compare/v0.3.15...v0.3.16) (2026-10-28)

### Bug Fixes

* 宿主已内置 ru 语言时不再重复注册 ([2d1acff](https://github.com/latte03/dsh-select-quote/commit/2d1acff8a3ed43eb26e7f8ff3f84fe44164a953f))

## [0.3.15](https://github.com/latte03/dsh-select-quote/compare/v0.3.14...v0.3.15) (2026-10-28)

### Bug Fixes

* 浮层宿主不再落进消息内容里的嵌套滚动容器 ([2f43d57](https://github.com/latte03/dsh-select-quote/commit/2f43d57eeb5ad6ef70f93d78f57b2194c4b08b9a))

## [0.3.14](https://github.com/latte03/dsh-select-quote/compare/v0.3.13...v0.3.14) (2026-10-27)

### Features

* 划词工具条支持「在侧边提问」子代理 ([e55a567](https://github.com/latte03/dsh-select-quote/commit/e55a5675ee2d7f3a92171fd7543953ec1a54391e))
* 工具条与右键菜单动作单源，输入框手势对齐宿主，设置分段控件滑动过渡 ([aad807d](https://github.com/latte03/dsh-select-quote/commit/aad807df2a90472fccbdee549013a2d8667fd95e))

## [0.3.13](https://github.com/latte03/dsh-select-quote/compare/v0.3.12...v0.3.13) (2026-10-26)

### Bug Fixes

* 分叉会话不再残留旧会话的待发划词标记 ([c93b9b7](https://github.com/latte03/dsh-select-quote/commit/c93b9b71e0111255ab277141e0a9bf0f17d85e25))
* 划词入口设置行改为左文案右控件 ([d0e6e74](https://github.com/latte03/dsh-select-quote/commit/d0e6e7401c3ad3a1c2c33a3a0001590efc421389))
* 同 tick 被覆盖的会话绑定不再 adopt ([18bde87](https://github.com/latte03/dsh-select-quote/commit/18bde872d18bcfc6632554de256dbcf023ec91f8))

## [0.3.12](https://github.com/latte03/dsh-select-quote/compare/v0.3.11...v0.3.12) (2026-10-23)

## [0.3.11](https://github.com/latte03/dsh-select-quote/compare/v0.3.10...v0.3.11) (2026-10-23)

### Features

* 正文标记点击/键盘回看批注，并接入测试与 CI ([db845fd](https://github.com/latte03/dsh-select-quote/commit/db845fdb516e578173e328856881e76af57d8a64))

## [0.3.10](https://github.com/latte03/dsh-select-quote/compare/v0.3.9...v0.3.10) (2026-10-23)

### Features

* 划词入口配置、右键菜单、双快捷键与角标避让 ([7727c8f](https://github.com/latte03/dsh-select-quote/commit/7727c8f3d264a44db5caab7b64bd72644de2045a))

## [0.3.9](https://github.com/latte03/dsh-select-quote/compare/v0.3.8...v0.3.9) (2026-10-22)

### Features

* 完善触屏划词交互与批注同步 ([9b1391d](https://github.com/latte03/dsh-select-quote/commit/9b1391d9ec5d50116b2ed3da0ac8757581769393))
* 统一批注 chip 预览与浮层交互 ([0d491d2](https://github.com/latte03/dsh-select-quote/commit/0d491d2215cfac4b1bf35d7cd1d5b7bc6ffaf622))

### Bug Fixes

* 加固批注协议与宿主委托边界 ([1fb5fbf](https://github.com/latte03/dsh-select-quote/commit/1fb5fbf34ba5e741f49136d14e7be81d9cec299f))

## [0.3.8](https://github.com/latte03/dsh-select-quote/compare/v0.3.7...v0.3.8) (2026-10-20)

### Bug Fixes

* 尊重宿主动作行，并修正撤回、回显与摘要展示 ([f55a70d](https://github.com/latte03/dsh-select-quote/commit/f55a70d77c437525a432052ec4a1fbb18ebb65ad))

## [0.3.7](https://github.com/latte03/dsh-select-quote/compare/v0.3.6...v0.3.7) (2026-10-20)

### Bug Fixes

* 批注正文标记的插入位置与序号徽章排版 ([7a6f16f](https://github.com/latte03/dsh-select-quote/commit/7a6f16fe7f0c712fb72788e769e5636ff36f5859))
* 浮层挂进滚动容器并重做评论步骤 ([faa844d](https://github.com/latte03/dsh-select-quote/commit/faa844d34e4ea9d6e39d5943ae9f4fbb45aba409))

## [0.3.6](https://github.com/latte03/dsh-select-quote/compare/v0.3.5...v0.3.6) (2026-10-19)

### Features

* 三个浮层统一宿主菜单材质、阴影与入场动画 ([541a453](https://github.com/latte03/dsh-select-quote/commit/541a453cba5cdf69cacc4896b9f3c19dcce9a03d))
* 插件页展示元信息对齐官方规范（locale + 图标） ([8161fae](https://github.com/latte03/dsh-select-quote/commit/8161faec9f5d80d5e5fa9ae389495001ce9bca98))

### Bug Fixes

* 持久化改用纯 localStorage，不再 require 宿主 client 包 ([2debc7a](https://github.com/latte03/dsh-select-quote/commit/2debc7acf8e554e6b599fd0a0c85dd2b4a6cfa1a)), references [#7](https://github.com/latte03/dsh-select-quote/issues/7)
* 描边覆写收窄到三个浮层，不再影响页面其它面板 ([0839eac](https://github.com/latte03/dsh-select-quote/commit/0839eacef1bc5642a6cff84e87fae67e6c79713a))
* 覆层不描边，阴影的描边环改用更浅的 border-l1 ([e29764a](https://github.com/latte03/dsh-select-quote/commit/e29764a5a7c4ab537591a3031e7869cbe7f4838c))

## [0.3.5](https://github.com/latte03/dsh-select-quote/compare/v0.3.4...v0.3.5) (2026-10-19)

### Bug Fixes

* 冷启动不再要求未使用的 sessions 服务 ([6679409](https://github.com/latte03/dsh-select-quote/commit/667940916e22ec15b329afbf7f6236d29cf36fd8))

## [0.3.4](https://github.com/latte03/dsh-select-quote/compare/v0.3.3...v0.3.4) (2026-10-16)

### Features

* 划中的是链接时，工具条给出「打开链接」 ([f093f02](https://github.com/latte03/dsh-select-quote/commit/f093f026a84610a817e8dd9c324aeecf180840fb))

### Bug Fixes

* 回指 chip 接住 characterData，流式期间就能渲染 ([607fdf7](https://github.com/latte03/dsh-select-quote/commit/607fdf748a53780896abac53ca3e8bac3dca8fa0))
* 窗口变化时工具条跟着选区重定位，不再就地消失 ([938d667](https://github.com/latte03/dsh-select-quote/commit/938d667a8ab4f44abacbeffb41d7dc8de9acadbe))

## [0.3.3](https://github.com/latte03/dsh-select-quote/compare/v0.3.2...v0.3.3) (2026-10-15)

### Features

* 待发批注按会话持久化 ([85bec59](https://github.com/latte03/dsh-select-quote/commit/85bec59feb4664d51a4f989a7d50e78f2a221a64))

### Bug Fixes

* 划词工具条只在对话区生效 ([b2ae7ad](https://github.com/latte03/dsh-select-quote/commit/b2ae7adadc08eecfb657dd4509a4b5ad5aa8bea3))

## [0.3.2](https://github.com/latte03/dsh-select-quote/compare/v0.3.1...v0.3.2) (2026-10-14)

### Features

* 桌面端热更新脚本 ([a69b634](https://github.com/latte03/dsh-select-quote/commit/a69b634ada08e2797259adaf7b6c8bf73918aedb))

### Bug Fixes

* 回指 chip 的 dataset 键不是合法标识符 ([afaeb11](https://github.com/latte03/dsh-select-quote/commit/afaeb112cf4b3302b223f848df441a0cf50479f9))

## [0.3.1](https://github.com/latte03/dsh-select-quote/compare/v0.3.0...v0.3.1) (2026-10-14)

### Features

* 界面语言改由 dsh 的语言设置决定 ([4a6c39f](https://github.com/latte03/dsh-select-quote/commit/4a6c39f2bed30c03c18227dc96eb733f8a6747a9))

## [0.3.0](https://github.com/latte03/dsh-select-quote/compare/v0.2.0...v0.3.0) (2026-10-14)

### Features

* **i18n:** localize UI into zh / en / ru ([8e3dfe3](https://github.com/latte03/dsh-select-quote/commit/8e3dfe3a520fd30fa792adb6a35279b1fc02fc14))

### Bug Fixes

* make sent comments visible and stop the comment box vanishing ([b45340b](https://github.com/latte03/dsh-select-quote/commit/b45340b3e22df100578d1df67cdd31b79023a3b1))
* render annotation cards inside the user bubble ([24b98a1](https://github.com/latte03/dsh-select-quote/commit/24b98a130174ae58252a9610b78b4edca3431efa))
* stop the annotation-directive decorator from wedging the renderer ([dab04c1](https://github.com/latte03/dsh-select-quote/commit/dab04c1d023b30598b9f616c0a1312efae959a0b)), references [#1](https://github.com/latte03/dsh-select-quote/issues/1)

## [0.2.0](https://github.com/latte03/dsh-select-quote/compare/300e977e151681ad45cd7b7e0871904487785d25...v0.2.0) (2026-09-24)

### Features

* adopt Qoder-style structured selection annotations ([d4c94a5](https://github.com/latte03/dsh-select-quote/commit/d4c94a5e7921e41f6c06e6b70ab40223bc16c314))
* flip popovers by remaining space and jump to annotation on click ([3a370f3](https://github.com/latte03/dsh-select-quote/commit/3a370f3379a342b2c3501471c749cf0ff88f749e))
* write back :dsh-annotation directives as clickable chips ([b390bdf](https://github.com/latte03/dsh-select-quote/commit/b390bdf62ab176676c68a67c5097d5d48d48586a))
* 划词引用插件（引用卡片、发送时注入引用块、对话记录卡片） ([300e977](https://github.com/latte03/dsh-select-quote/commit/300e977e151681ad45cd7b7e0871904487785d25))
* 划词批注正文标记与弹窗体验重构 ([a60db77](https://github.com/latte03/dsh-select-quote/commit/a60db77fed0c42de8d245a6b0f7f0713b3d35678))
* 柔和化划词工具条阴影，并加入示意图与 screenshots.json ([af42039](https://github.com/latte03/dsh-select-quote/commit/af42039cb92f9742d38c369a13ac64a3b5fd83b1))

### Bug Fixes

* close annotation popovers on pointer leave and add per-item edit/remove ([375310e](https://github.com/latte03/dsh-select-quote/commit/375310e95b895d9e9624379782235b8a68d16cea))
* keep annotation cards in history but hide the protocol header ([f11f93f](https://github.com/latte03/dsh-select-quote/commit/f11f93ff5eba9510e944e134523549cf756cc996))
* keep annotation cards out of the conversation history ([fb1df5d](https://github.com/latte03/dsh-select-quote/commit/fb1df5d90c2fc8c3d2e7070c46bf1ba2bf477b2a))
* keep annotation summary from covering the composer draft ([fc1952e](https://github.com/latte03/dsh-select-quote/commit/fc1952e728ac471430e2bb12367dd762e2a8b2e6))
* keep React hooks above early returns in annotation panels ([6d6eeb1](https://github.com/latte03/dsh-select-quote/commit/6d6eeb1ef35c18971c204ace56393c437b94506f))
* keep selection toolbar usable after add, unify pending annotation store ([202e996](https://github.com/latte03/dsh-select-quote/commit/202e996e883efaed00f5d8d21c34b60d9d2c9972))
* mount selection toolbar on shell.overlay and allow transcript selection ([753df40](https://github.com/latte03/dsh-select-quote/commit/753df4038b991eb608379e3299938a1b18a5a082))
* place annotation summary inside the composer at ~1/5 width ([147e7e5](https://github.com/latte03/dsh-select-quote/commit/147e7e5601cb2c30de1d91d454f22a2f60fae617))
* render AnnotationSummary as a component (React [#310](https://github.com/latte03/dsh-select-quote/issues/310)) ([b9dfc65](https://github.com/latte03/dsh-select-quote/commit/b9dfc657fc8ee418fac2acafbd55d5d33f7c97c5))
