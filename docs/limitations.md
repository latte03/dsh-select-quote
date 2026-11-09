# 已知限制 / Known limitations

从 [README](../README.md) 抽出来的部分：这些是行为边界，不是故障，
放在这里以免插件页的说明占满整屏。

---

## 中文

- **批注按会话持久化**：未发送的批注保留最近 20 个会话 / 7 天，刷新或重启后回来，发送即清除，分叉会话不继承
- **放入其他会话依赖宿主版本**：需要宿主提供工作区与 `openSession`，旧版本自动隐藏入口；从目标跳回只保证已加载的历史
- **不接管用户气泡**：批注卡挂在 `conversation.chat.user.before` 席位，气泡、附件、时间与复制行仍归宿主；协议块由 `uiConversation.userText` 规则剥离。需要 dsh ≥ 0.2.2-rc.1
- **划词范围**：对话正文与右侧文件预览；文件树、编辑器、终端不介入。文件预览里没有「在侧边提问」，划词也不会改变文件正文
- **侧边提问要先发送**：宿主不允许在空会话上直接开子代理；复用模式没有模型入口
- **翻译只发选区**：不带会话上下文，也不写入批注；单次约 6000 字、超时 90 秒，失败时浮层显示错误摘要
- **Web Linux 快捷键受限**：宿主只接受 `Ctrl+/`、`Ctrl+Shift+,`、`Ctrl+Shift+.`，本插件用后两个

---

## English

- **Annotations persist per session**: unsent annotations come back after a refresh (last 20 sessions / 7 days); sending clears them and forked sessions do not inherit them
- **Send-to-session depends on the host version**: it needs the host's workspace and `openSession`; older versions hide the entry. Jumping back from the target only guarantees history that is already loaded
- **Leaves the user bubble alone**: the card mounts on the `conversation.chat.user.before` seat, so the bubble, attachments and time/copy row stay the host's; the protocol block is stripped by a `uiConversation.userText` rule. Requires dsh ≥ 0.2.2-rc.1
- **Selection scope**: the conversation and file previews in the right Sidebar; the file tree, editors and terminals are left alone. File previews have no **Ask in sidebar**, and selecting text never changes the file
- **Sidebar questions must be sent**: the host does not allow creating a subagent in an empty session; reuse mode has no model entry
- **Translation sends only the selection**: no conversation context, no annotation written; about 6,000 characters and a 90-second timeout, with an error summary in the popover
- **Web Linux shortcuts are limited**: the host accepts only `Ctrl+/`, `Ctrl+Shift+,` and `Ctrl+Shift+.`; this plugin uses the latter two
