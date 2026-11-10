/** Annotation summary, hover panel and inline editing.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const ANNOTATIONS_CSS = `
/* Annotation stack — inside the composer card (input.overlay), ~1/5 width. */
.dsq_cardStack {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 12;
  width: 20%;
  /* Wide enough for the title and an inline confirm chip on one line. */
  min-width: 210px;
  max-width: 240px;
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
  /* On exit the confirm chip hands the corner back to this 20px button; the
     label inside is still fading, so clip it instead of letting it spill. */
  overflow: hidden;
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
  /* One ink for the count and the whale: the host's primary blue. The tile is
     the only place in the plugin that paints blue text, so it reads as "this is
     the annotation count", not as a link. */
  color: var(--dsq-accent);
  font-size: 13px;
  font-weight: 600;
  /* The tint layer below is absolute; it needs this tile as its containing
     block, and a nested copy of the tile is what the count animation remounts. */
  position: relative;
  /* The digit rolls in from outside the tile, so the tile is the viewport of its
     own little counter — without this the incoming number is drawn over the
     title while it fades up. */
  overflow: hidden;
}

/* The badge is a counter, not an ornament. It stays still until the number
   itself changes, and then the digit arrives from the side the change came
   from — added rises from below, removed drops from above — while the tile
   takes one soft tint. Nothing here runs on hover, on open, or on mount: a
   number the user is reading must not wander. Direction comes from
   summary-count.ts via data-dir; the tile is keyed by the count in the view,
   and that remount is what restarts these keyframes when the same direction
   happens twice in a row. */
.dsq_summaryIcon::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--dsq-link);
  opacity: 0;
  pointer-events: none;
}

.dsq_summaryCount {
  position: relative;
  display: block;
  /* 1 and 2 are the same width, so the digit does not shimmy mid-roll. */
  font-variant-numeric: tabular-nums;
}

/* Dot matrix: the tile's own ink, so the count and the running whale can share
   one grid without a second palette. currentColor follows the tile's link
   colour through theme changes for free. */
.dsq_summaryPixels {
  display: block;
  overflow: visible;
}

.dsq_summaryPixels path {
  fill: currentColor;
}

/* The wave runs through the count itself: while a turn is running the digit is
   drawn as cells instead of a path (see CountBadge), and these light it up in
   turn. The floor is 0.55 on purpose — this is the number the user is reading,
   so the pulse may make it breathe, never make it faint. */
.dsq_summaryPixels circle {
  fill: currentColor;
  opacity: 1;
  animation: dsq-pixel-breathe 1.8s ease-in-out infinite;
}

@keyframes dsq-pixel-breathe {
  0%,
  100% {
    opacity: 0.32;
  }
  45% {
    opacity: 1;
  }
}


@keyframes dsq-whale-swim {
  0%,
  8% {
    transform: translate(-130%, 0);
  }
  30% {
    transform: translate(-60%, -1px);
  }
  50% {
    transform: translate(0, 0);
  }
  70% {
    transform: translate(60%, 1px);
  }
  80%,
  100% {
    transform: translate(130%, 0);
  }
}

@keyframes dsq-whale-dive {
  0% {
    opacity: 0.5;
    transform: translate(0, 0) rotate(0deg);
  }
  30% {
    opacity: 1;
    transform: translate(0, -6px) rotate(-8deg);
  }
  60% {
    opacity: 1;
    transform: translate(2px, 4px) rotate(12deg);
  }
  100% {
    opacity: 0;
    transform: translate(4px, 18px) rotate(24deg);
  }
}

.dsq_summaryIcon[data-dir='up'] .dsq_summaryCount,
.dsq_summaryIcon[data-dir='up'] .dsq_summaryPixels {
  animation: dsq-count-up 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dsq_summaryIcon[data-dir='down'] .dsq_summaryCount,
.dsq_summaryIcon[data-dir='down'] .dsq_summaryPixels {
  animation: dsq-count-down 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Arrival only: a delete should leave nothing behind but the smaller number. */
.dsq_summaryIcon[data-dir='up']::before {
  animation: dsq-count-flash 0.26s cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes dsq-count-up {
  from {
    opacity: 0;
    transform: translateY(55%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dsq-count-down {
  from {
    opacity: 0;
    transform: translateY(-55%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dsq-count-flash {
  from {
    opacity: 0.18;
  }
  to {
    opacity: 0;
  }
}

/* Reduced motion keeps the "something changed" beat and drops the travel. */
@media (prefers-reduced-motion: reduce) {
  .dsq_summaryIcon[data-dir] .dsq_summaryCount,
  .dsq_summaryIcon[data-dir] .dsq_summaryPixels {
    animation: dsq-count-fade 0.16s ease;
  }

  .dsq_summaryIcon[data-dir='up']::before {
    animation: none;
  }

  /* Reduced motion keeps the information and drops the movement: the count
     stays fully legible, only the wave is gone. */
  .dsq_summaryPixels circle {
    animation: none;
    opacity: 1;
  }
}

@keyframes dsq-count-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

/* The hover panel and the chip preview are one floating surface, so the box is
   described once. Width follows the content: a short quote no longer pays for a
   full 320px card, and a long one still stops at the cap instead of running
   away. There is deliberately no width property — a fixed box without one is
   shrink-to-fit, which is exactly "as wide as the content, within the bounds".
   Both limits are measured before placement sets left, so the width the
   placement sees is the width that gets painted. */
.dsq_summaryHover,
.dsq_chipPreview {
  min-width: 160px;
  max-width: min(320px, calc(100vw - 16px));
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

.dsq_summaryHoverLeaving .dsq_summaryHoverInner {
  animation: dsq-rise-out 0.18s cubic-bezier(0.4, 0, 1, 1) both;
}

.dsq_summaryHoverLeaving .dsq_summaryList {
  animation: dsq-summary-fade-out 0.18s cubic-bezier(0.4, 0, 1, 1) both;
}

@keyframes dsq-summary-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
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
}

/* Same entrance as the chip preview and the settings dropdowns: grows out of the
   edge the card is anchored to. The side comes from place(), which already
   writes data-side on the portaled panel. */
.dsq_summaryHover[data-side='below'] .dsq_summaryList {
  transform-origin: 50% 0;
}

.dsq_summaryHover[data-side='above'] .dsq_summaryList {
  transform-origin: 50% 100%;
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
  position: relative;
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  /* The confirm pill overlays the row; clip it to the card so a very narrow
     summary can never push content outside the visible surface. */
  overflow: hidden;
  transition: background-color 0.12s;
}

.dsq_summaryItem:hover {
  background: color-mix(in srgb, var(--dsq-fill-hover) 50%, transparent) ;
}

.dsq_summaryItemHead {
  position: relative;
  gap: 6px;
  /* Normal mode's action buttons set the row height; keep it in edit mode too
     so the badge and the label never move when the actions disappear. */
  min-height: 26px;
  /* The confirm pill and the row label both clip here, never squeeze the row. */
  min-width: 0;
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

/* Second step of a remove: the same button grows a "确认移除" label.
 *
 * Layout here is load-bearing. The summary card is 20% wide (min 148px) and the
 * head row is a flex line that already holds the ordinal badge and the
 * "选中文本" label. Growing a label *inside* that row cannot work: whatever the
 * button asks for, the flex line only has the leftover width, and a shrinkable
 * flex item ends up a few pixels wide with the label wrapping one character per
 * line — the collapse this rule exists to prevent.
 *
 * So the confirm step leaves the flow entirely: the button keeps its 26px
 * square footprint (nothing shifts), and the "确认移除" pill is an absolutely
 * positioned overlay measured against that square, so the badge and the row's
 * label can never squeeze it. */
.dsq_summaryItemActions {
  position: relative;
  min-width: 0;
}
/* Second step of a remove: the same button becomes an in-flow pill.
 *
 * The shared rule (preview.ts) already grows a "确认移除" label by animating its
 * max-width. That animation only reads when the button stays in flow: the
 * sibling edit button slides left as the label grows. So this rule deliberately
 * does NOT position the button or its label — the original breakage was a flex
 * squeeze (the row shrank the growing button to a few pixels and the label
 * wrapped one character per line), not placement. flex:none plus nowrap keeps
 * the pill at its natural width; the row label truncates instead, so nothing
 * is covered and nothing wraps. */
.dsq_summaryItemActions .dsq_deleteConfirm {
  flex: none;
  white-space: nowrap;
}

/* Collapsed label reserves no width, so the pill only occupies what it shows. */
.dsq_summaryItemActions .dsq_deleteConfirm .dsq_deleteConfirmInner {
  white-space: nowrap;
}

/* The row label yields width to the growing pill rather than competing. */
.dsq_summaryItemHead .dsq_summaryItemLabel {
  min-width: 0;
  margin-top: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* "移除全部" on the summary card, second step.
 *
 * The chip keeps the icon button's corner (absolute, right-anchored) and only
 * claims a fixed width, so it grows leftwards without touching the card layout:
 * the badge, the title and the hint stay exactly where they were, with no
 * reflow and no jitter. Because cardClose already sits in that corner, the
 * confirm step is the same control in the same place — it just gets wider.
 *
 * Fixed rather than shrink-to-fit: the width has to hold "× 确认移除" at the
 * smallest text size the app uses, and a fixed value keeps the two states
 * visually interchangeable. */
.dsq_summary > .dsq_deleteConfirm {
  position: absolute;
  top: 4px;
  right: 4px;
  /* Above the card's own text: the chip overlays the title in this state, so it
     has to win the paint order outright. */
  z-index: 4;
  /* A 1px ring in the raised surface colour lifts it off whatever it covers —
     white on light themes, the dark surface on dark ones, both through the same
     token. */
  box-shadow: 0 0 0 1px var(--dsq-bg-raised);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 26px;
  padding: 0;
  gap: 0;
  white-space: nowrap;
}

.dsq_summary > .dsq_deleteConfirm .dsq_deleteConfirmInner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

/* The pill reads "× 确认移除": the icon already precedes the label in the DOM,
   so in flow the two sit side by side inside one chip. */
.dsq_summary > .dsq_deleteConfirm .dsq_deleteConfirmInner {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

/* Body gives way by truncating, never by wrapping. */
.dsq_summaryBody {
  min-width: 0;
}

.dsq_summaryTitle,
.dsq_summaryHint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* A user message that carries annotations but no words.
 *
 * The bubble is Host-rendered now, and the Host decides to show it from the raw
 * content: an annotation-only message still has content (the protocol block), so
 * the bubble paints — but our userText rule renders that block as empty text, so
 * what remains is an empty rounded box above the card. Hide it, and hide it only
 * when the bubble really holds nothing else:
 *
 *   bubble > (only child) userText root > (only child) text seat > (only child) empty run
 *
 * Any attachment, file card, reference summary or extra JSON block adds a
 * sibling at one of those levels and keeps the bubble visible. */
[data-message-bubble]:has(
    > span:only-child
      > span[data-slot='conversation.user.text.node']:only-child
      > span:empty:only-child
  ) {
  display: none;
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
`
