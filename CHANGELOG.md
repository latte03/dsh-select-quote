# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.


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
