/**
 * Every style the plugin ships, in four layers.
 *
 *   1. tokens   — product design tokens, aliased once with their fallbacks
 *   2. atoms    — shared shapes (`.dsq_a_*`), no numbers, no colors
 *   3. components — one block per UI piece; everything measurable lives here
 *   4. host     — rules that reach into product DOM, theme flips, keyframes
 *
 * Injection order is the cascade order, so a component rule always wins over an
 * atom on the same element — which is what lets atoms stay shape-only and the
 * component blocks stay the single source of numbers.
 */

/** Layer 2 — atoms. Shape only: adding a number here is a layering violation. */
const ATOMS = {
  row: 'display: flex; align-items: center;',
  inlineRow: 'display: inline-flex; align-items: center;',
  col: 'display: flex; flex-direction: column;',
  colEnd: 'display: flex; flex-direction: column; align-items: flex-end;',
  gridMid: 'display: grid; place-items: center;',
  ell: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  plain: 'appearance: none; border: none; background: transparent; cursor: pointer;',
  keep: 'flex: none;',
  grow: 'flex: 1; min-width: 0;',
  box: 'box-sizing: border-box;',
} as const

const toKebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const atomRules = Object.entries(ATOMS)
  .map(([name, declarations]) => `.dsq_a_${toKebab(name)} { ${declarations} }`)
  .join('\n')

/** Atom class names, for `cx(styles.summary, A.row)`. */
export const A = Object.fromEntries(
  Object.keys(ATOMS).map((name) => [name, `dsq_a_${toKebab(name)}`]),
) as Record<keyof typeof ATOMS, string>

/** Join class parts, dropping the falsy ones so a variant can be `cond && A.x`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const CSS = `
/* Layer 1 — tokens. Every product token this plugin reads is aliased here once,
   with the fallback it used to repeat inline at each use site. Scoped to \`body\`,
   not \`:root\`: the product flips its palette on body[data-ds-dark-theme], so an
   alias computed on the root element would freeze the light values and inherit
   them into the dark page. */
body {
  --dsq-chat-width: var(--dsh-chat-content-width, 748px);
  --dsq-font-size: var(--dsh-content-font-size, 14px);
  --dsq-font-delta: var(--dsh-content-font-delta, 0px);
  --dsq-bg-raised: var(--dsw-alias-bg-layer-1, #fff);
  --dsq-bg-toast: var(--dsw-alias-bg-layer-3, rgba(0, 0, 0, 0.78));
  /* The settings switch mirrors the Host's own switch: neutral track when off,
     brand fill when on, and a thumb that inverts with the theme. */
  --dsq-switch-off: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --dsq-switch-on: var(--dsw-alias-brand-primary, #0f1115);
  --dsq-switch-thumb-off: var(--dsw-alias-switch-thumb, #fff);
  --dsq-switch-thumb-on: var(--dsw-alias-label-primary-foreground, #fff);
  --dsq-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  --dsq-line-divider: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.12));
  --dsq-focus-ring: var(--dsw-alias-button-primary-fill, #1677ff);
  --dsq-focus-ring-soft: color-mix(in srgb, var(--dsq-accent) 50%, transparent);
  --dsq-fill-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  --dsq-label: var(--dsw-alias-label-primary, rgba(0, 0, 0, 0.88));
  --dsq-label-inverted: var(--dsw-alias-label-primary-inverted, #fff);
  --dsq-label-2: var(--dsw-alias-label-secondary, rgba(0, 0, 0, 0.65));
  --dsq-label-3: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, 0.45));
  --dsq-link: var(--dsw-alias-link, rgba(0, 0, 0, 0.65));
  --dsq-bubble: var(--dsw-specific-bubble, rgba(0, 0, 0, 0.05));
  --dsq-menu: var(--dsw-menu-surface-fill, rgba(248, 249, 250, .58));
  --dsq-menu-backdrop: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  --dsq-scrim: rgba(0, 0, 0, 0.32);
  --dsq-accent-400: var(--dsw-static-blue-400, #1677ff);
  --dsq-accent: var(--dsw-static-blue-500, #3b82f6);
  --dsq-accent-tint: var(--dsw-static-blue-50p, #eaf3ff);
  --dsq-accent-tint-hover: var(--dsw-static-blue-75, #e5f0ff);
  --dsq-accent-tint-dark: var(--dsw-static-blue-950, #172554);
  --dsq-summary-bg: var(--dsw-alias-bg-layer-2, #fff);
  --dsq-mark-hover: var(--dsw-static-blue-75, #e5f0ff);
  --dsq-neutral-50: var(--dsw-static-neutral-50, #fafafa);
  --dsq-neutral-100: var(--dsw-static-neutral-100, #f5f5f5);
  --dsq-neutral-800: var(--dsw-static-neutral-800, #292929);
  --dsq-neutral-850: var(--dsw-static-neutral-850, #212123);
  --dsq-radius-sm: var(--dsw-radius-sm, 6px);
  --dsq-radius-md: var(--dsw-radius-md, 8px);
  --dsq-menu-icon: var(--dsw-alias-menu-icon, rgba(0, 0, 0, 0.45));
  --dsq-danger-bg: var(--dsw-alias-interactive-bg-hover-danger, rgba(217, 48, 37, 0.1));
  --dsq-danger: var(--dsw-alias-state-error-primary, #d93025);
  --dsq-warn-bg: var(--dsw-alias-bg-module-platform, rgba(0, 0, 0, 0.05));
  --dsq-warn: var(--dsw-alias-state-warn-label, #b26a00);
  /* Tone of the Host's info tag, used by the model release badge. */
  --dsq-business: var(--dsw-alias-state-business-primary, #4176e6);
  --dsq-business-bg: color-mix(in srgb, var(--dsq-business) 10%, transparent);
}

/* Layer 2 — atoms (generated from ATOMS above; the class names and the rules
   cannot drift apart because both come from the same table). */
${atomRules}

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
  }
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
.dsq_targetPicker {
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  --dsq-shadow: var(--dsw-elevation-prominent, 0 0 0 .5px rgba(0, 0, 0, 0.04), 0 3px 8px rgba(0, 0, 0, 0.04), 0 0 20px rgba(0, 0, 0, 0.05));
  /* Every surface above takes the same elevation; declaring it once here is
     what keeps the component blocks free of a copied box-shadow. */
  box-shadow: var(--dsq-shadow);
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
.dsq_button:hover {
  background: var(--dsq-fill-hover);
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

/* Toast pill: the desktop status and the touch status share the whole skin;
   only where they anchor differs. */
.dsq_status,
.dsq_touchStatus {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--dsq-bg-toast);
  color: var(--dsq-label-inverted);
  font-size: 12px;
  line-height: 18px;
  pointer-events: none;
  white-space: nowrap;
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

/* Model picker — ported from the Host composer's model seat. The trigger is a
   text button (the icon only appears when the Host's own composer vars say the
   row is tight); the menu is the same two-pane Model / Effort dropdown, with
   search once the catalog exceeds four entries. */
.dsq_modelSeat {
  position: relative;
  min-width: 0;
  max-width: 100%;
}

.dsq_modelTrigger {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: min(360px, 45cqw);
  height: 28px;
  padding: 0 4px 0 8px;
  border: none;
  border-radius: var(--dsq-radius-sm);
  outline: none;
  background: transparent;
  color: var(--dsq-label-2);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
}

.dsq_modelTrigger:hover:not(:disabled) {
  background: var(--dsq-fill-hover);
}

.dsq_modelTrigger:focus-visible:not([data-selection-focus]) {
  box-shadow: 0 0 0 2px var(--dsq-focus-ring-soft);
}

.dsq_modelTrigger:disabled {
  color: var(--dsq-label-3);
  cursor: default;
}

.dsq_modelTriggerIcon {
  display: var(--dsh-composer-model-icon-display, none);
  flex: none;
}

.dsq_modelTriggerLabel {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsq_modelTriggerEffort {
  flex-shrink: 1000;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsq-label-3);
}

.dsq_modelChevron {
  flex: none;
  color: var(--dsq-label-3);
  transition: transform 0.12s;
}

.dsq_modelChevronOpen {
  transform: rotate(180deg);
}

.dsq_modelMenu {
  position: fixed;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: min(240px, calc(100vw - 32px));
  max-width: min(420px, calc(100vw - 32px));
  max-height: min(360px, calc(100vh - 96px));
  padding: 4px;
  border: 0;
  border-radius: 12px;
  outline: none;
  pointer-events: auto;
  animation: dsq-menu-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-origin: bottom right;
}

.dsq_modelCell {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 100%;
  height: 34px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsq-radius-md);
  outline: none;
  background: transparent;
  color: var(--dsq-label);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
}

.dsq_modelCell:hover,
.dsq_modelCell:focus-visible {
  background: var(--dsq-fill-hover);
}

.dsq_modelCellLabel {
  flex: none;
  white-space: nowrap;
}

.dsq_modelCellValue {
  flex: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  color: var(--dsq-label-3);
}

.dsq_modelCell svg {
  flex: none;
  color: var(--dsq-menu-icon);
}

.dsq_modelSearchRow {
  position: relative;
  flex-shrink: 0;
  margin: 2px 0 3px;
}

.dsq_modelSearch {
  box-sizing: border-box;
  width: 100%;
  padding: 5px 7px;
  border: 0;
  border-radius: var(--dsq-radius-md);
  outline: none;
  background: transparent;
  color: var(--dsq-label);
  font: inherit;
  font-size: 12px;
  line-height: normal;
}

.dsq_modelSearch::placeholder {
  color: var(--dsq-label-3);
}

.dsq_modelSearchWithQuery {
  padding-right: 34px;
}

.dsq_modelSearchClear {
  position: absolute;
  top: 50%;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  outline: none;
  background: transparent;
  color: var(--dsq-label-2);
  cursor: pointer;
  transform: translateY(-50%);
}

.dsq_modelSearchClear:hover,
.dsq_modelSearchClear:focus-visible {
  background: var(--dsq-fill-hover);
}

.dsq_modelStatus,
.dsq_modelEmpty {
  padding: 8px;
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 18px;
}

.dsq_modelError,
.dsq_modelWarning {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
  padding: 6px 7px;
  border-radius: var(--dsq-radius-md);
  font-size: 11px;
  line-height: 16px;
}

.dsq_modelError {
  background: var(--dsq-danger-bg);
  color: var(--dsq-danger);
}

.dsq_modelWarning {
  background: var(--dsq-warn-bg);
  color: var(--dsq-warn);
}

.dsq_modelRetry {
  flex: none;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.dsq_modelGroups {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsq_modelGroup {
  display: flex;
  flex-direction: column;
}

.dsq_modelGroupLabel {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 5px 7px;
  color: var(--dsq-label-3);
  font-size: 11px;
  line-height: 16px;
}

/* The heading only paints while the list scrolls under it, like the Host's
   MenuGroup; clipping it to the menu's own material keeps rows readable. */
.dsq_modelGroupLabel[data-pinned] {
  background: var(--dsq-menu);
  backdrop-filter: var(--dsq-menu-backdrop);
  -webkit-backdrop-filter: var(--dsq-menu-backdrop);
}

.dsq_modelOption {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
  width: auto;
  min-width: 100%;
  min-height: 34px;
  padding: 5px 7px;
  border: none;
  border-radius: var(--dsq-radius-md);
  outline: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

/* Model rows track hover through the highlighted index (mouse move moves focus
   or the highlight), so their background comes from the active class instead. */
.dsq_modelOption:not(.dsq_modelModelOption):hover:not(:disabled),
.dsq_modelOption:focus-visible,
.dsq_modelOptionActive:not(:disabled) {
  background: var(--dsq-fill-hover);
}

.dsq_modelSelected {
  background: transparent;
}

.dsq_modelOptionCopy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.dsq_modelModelName {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
}

/* Host label shape: the official Flash entry is followed by a fixed release
   tag (dsh-client-ui-deepseek-model-label-1017). */
.dsq_modelLabel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: baseline;
  white-space: nowrap;
}

.dsq_modelTag {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsq-business-bg);
  color: var(--dsq-business);
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
  white-space: nowrap;
}

.dsq_modelCheck {
  display: grid;
  flex: 0 0 14px;
  place-items: center;
  color: var(--dsq-label);
}

/* Annotation stack — inside the composer card (input.overlay), ~1/5 width. */
.dsq_cardStack {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 12;
  width: 20%;
  min-width: 148px;
  max-width: 220px;
  align-items: stretch;
  gap: 6px;
  pointer-events: auto;
}

/* Corner remove-all button on the summary block: hidden until the block is
   hovered or focused. */
.dsq_cardClose {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 6px;
  color: var(--dsq-label-3);
  font-size: 14px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s, background-color 0.12s;
}

.dsq_summary:hover .dsq_cardClose,
.dsq_summary:focus-within .dsq_cardClose {
  opacity: 1;
  pointer-events: auto;
}

.dsq_cardClose:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

/* Qoder-style annotation summary (“N 条批注”) inside the composer. */
.dsq_summary {
  position: relative;
  z-index: 13;
  box-sizing: border-box;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  padding: 8px 10px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 18px;
  background: var(--dsq-summary-bg);
  pointer-events: auto;
  user-select: none;
}

.dsq_summaryIcon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-link);
  font-size: 13px;
  font-weight: 600;
}

.dsq_summaryBody {
  position: relative;
}

/* Card titles (composer summary / touch sheet) share one type scale. */
.dsq_summaryTitle,
.dsq_touchSheetTitle {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--dsq-label);
}

.dsq_summaryHint {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsq-label-3);
}

/* Hover wording is wrong on touch; show one line, not both. */
.dsq_summaryHintTouch {
  display: none;
}

@media (hover: none), (pointer: coarse) {
  .dsq_summaryHintPointer {
    display: none;
  }
  .dsq_summaryHintTouch {
    display: block;
  }
}

/* The hover panel and the chip preview are the same floating width; keeping it
   in one rule means a width tweak lands on both. */
.dsq_summaryHover,
.dsq_chipPreview {
  width: min(320px, calc(100vw - 16px));
}

.dsq_summaryHover {
  /* \`display: none\` here is the closed state, so this rule must not take the
     flex atoms — the open class below turns display back on. */
  display: none;
  position: fixed;
  z-index: 14;
  flex-direction: column;
  /* No side padding: the visible card must share the summary's left edge. The
     transparent hover bridge is added by place() only on the facing side. */
  padding: 0;
  background: transparent;
  pointer-events: auto;
  opacity: 0;
}

/* Must come after .dsq_summaryHover (same class weight otherwise loses to display:none). */
/* 容器上不做 opacity 过渡、也不做 scale 入场。opacity 那条是规范实锤：祖先一带上
   opacity<1 就成了 backdrop root，::before 采样不到身后的页面，磨砂在整段淡入里
   消失、结束才糊上——所以 opacity 过渡删掉，只留 place() 里那次 0→1 瞬时翻转
   （「定位前不可见」的守卫）。scale 一并去掉是保守起见：容器彻底静止，采样区域
   不会逐帧移动；入场感交给内层列表的 rise（内容不是材质的祖先）。 */
.dsq_summaryHover.dsq_summaryHoverOpen {
  display: flex;
}

/* Keep the closing panel mounted briefly; the list reverses its rise. */
.dsq_summaryHoverLeaving {
  pointer-events: none;
}

.dsq_summaryHoverLeaving .dsq_summaryList {
  animation: dsq-rise-out 0.12s cubic-bezier(0.4, 0, 1, 1) both;
}

.dsq_summaryHoverInner {
  position: relative;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  /* 不画 border：--dsq-shadow（宿主的 elevation-prominent）自带 0 0 0 .5px 的
     描边环，再画一遍会叠成两条线。底色与模糊都在材质图层里，elevation 在共享规则里。 */
}

/* 滚动只放在列表上：材质图层是绝对定位的，留在会滚动的容器里会跟着内容跑掉，
   滚到底部时面板顶部就露空。入场 rise 也在这层——内容不是材质图层的祖先，
   动它不会切断磨砂的采样源。 */
.dsq_summaryList {
  gap: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  max-height: min(412px, calc(100vh - 128px));
  animation: dsq-rise-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 老浏览器没有 backdrop-filter：图层退成不透明底色，否则半透明直接糊在文字上。 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dsq_toolbar::before,
  .dsq_commentPop::before,
  .dsq_summaryHoverInner::before,
  .dsq_touchBar::before,
  .dsq_chipPreview::before,
  .dsq_ctxMenu::before,
  .dsq_targetPicker::before {
    background: var(--dsq-bg-raised);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.dsq_summaryItem {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background-color 0.12s;
}

.dsq_summaryItem:hover {
  background: color-mix(in srgb, var(--dsq-fill-hover) 50%, transparent) ;
}

.dsq_summaryItemHead {
  gap: 6px;
  /* Normal mode's action buttons set the row height; keep it in edit mode too
     so the badge and the label never move when the actions disappear. */
  min-height: 26px;
}

.dsq_summaryItemBadge {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--dsq-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.dsq_summaryItemActions {
  gap: 2px;
  margin-left: auto;
  opacity: 0.5;
  transition: opacity 0.12s;
}

.dsq_summaryItem:hover .dsq_summaryItemActions,
.dsq_summaryItem:focus-within .dsq_summaryItemActions {
  opacity: 1;
}

.dsq_summaryItemAction {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: var(--dsq-label-3);
}

.dsq_summaryItemAction:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

.dsq_summaryItemMain {
  min-width: 0;
  /* The lead-in lives on the shared wrapper, not on the normal-mode button, so
     edit mode has no wrapper to compensate for. */
  padding-top: 2px;
}

.dsq_summaryItemButton {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  border-radius: 8px;
  /* No padding: the 2px lead-in is on .dsq_summaryItemMain, and the UA's
     default button padding would shift the quote sideways and down. */
  padding: 0;
}

.dsq_annAnchor {
  display: block;
  width: 100%;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Field labels shared by the hover list and the chip preview. */
.dsq_summaryItemLabel,
.dsq_chipPreviewLabel {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsq-label-3);
}

.dsq_summaryItemLabel {
  margin-top: 8px;
  margin-bottom: 4px;
}

/* The header label shares the class but sits in a centered flex row. */
.dsq_summaryItemHead .dsq_summaryItemLabel {
  margin: 0;
}

/* Quote/comment body type is shared; only the box behavior differs. */
.dsq_summaryItemText,
.dsq_chipPreviewQuote,
.dsq_chipPreviewComment {
  font-size: 13px;
  color: var(--dsq-label);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dsq_summaryItemText {
  line-height: 18px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dsq_summaryItemTextEmpty {
  color: var(--dsq-label-3);
}

/* Inline edit form rendered inside the hover panel item (no extra layer).
   Shares .dsq_summaryItemText with the read view, but shows the full quote
   instead of clamp-reading it. */
.dsq_summaryItemTextEdit {
  display: block;
  max-height: 132px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Textarea skin shared by the annotation editor and the comment popover; the
   variants below only set min-height, resize and radius. */
.dsq_annEditInput,
.dsq_commentInput {
  width: 100%;
  border: none;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsq-label);
  background: var(--dsq-fill-hover);
  outline: none;
}

.dsq_annEditInput::placeholder,
.dsq_commentInput::placeholder {
  color: var(--dsq-label-3);
}

.dsq_annEditInput {
  min-height: 72px;
  resize: vertical;
  border-radius: 10px;
}

.dsq_commentActions,
.dsq_annEditActions {
  justify-content: flex-end;
}

.dsq_annEditActions {
  gap: 8px;
  margin-top: 4px;
}

/* Footer buttons share type and metrics; the save fill comes from the shared
   accent-action rule above. */
.dsq_annEditCancel,
.dsq_annEditSave {
  font: inherit;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 10px;
}

.dsq_annEditCancel {
  color: var(--dsq-label-2);
}

.dsq_annEditCancel:hover {
  background: var(--dsq-fill-hover);
}

.dsq_annEditSave {
  font-weight: 500;
}

.dsq_annEditSave:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Inline comment composer under the floating selection toolbar. */
.dsq_commentPop {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  /* Vertical offset comes from placeCommentPop (below the selection); only
     the horizontal centering belongs to the transform. */
  transform: translateX(-50%);
  width: min(320px, calc(100vw - 24px));
  gap: 8px;
  padding: 8px;
  border-radius: 16px;
  /* 底色与模糊都在材质图层里，elevation 在共享规则里 */
  /* The layer host is pointer-events:none; interactive surfaces opt back in. */
  pointer-events: auto;
}

/* The side-task step carries a quoted annotation plus the model seat; the extra
   width keeps both readable without changing the comment step's footprint. */
.dsq_commentPopSide {
  width: min(384px, calc(100vw - 24px));
}

.dsq_commentInput {
  min-height: 64px;
  resize: none;
  border-radius: 8px;
}

.dsq_commentActions {
  gap: 6px;
}

/* Side-task composer: the referenced passage reuses the annotation summary's
   shell, and the footer is the Host composer's model-left / send-right row. */
.dsq_sideQuote {
  align-items: flex-start;
  width: 100%;
}

.dsq_sideQuoteText {
  display: -webkit-box;
  overflow: hidden;
  color: var(--dsq-label-2);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.dsq_sideFooter {
  justify-content: space-between;
  gap: 8px;
}

/* Translation: a wider comment popover with a language trigger and a result
   body that scrolls internally rather than growing the surface. */
.dsq_commentPopTranslate {
  width: min(360px, calc(100vw - 24px));
}

.dsq_translateQuote {
  overflow: hidden;
  color: var(--dsq-label-2);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  user-select: text;
}

.dsq_translateHead {
  gap: 6px;
}

.dsq_translateTargetLabel {
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.dsq_translateClose {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: var(--dsq-label-3);
}

.dsq_translateClose:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

.dsq_translateBody {
  min-height: 48px;
  max-height: 220px;
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsq_translateText {
  color: var(--dsq-label);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.dsq_translateHint {
  color: var(--dsq-label-3);
  font-size: 12.5px;
  line-height: 1.6;
}

/* Waiting state: a gradient sweeps across the label next to the agent-progress
   grid. Only background-position/transform animate, never opacity; the row's
   dimming is static style on the children, not an ancestor of the frost. */
.dsq_translateLoading {
  gap: 5px;
}

.dsq_progressGrid {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5px;
  width: 12px;
  height: 12px;
  color: var(--dsq-label-3);
  opacity: 0.5;
}

/* Nine cells light up in a diagonal sweep, the reference's Agent Progress mark. */
.dsq_progressCell {
  border-radius: 1px;
  background: currentColor;
  animation: dsq-progress-cell 1.55s ease-in-out infinite;
  transform: scale(0.72);
}

@keyframes dsq-progress-cell {
  0%,
  100% {
    transform: scale(0.72);
    background-color: var(--dsq-label-3);
  }
  50% {
    transform: scale(1);
    background-color: var(--dsq-label);
  }
}

.dsq_translateShimmer {
  width: fit-content;
  opacity: 0.62;
  background-image: linear-gradient(
    90deg,
    var(--dsq-label-3) 0%,
    var(--dsq-label) 45%,
    var(--dsq-label-3) 90%
  );
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: dsq-text-shimmer 1.9s linear infinite;
}

@keyframes dsq-text-shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: -100% 0;
  }
}

/* Reasoning: open while the model thinks, then a collapsed disclosure above
   the translation so the result stays the primary content. */
.dsq_translateReasoning {
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 1.55;
}

.dsq_translateReasoningSummary {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--dsq-label-3);
  list-style: none;
  cursor: pointer;
  user-select: none;
}

.dsq_translateReasoningSummary::-webkit-details-marker {
  display: none;
}

.dsq_translateReasoningChevron {
  flex: none;
  transition: transform 0.15s ease;
}

.dsq_translateReasoning[open] .dsq_translateReasoningChevron {
  transform: rotate(90deg);
}

.dsq_translateReasoningText {
  max-height: 112px;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.dsq_translateReasoning[open] .dsq_translateReasoningText {
  margin-top: 4px;
}

/* Live reasoning grows inside the body so the body's own scroll follows it. */
.dsq_translateReasoningLive {
  max-height: none;
  padding: 0 2px;
  overflow: visible;
}

/* Trailing marker while text is still arriving; color blink, no opacity. */
.dsq_translateCaret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.12em;
  background: var(--dsq-accent);
  animation: dsq-caret-blink 1s steps(2, start) infinite;
}

@keyframes dsq-caret-blink {
  50% {
    background-color: transparent;
  }
}

.dsq_translateError {
  color: var(--dsq-label-3);
  font-size: 11.5px;
  line-height: 1.5;
  word-break: break-word;
}

.dsq_translateActions {
  justify-content: flex-end;
  gap: 6px;
}

/* Language dropdown shared by the popover and the settings page. The trigger
   sits inline; the menu is a body-level frosted list so neither surface can
   clip it. */
.dsq_langSeat {
  position: relative;
  display: inline-flex;
}

.dsq_langTrigger {
  gap: 4px;
  padding: 3px 8px;
  border-radius: 8px;
  color: var(--dsq-label);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.dsq_langTrigger:hover {
  background: var(--dsq-fill-hover);
}

.dsq_langTrigger:focus-visible {
  outline: 2px solid var(--dsq-focus-ring-soft);
  outline-offset: 1px;
}

.dsq_langChevron {
  color: var(--dsq-label-3);
  transition: transform 0.15s ease;
}

.dsq_langChevronOpen {
  transform: rotate(180deg);
}

.dsq_langMenu {
  position: fixed;
  /* Same band as the model menu: above the touch sheet and the context menu,
     both of which can own the screen while the popover is open. */
  z-index: 1100;
  max-height: min(320px, calc(100vh - 16px));
  padding: 4px;
  border-radius: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  pointer-events: auto;
}

.dsq_langOption {
  width: 100%;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  color: var(--dsq-label);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
}

.dsq_langOption:hover,
.dsq_langOption:focus-visible {
  background: var(--dsq-fill-hover);
  outline: none;
}

.dsq_langOptionActive {
  font-weight: 500;
}

.dsq_langCheck {
  display: grid;
  place-items: center;
  width: 16px;
  color: var(--dsq-accent);
}

/* Preview for a model-written annotation chip. Body-level fixed (the chat
   surface's contain: layout would otherwise capture it); hover and click
   share this one surface, and the button owns the jump. */
.dsq_chipPreview {
  position: fixed;
  z-index: 50;
  box-sizing: border-box;
  max-height: min(420px, calc(100vh - 32px));
  padding: 10px;
  border-radius: 14px;
  pointer-events: auto;
  overflow: hidden;
}

/* Same rise as the annotation card's hover list; on the content, not on the
   material layer, so backdrop sampling stays put. */
.dsq_chipPreviewBody {
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: dsq-rise-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dsq_chipPreviewLeaving {
  pointer-events: none;
}

.dsq_chipPreviewLeaving .dsq_chipPreviewBody {
  animation: dsq-rise-out 0.12s cubic-bezier(0.4, 0, 1, 1) both;
}

/* Header rows: title on the left, the single action on the right. */
.dsq_chipPreviewHead,
.dsq_touchSheetHead {
  justify-content: space-between;
  gap: 8px;
}

.dsq_chipPreviewTitle {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--dsq-label);
}

.dsq_chipPreviewLabel {
  margin-top: 2px;
}

.dsq_chipPreviewQuote,
.dsq_chipPreviewComment {
  line-height: 19px;
  max-height: 108px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsq_chipPreviewCommentEmpty {
  color: var(--dsq-label-3);
}

/* Edit/remove sit in the preview's title row, matching the summary list's
   per-item actions so the two editing surfaces read as one. */
.dsq_chipPreviewActions {
  flex: none;
  gap: 2px;
  margin-left: auto;
}

.dsq_chipPreviewAction {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 7px;
  color: var(--dsq-label-3);
}

.dsq_chipPreviewAction:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

/* Second step of "取消放入": the trash icon grows a text label but stays the
   same control, so the destructive action never hides behind a new button. */
/* Two-step destructive confirm shared by every annotation delete surface.
   The label is always in the DOM (collapsed) so the first press can grow it in
   place with a width/opacity transition instead of swapping nodes. */
.dsq_deleteConfirm {
  gap: 0;
  height: 26px;
  padding: 0 7px;
  border-radius: 7px;
  background: var(--dsq-danger-bg);
  color: var(--dsq-danger);
  font-size: 11.5px;
  white-space: nowrap;
}

.dsq_deleteConfirmLabel {
  max-width: 0;
  margin-left: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  transition: max-width 0.16s ease, margin-left 0.16s ease, opacity 0.12s ease;
}

/* One grid item, so the icon-only state stays centered in the 26/20px button
   while the collapsed label rides along invisibly. */
.dsq_deleteConfirmInner {
  display: inline-flex;
  align-items: center;
}

.dsq_deleteConfirm[data-confirming='true'] .dsq_deleteConfirmLabel {
  max-width: 140px;
  margin-left: 4px;
  opacity: 1;
}

/* Touch selection chrome. Fixed to the visual viewport and mounted on body:
   the OS selection menu owns the space around the selected text, and the soft
   keyboard owns the bottom, so neither content coordinates nor the scroller's
   clipping can place this correctly. Only rendered on coarse pointers. */
.dsq_touchBar,
.dsq_touchSheet {
  position: fixed;
  left: 50%;
  right: auto;
  box-sizing: border-box;
  width: min(520px, calc(100vw - 16px));
  transform: translateX(-50%);
  touch-action: manipulation;
  pointer-events: auto;
}

.dsq_touchBar {
  z-index: 60;
  gap: 4px;
  padding: 6px;
  border-radius: 16px;
}

.dsq_touchAction {
  flex: 1 1 0;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 4px;
  border-radius: 10px;
  color: var(--dsq-label);
  font: inherit;
  font-size: 11px;
  line-height: 14px;
}

.dsq_touchAction span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsq_touchAction:active {
  background: var(--dsq-fill-hover);
}

.dsq_touchScrim {
  position: fixed;
  inset: 0;
  z-index: 61;
  background: var(--dsq-scrim);
  touch-action: none;
}

.dsq_touchSheet {
  z-index: 62;
  gap: 10px;
  padding: 12px;
  border-radius: 20px;
  background: var(--dsq-bg-raised);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsq_touchSheetClose {
  flex: none;
  width: 44px;
  height: 44px;
  margin: -8px -8px -8px 0;
  border-radius: 12px;
  color: var(--dsq-label-2);
}

.dsq_touchSheetClose:active {
  background: var(--dsq-fill-hover);
}

/* Keep the selected words visible after the sheet covers the page: on touch the
   reader has no hover to re-orient, so the sheet carries its own quote. */
.dsq_touchQuote {
  border-left: 2px solid var(--dsq-accent);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-label-2);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  user-select: text;
}

/* 16px keeps iOS from zooming the page when the field is focused. */
.dsq_touchComment {
  min-height: 88px;
  font-size: 16px;
  line-height: 22px;
}

.dsq_touchActions {
  gap: 8px;
}

.dsq_touchActions .dsq_button {
  flex: 1;
  min-height: 44px;
  justify-content: center;
  font-size: 14px;
}

.dsq_touchSecondary {
  background: var(--dsq-fill-hover);
}

.dsq_touchStatus {
  position: fixed;
  left: 50%;
  z-index: 63;
  transform: translateX(-50%);
  max-width: calc(100vw - 32px);
}

/* Transcript summary — the same block as the composer's, right-aligned under
   the user bubble. One block per message; the hover list carries every
   annotation with its selected text and comment. */
.dsq_tSummary {
  display: flex;
  justify-content: flex-end;
  margin: 4px 0 8px;
}

.dsq_tSummary .dsq_summary {
  width: auto;
  min-width: 160px;
  max-width: min(calc(var(--dsq-chat-width) * 0.72), 520px);
  /* In the composer the card must clear .dsq_cardStack (12); in the transcript
     it is plain content and must stay under the floating layer's host (6/8),
     otherwise a hovered comment popover is painted beneath it. */
  z-index: 1;
}

/* Replacement user bubble (quote block stripped from display). */
.dsq_userRow {
  gap: 6px;
}

.dsq_userStack {
  min-width: 0;
  max-width: min(calc(var(--dsq-chat-width) * 0.702), 82%);
  gap: 8px;
}

.dsq_userBubble {
  max-width: 100%;
  padding: 10px 16px;
  border-radius: 22px;
  background: var(--dsq-bubble);
  color: var(--dsq-label);
  font-size: var(--dsq-font-size);
  line-height: calc(22px + var(--dsq-font-delta));
  white-space: pre-wrap;
  word-break: break-word;
}

/* Durable message images of a replacement user bubble. */
.dsq_userImages {
  max-width: 100%;
}

.dsq_userImages img {
  display: block;
  max-width: 100%;
  border-radius: 12px;
}

/* Model-written :dsh-annotation{index="N"} chips. */
.dsq_annDirective {
  appearance: none;
  margin: 0 2px;
  padding: 0 6px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 6px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-link);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  vertical-align: baseline;
}

/* Inline annotation mark in message bodies: highlight underline + ordinal badge. */
.dsq_annMark {
  --dsq-mark-color: var(--dsq-accent);
  --dsq-mark-tint: var(--dsq-accent-tint);
  position: relative;
  background: var(--dsq-mark-tint);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-decoration-color: var(--dsq-mark-color);
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
  border-radius: 2px;
  scroll-margin-block: 96px;
  transition: background-color 0.12s;
}

/* Ordinal as a superscript corner badge at the END of the marked text, so it
   never sits between the reader and the sentence. Only the last fragment of a
   multi-fragment mark carries the index, so the number appears exactly once.
   Absolute so the badge adds no inline advance width: annotating never reflows
   the paragraph or moves following words. Bottom (not top) anchors to the last
   fragment: for a mark spanning several lines the containing block is the union
   of the first and last fragments, so its bottom edge is the last line.
   BADGE_BOTTOM / BADGE_HEIGHT / the 2px margin in annotate-text.ts mirror the
   numbers below for collision measurement. */
.dsq_annMark[data-dsq-ann-index]::after {
  content: attr(data-dsq-ann-index);
  position: absolute;
  bottom: 8px;
  left: 100%;
  /* Above the native selection highlight and the background of a later mark:
     both otherwise paint over the badge when their ranges meet. */
  z-index: 2;
  /* JS shifts colliding badges right/up; the resting position is unchanged. */
  transform: translate(var(--dsq-ann-badge-x, 0px), var(--dsq-ann-badge-y, 0px));
  display: grid;
  place-items: center;
  min-width: 15px;
  height: 15px;
  margin-left: 2px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--dsq-mark-color);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  /* The only click target on a mark; the prose itself stays selectable. */
  pointer-events: auto;
  cursor: pointer;
}

/* Arrow badge for a selection sent to another conversation. One glyph, so the
   width is fixed instead of digit-based; the box matches the ordinal badge so
   collision offsets stay interchangeable. */
.dsq_annMark[data-dsq-ann-arrow]::after {
  content: "↗";
  position: absolute;
  bottom: 8px;
  left: 100%;
  z-index: 2;
  transform: translate(var(--dsq-ann-badge-x, 0px), var(--dsq-ann-badge-y, 0px));
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  margin-left: 2px;
  padding: 0;
  border-radius: 999px;
  background: var(--dsq-mark-color);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  pointer-events: auto;
  cursor: pointer;
}

.dsq_annMark:hover {
  background: var(--dsq-mark-hover);
}

/* One row per handoff destination inside the arrow preview. */
.dsq_handoffRow {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
}

.dsq_handoffRowHead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* Target selection portalled to body, same layer as the context menu. */
.dsq_targetPicker {
  position: fixed;
  z-index: 64;
  box-sizing: border-box;
  width: min(360px, calc(100vw - 16px));
  max-height: min(460px, calc(100vh - 32px));
  padding: 8px;
  border-radius: 14px;
  animation: dsq-menu-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Touch opens the same list as a bottom sheet. Transform-only entrance. */
.dsq_targetPicker[data-touch='true'] {
  left: 50% !important;
  top: auto !important;
  bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  width: min(520px, calc(100vw - 16px));
  max-height: min(72vh, 560px);
  transform: translateX(-50%);
  animation: dsq-sheet-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes dsq-sheet-in {
  from {
    transform: translate(-50%, 8px);
  }
  to {
    transform: translate(-50%, 0);
  }
}

.dsq_targetHead {
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 6px;
}

.dsq_targetHeading {
  color: var(--dsq-label);
  font-size: 13px;
  font-weight: 600;
}

.dsq_targetSearchRow {
  padding: 0 2px 6px;
}

.dsq_targetSearch {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--dsq-line);
  border-radius: 8px;
  outline: none;
  background: transparent;
  color: var(--dsq-label);
  font: inherit;
  font-size: 13px;
}

.dsq_targetSearch::placeholder {
  color: var(--dsq-label-3);
}

.dsq_targetSearch:focus-visible {
  outline: 2px solid var(--dsq-focus-ring-soft);
  outline-offset: 1px;
}

.dsq_targetList {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsq_targetGroupLabel {
  padding: 8px 10px 4px;
  color: var(--dsq-label-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dsq_targetOption {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dsq-label);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.dsq_targetOption:hover,
.dsq_targetOption[aria-selected='true'] {
  background: var(--dsq-fill-hover);
}

.dsq_targetOption:focus-visible {
  outline: 2px solid var(--dsq-focus-ring);
  outline-offset: -2px;
}

.dsq_targetOptionMain {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.dsq_targetTitleMain {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsq_targetMeta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsq-label-3);
  font-size: 11px;
}

.dsq_targetNew {
  color: var(--dsq-accent);
}

.dsq_targetTime {
  flex: none;
  margin-left: auto;
  color: var(--dsq-label-3);
  font-size: 11px;
}

.dsq_targetEmpty {
  padding: 10px;
  color: var(--dsq-label-3);
  font-size: 12px;
}

/* Handoff composer mode: the target chip and its copy. */
.dsq_handoffChip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
  font-size: 12.5px;
}

.dsq_handoffChipTitle {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsq-accent);
  font-weight: 500;
}

.dsq_handoffChipLabel {
  flex: none;
  color: var(--dsq-label-3);
  font-size: 11px;
}

.dsq_handoffChange {
  flex: none;
  margin-left: auto;
  padding: 2px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsq-accent);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsq_handoffChange:hover {
  background: var(--dsq-fill-hover);
}

.dsq_handoffHint {
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 1.5;
}

.dsq_handoffError {
  color: var(--dsq-danger);
  font-size: 12px;
  line-height: 1.5;
}

/* "来自：<source>" row in a target's pending/history card. */
.dsq_originLink {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsq-accent);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.dsq_originLink span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsq_originLink:disabled {
  color: var(--dsq-label-3);
  cursor: default;
}

/* Body-level transient notice (archived target, handoff success). */
.dsq_toast {
  position: fixed;
  left: 50%;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 1100;
  max-width: min(420px, calc(100vw - 24px));
  padding: 8px 12px;
  border-radius: 10px;
  transform: translateX(-50%);
  /* The host's layer-3 / inverted-label pair resolves to white on white in
     the light theme. Derive both from the primary label instead: dark pill in
     light mode, light pill in dark mode, always readable. */
  background: color-mix(in srgb, var(--dsq-label) 90%, transparent);
  color: var(--dsq-bg-raised);
  font-size: 12.5px;
  line-height: 1.45;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--dsq-label) 22%, transparent);
  animation: dsq-toast-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: none;
}

.dsq_annMarkFlash {
  animation: dsq-ann-flash 1.4s ease-out;
}

/* Fallback jump target when the source mark is no longer in the DOM: flash the
   message that owns it instead of scrolling nowhere. */
.dsq_annMessageFlash {
  animation: dsq-ann-message-flash 1.4s ease-out;
}

@keyframes dsq-ann-message-flash {
  0% {
    box-shadow: inset 0 0 0 2px var(--dsq-accent);
  }
  100% {
    box-shadow: inset 0 0 0 2px transparent;
  }
}

/* Keyboard focus is a first-class state for the toolbar, summary and panel. */
.dsq_summary:focus-visible,
.dsq_button:focus-visible,
.dsq_touchAction:focus-visible,
.dsq_touchSheetClose:focus-visible,
.dsq_chipPreviewAction:focus-visible,
.dsq_handoffChevron:focus-visible,
.dsq_handoffChange:focus-visible,
.dsq_originLink:focus-visible,
.dsq_annMark:focus-visible,
.dsq_summaryItemAction:focus-visible,
.dsq_summaryItemButton:focus-visible,
.dsq_cardClose:focus-visible,
.dsq_annEditCancel:focus-visible,
.dsq_annEditSave:focus-visible {
  outline: 2px solid var(--dsq-focus-ring);
  outline-offset: 2px;
}

.dsq_commentInput:focus-visible,
.dsq_annEditInput:focus-visible {
  /* The host's button fill is monochrome (black on light, white on dark); a
     half-transparent accent ring reads as focus without looking like a border. */
  outline: 2px solid var(--dsq-focus-ring-soft);
  outline-offset: 1px;
}

/* Touch: 44px minimum targets. Icon-only corners keep their visual size and
   grow an invisible hit area; toolbar actions grow in place. */
@media (hover: none), (pointer: coarse) {
  .dsq_button,
  .dsq_annEditCancel,
  .dsq_annEditSave {
    min-height: 44px;
  }
  .dsq_summaryItemAction {
    width: 44px;
    height: 44px;
  }
  .dsq_chipPreviewAction {
    width: 44px;
    height: 44px;
  }
  .dsq_cardClose::after {
    content: "";
    position: absolute;
    inset: -12px;
  }
  .dsq_targetOption {
    min-height: 44px;
  }
  /* iOS zooms the page when a focused field is under 16px. */
  .dsq_targetSearch {
    font-size: 16px;
  }
  .dsq_segOption {
    min-height: 44px;
  }
}

/* Settings row (plugin page): an inline segmented control. The page owns the
   write, so there is no save button — each pick is committed immediately. */
.dsq_settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 2px 0;
}

/* Both settings rows follow the Host pattern: copy on the left, control on
   the right. The trigger control wraps below only when the row is too narrow. */
.dsq_settingsSection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.dsq_settingsCopy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.dsq_settingsSection .dsq_settingsCopy {
  flex: 1 1 240px;
}

.dsq_settingsLabel {
  color: var(--dsq-label);
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.dsq_settingsHint {
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 1.5;
}

/* Translation settings: a dropdown that reads as a field, the same model
   picker as the composer (restyled to field height), and a prompt textarea. */
.dsq_settingsSelect {
  justify-content: space-between;
  min-width: 150px;
  padding: 6px 10px;
  border: 1px solid var(--dsq-line);
  border-radius: 10px;
}

.dsq_settingsModel {
  min-width: 0;
  max-width: 260px;
}

.dsq_settingsModel .dsq_modelSeat {
  width: 100%;
}

.dsq_settingsModel .dsq_modelTrigger {
  width: 100%;
  max-width: 100%;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--dsq-line);
  border-radius: 10px;
  color: var(--dsq-label);
}

.dsq_settingsField {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.dsq_settingsInput {
  box-sizing: border-box;
  width: 100%;
  min-height: 104px;
  padding: 8px 10px;
  border: 1px solid var(--dsq-line);
  border-radius: 10px;
  outline: none;
  background: transparent;
  color: var(--dsq-label);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.55;
  resize: vertical;
}

.dsq_settingsInput::placeholder {
  color: var(--dsq-label-3);
}

.dsq_settingsInput:focus-visible {
  border-color: var(--dsq-focus-ring);
}

/* Shortcut reference under the switch: the two commands and the keycaps the
   Host currently has in effect, so a rebind shows up here without a reload. */
.dsq_settingsShortcuts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dsq_settingsShortcutRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 22px;
}

.dsq_settingsShortcutName {
  min-width: 0;
  color: var(--dsq-label-2);
  font-size: 12px;
}

.dsq_settingsShortcutKeys {
  flex: none;
  color: var(--dsq-label-3);
  font-size: 12px;
}

.dsq_keycap {
  display: inline-block;
  min-width: 18px;
  padding: 1px 6px;
  border: 1px solid var(--dsq-line);
  border-radius: 5px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-label-2);
  font: inherit;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
}

.dsq_seg {
  position: relative;
  display: inline-flex;
  flex: none;
  gap: 2px;
  margin-left: auto;
  padding: 2px;
  border-radius: 8px;
  background: var(--dsq-fill-hover);
}

/* One selected cell painted as a sliding thumb: the previous position lives in
   the same element, so switching only moves it. Width is measured from the
   live label, which keeps it aligned after a locale or layout change. */
.dsq_segThumb {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  border-radius: 6px;
  background: var(--dsq-bg-raised);
  box-shadow: 0 0 0 0.5px var(--dsq-line);
  transition:
    transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
    width 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}

.dsq_segOption {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px;
  color: var(--dsq-label-2);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.12s ease;
}

.dsq_segOption:hover {
  color: var(--dsq-label);
}

.dsq_segOption[data-active="true"] {
  color: var(--dsq-label);
}

.dsq_segOption:has(:focus-visible) {
  outline: 2px solid var(--dsq-focus-ring-soft);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .dsq_deleteConfirmLabel {
    transition: none;
  }

  .dsq_segThumb {
    transition: none;
  }

  .dsq_translateShimmer {
    animation: none;
    background-image: none;
    color: var(--dsq-label-3);
  }

  .dsq_translateCaret {
    animation: none;
  }

  .dsq_progressCell {
    animation: none;
    transform: none;
  }

  .dsq_translateReasoningChevron {
    transition: none;
  }
}

.dsq_settingsDivider {
  height: 1px;
  background: var(--dsq-line);
}

/* The whole row is the target: label text, hint, and the switch itself. */
.dsq_settingsSwitchRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.dsq_settingsSwitchRow .dsq_settingsCopy {
  flex: 1;
  min-width: 0;
}

/* Exactly the Host switch metrics: 36×20 track, 16px thumb, 2px inset, and
   the same on/off tokens. The thumb only animates its transform, like the
   product control; the track changes color in one step. */
.dsq_switch {
  box-sizing: border-box;
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  corner-shape: round;
  background: var(--dsq-switch-off);
  cursor: pointer;
}

.dsq_switch[data-on='true'] {
  background: var(--dsq-switch-on);
}

.dsq_switchTrack {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  corner-shape: round;
  background: var(--dsq-switch-thumb-off);
  transition: transform 0.12s ease;
}

.dsq_switch[data-on='true'] .dsq_switchTrack {
  background: var(--dsq-switch-thumb-on);
  transform: translateX(16px);
}

.dsq_switch:has(:focus-visible) {
  outline: 2px solid var(--dsq-focus-ring-soft);
  outline-offset: 2px;
}

/* Visually hidden but still focusable: the native radio/checkbox carries the
   semantics and keyboard behavior, the label carries the paint. */
.dsq_srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Layer 4 — host surface: keyframes, theme flips, and the two rules that reach
   into product-owned DOM. */

@keyframes dsq-ann-flash {
  0% {
    background: var(--dsq-mark-color);
    color: #fff;
    box-shadow: 0 0 0 3px var(--dsq-mark-tint);
  }
  100% {
    background: var(--dsq-mark-tint);
    color: inherit;
    box-shadow: 0 0 0 0 transparent;
  }
}

/* The product flips its palette on body[data-ds-dark-theme], and every
   --dsq-* alias follows it. Only values we own ourselves need restating. */
body[data-ds-dark-theme] .dsq_annMark {
  --dsq-mark-tint: var(--dsq-accent-tint-dark);
  --dsq-mark-hover: var(--dsw-static-blue-800, #1e40af);
}

/* Reserve room for the floating annotation summary inside the composer card, so the
   attachment rail and the editor flow below them instead of being covered. */
.dsq_cardPad {
  padding-top: var(--dsq-quote-pad, 88px) !important;
}
`

const TAG_ID = 'dsh-select-quote/toolbar.css'
export function ensureToolbarStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-select-quote'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

export const styles = {
  toolbar: 'dsq_toolbar',
  toolbarInner: 'dsq_toolbarInner',
  button: 'dsq_button',
  buttonAddComment: 'dsq_buttonAddComment',
  kbd: 'dsq_kbd',
  divider: 'dsq_divider',
  status: 'dsq_status',
  ctxMenu: 'dsq_ctxMenu',
  ctxItem: 'dsq_ctxItem',
  modelSeat: 'dsq_modelSeat',
  modelTrigger: 'dsq_modelTrigger',
  modelTriggerIcon: 'dsq_modelTriggerIcon',
  modelTriggerLabel: 'dsq_modelTriggerLabel',
  modelTriggerEffort: 'dsq_modelTriggerEffort',
  modelChevron: 'dsq_modelChevron',
  modelChevronOpen: 'dsq_modelChevronOpen',
  modelMenu: 'dsq_modelMenu',
  modelCell: 'dsq_modelCell',
  modelCellLabel: 'dsq_modelCellLabel',
  modelCellValue: 'dsq_modelCellValue',
  modelSearchRow: 'dsq_modelSearchRow',
  modelSearch: 'dsq_modelSearch',
  modelSearchWithQuery: 'dsq_modelSearchWithQuery',
  modelSearchClear: 'dsq_modelSearchClear',
  modelStatus: 'dsq_modelStatus',
  modelEmpty: 'dsq_modelEmpty',
  modelError: 'dsq_modelError',
  modelWarning: 'dsq_modelWarning',
  modelRetry: 'dsq_modelRetry',
  modelGroups: 'dsq_modelGroups',
  modelGroup: 'dsq_modelGroup',
  modelGroupLabel: 'dsq_modelGroupLabel',
  modelOption: 'dsq_modelOption',
  modelModelOption: 'dsq_modelModelOption',
  modelOptionActive: 'dsq_modelOptionActive',
  modelSelected: 'dsq_modelSelected',
  modelOptionCopy: 'dsq_modelOptionCopy',
  modelModelName: 'dsq_modelModelName',
  modelLabel: 'dsq_modelLabel',
  modelTag: 'dsq_modelTag',
  modelCheck: 'dsq_modelCheck',
  cardStack: 'dsq_cardStack',
  cardClose: 'dsq_cardClose',
  cardPad: 'dsq_cardPad',
  summary: 'dsq_summary',
  summaryIcon: 'dsq_summaryIcon',
  summaryBody: 'dsq_summaryBody',
  summaryTitle: 'dsq_summaryTitle',
  summaryHint: 'dsq_summaryHint',
  summaryHintPointer: 'dsq_summaryHintPointer',
  summaryHintTouch: 'dsq_summaryHintTouch',
  summaryHover: 'dsq_summaryHover',
  summaryHoverLeaving: 'dsq_summaryHoverLeaving',
  summaryItem: 'dsq_summaryItem',
  summaryItemLabel: 'dsq_summaryItemLabel',
  summaryItemText: 'dsq_summaryItemText',
  summaryItemBadge: 'dsq_summaryItemBadge',
  summaryItemMain: 'dsq_summaryItemMain',
  summaryItemHead: 'dsq_summaryItemHead',
  summaryItemTextEmpty: 'dsq_summaryItemTextEmpty',
  summaryItemTextEdit: 'dsq_summaryItemTextEdit',
  annEditInput: 'dsq_annEditInput',
  annEditActions: 'dsq_annEditActions',
  annEditCancel: 'dsq_annEditCancel',
  annEditSave: 'dsq_annEditSave',
  summaryHoverInner: 'dsq_summaryHoverInner',
  summaryList: 'dsq_summaryList',
  summaryItemButton: 'dsq_summaryItemButton',
  summaryHoverOpen: 'dsq_summaryHoverOpen',
  summaryItemActions: 'dsq_summaryItemActions',
  summaryItemAction: 'dsq_summaryItemAction',
  annDirective: 'dsq_annDirective',
  annAnchor: 'dsq_annAnchor',
  annMark: 'dsq_annMark',
  annMarkFlash: 'dsq_annMarkFlash',
  annMessageFlash: 'dsq_annMessageFlash',
  handoffRow: 'dsq_handoffRow',
  handoffRowHead: 'dsq_handoffRowHead',
  targetPicker: 'dsq_targetPicker',
  targetHead: 'dsq_targetHead',
  targetHeading: 'dsq_targetHeading',
  targetSearchRow: 'dsq_targetSearchRow',
  targetSearch: 'dsq_targetSearch',
  targetList: 'dsq_targetList',
  targetGroupLabel: 'dsq_targetGroupLabel',
  targetOption: 'dsq_targetOption',
  targetOptionMain: 'dsq_targetOptionMain',
  targetTitleMain: 'dsq_targetTitleMain',
  targetMeta: 'dsq_targetMeta',
  targetNew: 'dsq_targetNew',
  targetTime: 'dsq_targetTime',
  targetEmpty: 'dsq_targetEmpty',
  handoffChevron: 'dsq_handoffChevron',
  handoffTargetName: 'dsq_handoffTargetName',
  handoffChip: 'dsq_handoffChip',
  handoffChipTitle: 'dsq_handoffChipTitle',
  handoffChipLabel: 'dsq_handoffChipLabel',
  handoffChange: 'dsq_handoffChange',
  handoffHint: 'dsq_handoffHint',
  handoffError: 'dsq_handoffError',
  originLink: 'dsq_originLink',
  toast: 'dsq_toast',
  commentPop: 'dsq_commentPop',
  commentPopSide: 'dsq_commentPopSide',
  commentPopTranslate: 'dsq_commentPopTranslate',
  translateQuote: 'dsq_translateQuote',
  translateHead: 'dsq_translateHead',
  translateTargetLabel: 'dsq_translateTargetLabel',
  translateClose: 'dsq_translateClose',
  translateBody: 'dsq_translateBody',
  translateText: 'dsq_translateText',
  translateHint: 'dsq_translateHint',
  translateLoading: 'dsq_translateLoading',
  progressGrid: 'dsq_progressGrid',
  progressCell: 'dsq_progressCell',
  translateShimmer: 'dsq_translateShimmer',
  translateCaret: 'dsq_translateCaret',
  translateError: 'dsq_translateError',
  translateReasoning: 'dsq_translateReasoning',
  translateReasoningSummary: 'dsq_translateReasoningSummary',
  translateReasoningChevron: 'dsq_translateReasoningChevron',
  translateReasoningText: 'dsq_translateReasoningText',
  translateReasoningLive: 'dsq_translateReasoningLive',
  translateActions: 'dsq_translateActions',
  langSeat: 'dsq_langSeat',
  langTrigger: 'dsq_langTrigger',
  langChevron: 'dsq_langChevron',
  langChevronOpen: 'dsq_langChevronOpen',
  langMenu: 'dsq_langMenu',
  langOption: 'dsq_langOption',
  langOptionActive: 'dsq_langOptionActive',
  langCheck: 'dsq_langCheck',
  commentInput: 'dsq_commentInput',
  commentActions: 'dsq_commentActions',
  sideQuote: 'dsq_sideQuote',
  sideQuoteText: 'dsq_sideQuoteText',
  sideFooter: 'dsq_sideFooter',
  chipPreview: 'dsq_chipPreview',
  chipPreviewBody: 'dsq_chipPreviewBody',
  chipPreviewLeaving: 'dsq_chipPreviewLeaving',
  chipPreviewHead: 'dsq_chipPreviewHead',
  chipPreviewTitle: 'dsq_chipPreviewTitle',
  chipPreviewLabel: 'dsq_chipPreviewLabel',
  chipPreviewQuote: 'dsq_chipPreviewQuote',
  chipPreviewComment: 'dsq_chipPreviewComment',
  chipPreviewCommentEmpty: 'dsq_chipPreviewCommentEmpty',
  chipPreviewActions: 'dsq_chipPreviewActions',
  chipPreviewAction: 'dsq_chipPreviewAction',
  deleteConfirm: 'dsq_deleteConfirm',
  deleteConfirmInner: 'dsq_deleteConfirmInner',
  deleteConfirmLabel: 'dsq_deleteConfirmLabel',
  touchBar: 'dsq_touchBar',
  touchAction: 'dsq_touchAction',
  touchScrim: 'dsq_touchScrim',
  touchSheet: 'dsq_touchSheet',
  touchSheetHead: 'dsq_touchSheetHead',
  touchSheetTitle: 'dsq_touchSheetTitle',
  touchSheetClose: 'dsq_touchSheetClose',
  touchQuote: 'dsq_touchQuote',
  touchComment: 'dsq_touchComment',
  touchActions: 'dsq_touchActions',
  touchSecondary: 'dsq_touchSecondary',
  touchStatus: 'dsq_touchStatus',
  tSummary: 'dsq_tSummary',
  userRow: 'dsq_userRow',
  userStack: 'dsq_userStack',
  userImages: 'dsq_userImages',
  userBubble: 'dsq_userBubble',
  settings: 'dsq_settings',
  settingsSection: 'dsq_settingsSection',
  settingsCopy: 'dsq_settingsCopy',
  settingsLabel: 'dsq_settingsLabel',
  settingsHint: 'dsq_settingsHint',
  settingsSelect: 'dsq_settingsSelect',
  settingsModel: 'dsq_settingsModel',
  settingsField: 'dsq_settingsField',
  settingsInput: 'dsq_settingsInput',
  settingsShortcuts: 'dsq_settingsShortcuts',
  settingsShortcutRow: 'dsq_settingsShortcutRow',
  settingsShortcutName: 'dsq_settingsShortcutName',
  settingsShortcutKeys: 'dsq_settingsShortcutKeys',
  keycap: 'dsq_keycap',
  settingsDivider: 'dsq_settingsDivider',
  settingsSwitchRow: 'dsq_settingsSwitchRow',
  switch: 'dsq_switch',
  switchTrack: 'dsq_switchTrack',
  seg: 'dsq_seg',
  segThumb: 'dsq_segThumb',
  segOption: 'dsq_segOption',
  srOnly: 'dsq_srOnly',
} as const
