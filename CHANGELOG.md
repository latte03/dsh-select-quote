# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

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
