/** Selection toolbar, context menu, overlays and status chrome.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const SELECTION_CSS = `
/* Layer 3 — components. Floating selection toolbar. */

/* 入场动画位置（2026-10-19 定稿）：scale + Y 位移都放在 .dsq_toolbar 容器上。
   规范层面 transform 不形成 backdrop root（opacity 才会），磨砂不受影响；用户已在
   真实客户端验证过容器 scale 没问题。若日后换环境再出问题，回退路径：去掉容器上的
   animation，给 .dsq_toolbarInner 加回 dsq-rise-in（关键帧还在）。 */
@keyframes dsq-toolbar-in {
  from {
    transform: translate(calc(-50% + var(--dsq-toolbar-shift, 0px)), -100%) translateY(4px) scale(0.96);
  }
  to {
    transform: translate(calc(-50% + var(--dsq-toolbar-shift, 0px)), -100%) translateY(0) scale(1);
  }
}

/* Same entrance for the below-anchor variant (only the content top uses it). */
@keyframes dsq-toolbar-in-below {
  from {
    transform: translate(calc(-50% + var(--dsq-toolbar-shift, 0px)), 0) translateY(-4px) scale(0.96);
  }
  to {
    transform: translate(calc(-50% + var(--dsq-toolbar-shift, 0px)), 0) translateY(0) scale(1);
  }
}

/* Comment phase: the hint sits above the popover's top-left corner (explicit
   top-left placement comes from placeCommentPop), so the entrance no longer
   owns the centering shift. */
@keyframes dsq-toolbar-in-popover-top {
  from {
    transform: translateY(4px) scale(0.96);
  }
  to {
    transform: translateY(0) scale(1);
  }
}

/* Right-click / shortcut menu: transform only, for the same reason as the
   toolbar — an animated opacity would cut the material layer's backdrop. */
/* Dropdown entry, anchored at the trigger: the panel starts 6px on the far
   side of where it lands and settles back, the geometry Lumno's options page
   uses (180ms, emphasized). Two keyframes because a CSS animation cannot read
   the placement; the component passes data-side from placePopover.
   Transform only: dsq_modelMenu / dsq_langMenu paint their material on a
   ::before with backdrop-filter, so an animated opacity would cut the blur. */
@keyframes dsq-dropdown-in-below {
  from {
    transform: translateY(-6px) scale(0.98);
  }
  to {
    transform: none;
  }
}

@keyframes dsq-dropdown-in-above {
  from {
    transform: translateY(6px) scale(0.98);
  }
  to {
    transform: none;
  }
}

@keyframes dsq-menu-in {
  from {
    transform: translateY(4px) scale(0.97);
  }
  to {
    transform: translateY(0) scale(1);
  }
}

@keyframes dsq-menu-in-up {
  from {
    transform: translateY(-4px) scale(0.97);
  }
  to {
    transform: translateY(0) scale(1);
  }  }
}

/* 内容层的 rise：悬停面板的列表在用；工具条改用容器 scale 后这条在这里待命。 */
@keyframes dsq-rise-in {
  from {
    transform: translateY(4px);
  }
  to {
    transform: translateY(0);
  }
}

/* Toast is centered with translateX(-50%); the shared rise keyframes would
   drop that shift and make it jump sideways, so it owns the full transform. */
@keyframes dsq-toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* Exit of the chip preview: the same 4px travel, reversed. Transform only, so
   the material layer keeps sampling its backdrop until the node is removed. */
@keyframes dsq-rise-out {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(4px);
  }
}

/* 宿主菜单材质（官方 material 图层同款）：填充走 --dsw-menu-surface-fill，模糊走
   --dsw-menu-backdrop-filter（恒为 blur(40px) saturate(150%)），亮暗自动翻。
   画在 z-index:-1 的独立图层上，内容在它之上：模糊只取身后的页面，不会把
   面板里的文字一起糊掉。所有浮层共用这一条。
   注意：macOS 上宿主另有一个 --dsw-specific-menu（覆写成 94% 不透明）给它的
   菜单用；这里按需求用 surface-fill，所以我们的浮层会比宿主自己的菜单更透。 */
.dsq_toolbar::before,
.dsq_commentPop::before,
.dsq_summaryHoverInner::before,
.dsq_touchBar::before,
.dsq_chipPreview::before,
.dsq_ctxMenu::before,
.dsq_modelMenu::before,
.dsq_langMenu::before,
.dsq_targetPicker::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--dsq-menu);
  backdrop-filter: var(--dsq-menu-backdrop);
  -webkit-backdrop-filter: var(--dsq-menu-backdrop);
  pointer-events: none;
}

/* 覆层不描边：elevation-prominent 自带的那圈 0 0 0 .5px（--dsw-elevation-stroke-color，
   默认 border-l4）对磨砂覆层是多余的——边缘自带材质分界，再勾一道反而抢视觉，覆写成
   更淡的 border-l1。
   两个坑，改之前先读：① 这两行必须写在浮层自己的选择器上。写在 body 上会随继承
   影响页面里其它依赖默认值的面板（宿主带 [data-menu-material] 的菜单有自己的覆写，
   不受影响）。② --dsq-shadow 也必须在这儿声明，不能留在 body：自定义属性是在**声明处**
   展开的，--dsq-shadow 留在 body 上时 var(--dsw-elevation-prominent) 会在 body 就被
   替换成 border-l4 那一版并继承下来，浮层上的描边覆写根本够不着；跟着声明挪到这里，
   整条链才在浮层元素上取值。 */
.dsq_toolbar,
.dsq_commentPop,
.dsq_summaryHoverInner,
.dsq_touchBar,
.dsq_touchSheet,
.dsq_chipPreview,
.dsq_ctxMenu,
.dsq_modelMenu,
.dsq_langMenu,
.dsq_targetPicker,
.dsq_hostPill {
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  /* Surfaces float over arbitrary content (a code preview, a terminal dump);
     they must not inherit that content's font. */
  font-family: var(--dsq-font);
  --dsq-shadow: var(--dsw-elevation-prominent, 0 0 0 .5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.04), 0 0 20px rgba(0, 0, 0, 0.05));
  /* Every surface above takes the same elevation; declaring it once here is
     what keeps the component blocks free of a copied box-shadow. */
  box-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.06));
}

/* 浮层挂载与层带（2026-10-20 定，改前先读）：
   工具条/评论泡/状态不再 portal 到 body，而是由 dom/floating-layer.ts 挂进对话
   真正的滚动容器（桌面抽屉布局是 ST7X_W_scrollBody，普通布局是 .icaHSq_scroll）
   里的一个 absolute host，坐标用**内容坐标**。

   为什么不是 body：header（对话标题那一排）是滚动容器之外的非定位元素，任何
   body 级 positioned + z-index 的浮层都天然压过它（这就是 z-index 降到 0 也仍在
   header 之上的原因）；composer 座位是 sticky + z-index 7，只有低于它才不会被
   输入框穿透。

   现在把两件事交回宿主布局：
   - 滚动容器负责裁剪：浮层随内容上移，到容器上边缘就被裁掉，自然滑进 header
     下面，和正文一致；
   - host 的 z-index 平时 6（见 floating-layer.ts）：低于 composer 的 7，高于
     内容里吸顶元素的 6（同 z 时 host 追加在滚动容器末尾，DOM 次序压过它们）。
     评论步骤打开期间抬到 8：摘要卡在 composer 座位里（z 7），会伸进滚动区，
     6 的评论泡会被它盖住；关闭评论即还原，空闲工具条仍不压输入框。
   host 内部次序：status 3 > toolbar 2 > commentPop 1。

   摘要块（composer 与历史消息）在内容普通流里，不参与这套层带；悬停面板仍是
   body 级 fixed（原因见 AnnotationCardView 里 contain:layout 的说明）。 */

.dsq_toolbar {
  position: absolute;
  z-index: 2;
  /* The layer host is 0×0, so an auto-width absolute child would shrink to
     min-content (Chinese hint text then wraps one character per line).
     max-content keeps the bubble sized by its row regardless of the host. */
  width: max-content;
  max-width: calc(100vw - 24px);
  transform: translate(calc(-50% + var(--dsq-toolbar-shift, 0px)), var(--dsq-anchor-y, -100%));
  gap: 2px;
  padding: 4px;
  /* 无边框：--dsq-shadow（宿主的 elevation-prominent）自带 0 0 0 .5px 的描边环，
     由它勾勒轮廓，所以这里不要再画 border，否则描边会和环叠成两条线。 */
  border: 0;
  border-radius: 12px;
  /* 底色与模糊都在上面的材质图层里，这里不再画背景；elevation 在共享规则里 */
  pointer-events: auto;
  /* A/B：scale 入场放在容器上（材质图层归它所有）。关键帧自带 translate(-50%,-100%)，
     所以缩放不会破坏居中。若真实客户端里磨砂在放大期间消失，改回内容层方案。 */
  animation: dsq-toolbar-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Hangs below the selection: no room above at the very top of the transcript. */
.dsq_toolbar[data-anchor='below'] {
  --dsq-anchor-y: 0%;
  animation-name: dsq-toolbar-in-below;
}

/* Comment phase: placed at an explicit top-left, 6px above the comment popover. */
.dsq_toolbar[data-anchor='popover-top'] {
  transform: none;
  animation-name: dsq-toolbar-in-popover-top;
}

/* 按钮行：形状由 A.inlineRow 提供，这里只留间距；入场动画在容器上
   （见 .dsq_toolbar 的 A/B 说明）。 */
.dsq_toolbarInner {
  gap: 2px;
}

.dsq_button {
  color: var(--dsq-label);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  border-radius: 8px;
  padding: 4px 10px;
  gap: 6px;
  white-space: nowrap;
}
/* Icon-only cells (a narrow column): no room for the label's padding. */
.dsq_buttonCompact {
  padding: 4px 7px;
  gap: 0;
}

.dsq_button:hover {
  background: var(--dsq-fill-hover);
}

/* An entry point the Host cannot run right now stays in the row, dimmed, and
   explains itself on hover. Removing it instead would read as a missing
   feature; a click that only produces a toast makes the user hunt for why. */
.dsq_button[aria-disabled='true'],
.dsq_touchAction[aria-disabled='true'],
.dsq_ctxItem[aria-disabled='true'],
.dsq_handoffChevron[aria-disabled='true'] {
  opacity: 0.42;
  cursor: default;
}

.dsq_button[aria-disabled='true']:hover {
  background: transparent;
}

/* Icon-only cells lose their wording, so the label arrives on hover instead.
   Portaled to <body>: inside the transcript scroller a tip drawn by the button
   is clipped right where the last row sits. 140ms on the emphasized curve with a
   3px travel out of the anchored edge — no opacity, since a fading surface
   samples its backdrop mid-flight. Leaving is instant. */
.dsq_tip {
  position: fixed;
  z-index: 30;
  max-width: 240px;
  padding: 5px 9px;
  border-radius: 8px;
  border: 0.5px solid var(--dsq-line);
  background: var(--dsq-bg-raised);
  color: var(--dsq-label);
  box-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08));
  font-family: var(--dsq-font);
  font-size: 11.5px;
  line-height: 16px;
  font-weight: 400;
  white-space: normal;
  pointer-events: none;
  animation: dsq_tip_in 140ms cubic-bezier(0.2, 0.9, 0.2, 1);
}

.dsq_tip[data-side='top'] {
  --dsq-tip-from: 3px;
}

.dsq_tip[data-side='bottom'] {
  --dsq-tip-from: -3px;
}

@keyframes dsq_tip_in {
  from {
    transform: translateY(var(--dsq-tip-from, 3px)) scale(0.96);
  }
  to {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dsq_tip {
    animation: none;
  }
}

/* Hover tooltip. A native title would be slower and styled by the OS; this
   rides the same token set as the rest of the chrome. */
[data-dsq-tip] {
  position: relative;
}

[data-dsq-tip]:hover::after {
  content: attr(data-dsq-tip);
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 4;
  max-width: 240px;
  padding: 5px 9px;
  border-radius: 8px;
  border: 0.5px solid var(--dsq-line);
  background: var(--dsq-bg-raised);
  color: var(--dsq-label);
  box-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.08));
  font-size: 11.5px;
  line-height: 16px;
  font-weight: 400;
  white-space: normal;
  pointer-events: none;
  transform: translateX(-50%);
}

/* Accent-filled actions: comment commit and annotation save. Only the
   metrics differ; fill and hover live here once. */
.dsq_buttonAddComment,
.dsq_annEditSave {
  background: var(--dsq-accent);
  color: #fff;
}
.dsq_buttonAddComment:hover,
.dsq_annEditSave:hover {
  background: var(--dsq-accent-400);
}

.dsq_button:focus-visible {
  outline: 2px solid var(--dsq-focus-ring);
  outline-offset: 1px;
}

.dsq_button svg {
  flex: none;
}

/* The submit gesture repeated on the accent button, so the shortcut is
   discoverable without hovering the field. Translucent currentColor keeps it
   readable on the accent fill and on a hovered fill alike. */
.dsq_kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, currentColor 16%, transparent);
  color: inherit;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  opacity: 0.8;
}

.dsq_divider {
  width: 1px;
  height: 14px;
  background: var(--dsq-line-divider);
  margin: 0 2px;
}

/* Target session name inside "放入 <name>": the accent separates it from the
   action word at a glance, including on the stacked touch bar. */
.dsq_handoffTargetName {
  color: var(--dsq-accent);
  font-weight: 500;
}

/* Split affordance beside 放入 <target>: a narrow chevron that opens the
   picker. Kept inside the toolbar row, so it never grows the bubble. */
.dsq_handoffChevron {
  width: 20px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsq-label-2);
  cursor: pointer;
}

.dsq_handoffChevron:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

/* Icon-only rows: every cell is the same square. Without this the chevron sat at
   20px, the gear at 34px and the actions at 28px, so the hover fill changed size
   from one button to the next under the pointer. The chevron rule is more
   specific on purpose — it sets its own narrow box for the labelled row. */
.dsq_buttonCompact,
.dsq_buttonCompact.dsq_handoffChevron {
  width: 28px;
  height: 28px;
  padding: 0;
  gap: 0;
  border-radius: 8px;
  justify-content: center;
}

/* Toast pill: the desktop status and the touch status share the whole skin;
   only where they anchor differs. */
.dsq_status,
.dsq_touchStatus {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px 5px 9px;
  border-radius: 999px;
  border: 0.5px solid var(--dsq-toast-line);
  /* Surface colours, not an inverted pill: a light page gets a light chip with
     dark text, a dark page a dark chip with light text. The hairline keeps the
     chip readable when it sits on a same-tone bubble. */
  background: var(--dsq-toast-bg);
  color: var(--dsq-toast-fg);
  box-shadow: var(--dsw-elevation-prominent, 0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.06));
  font-size: 12px;
  line-height: 18px;
  pointer-events: none;
  white-space: nowrap;
}

/* Every current status is a failure notice, so the icon is the error glyph. */
.dsq_statusIcon {
  flex: none;
  color: var(--dsq-danger);
}

.dsq_status {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, 8px);
}

/* Right-click / shortcut menu. Body-level fixed: it must escape the
   transcript's clipping. It closes on scroll instead of following the text,
   so it never points at a line that has moved away. */
.dsq_ctxMenu {
  position: fixed;
  z-index: 64;
  width: max-content;
  min-width: 172px;
  max-width: min(280px, calc(100vw - 16px));
  padding: 4px;
  border: 0;
  border-radius: 12px;
  outline: none;
  animation: dsq-menu-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: top left;
}

.dsq_ctxMenu[data-side='top'] {
  animation-name: dsq-menu-in-up;
  transform-origin: bottom left;
}

.dsq_ctxItem {
  width: 100%;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  color: var(--dsq-label);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}

.dsq_ctxItem svg {
  flex: none;
  color: var(--dsq-label-2);
}

.dsq_ctxItem:hover,
.dsq_ctxItem:focus {
  background: var(--dsq-fill-hover);
}

.dsq_ctxItem:focus {
  outline: none;
}

.dsq_ctxItem:focus-visible {
  outline: 2px solid var(--dsq-focus-ring);
  outline-offset: -2px;
}

/* Layer 3 — components. Our actions inside the Host's selection pill
   (conversation.chat.text-interaction). The Host's own container paints
   nothing at all — no background, no padding, no border, no shadow — so the
   row brings the material with it, out of the same two tokens every other
   surface here uses.
   The material sits ON this element instead of the shared ::before layer on
   purpose: the node lives inside the Host's chat column, and a negative-z
   child there paints into that column's own stacking order, which swallowed
   the layer (the pill came up with its shadow but no surface). Backdrop-filter
   blurs what is painted behind the element, never its own buttons, so nothing
   is lost by painting it here.
   Entrance only: the Host mounts this node per gesture and unmounts it the
   moment the gesture ends, so there is no exit frame to animate. Transform
   only — an animated opacity would cut the backdrop sampling. */
.dsq_hostPill {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  pointer-events: auto;
  background: var(--dsq-menu);
  backdrop-filter: var(--dsq-menu-backdrop);
  -webkit-backdrop-filter: var(--dsq-menu-backdrop);
  animation: dsq-menu-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dsq_hostPill .dsq_button {
  /* The Host's own pill is a text button on the canvas material; our buttons
     borrow its scale instead of the toolbar's slightly larger one. */
  font-size: 13px;
  line-height: 18px;
  gap: 5px;
}

`
