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

/* Confirming: same square, the pill floats beside it.
 *
 * A grid + place-items:center centres the inner box; the box itself stays in
 * flow at its natural size, which is what lets the label inside it anchor to
 * the *button* (right: 100%) instead of to a full-bleed box. */
.dsq_summaryItemActions .dsq_deleteConfirm {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  gap: 0;
  background: transparent;
  color: var(--dsq-danger);
  overflow: visible;
}

/* Icon + label wrapper; sized to the icon so the square never grows. */
.dsq_summaryItemActions .dsq_deleteConfirmInner {
  display: grid;
  place-items: center;
  white-space: nowrap;
}

/* The pill itself: anchored to the square, growing *inward* (to the left) and
   always on one line.
 *
 * It must stay inside the card: .dsq_summaryList scrolls (overflow-y:auto
 * also clips horizontally), so anything hung outside the list box would be cut
 * off. max-width therefore yields to the list's own width, with the text
 * ellipsised rather than wrapped — a truncated "确认移…" still reads, a
 * one-character-per-line column does not. */
/* Specificity note: preview.ts ships
 *   .dsq_deleteConfirm[data-confirming='true'] .dsq_deleteConfirmLabel
 * which is also [0,3,0] and is concatenated AFTER this module, so it wins every
 * tie. The extra .dsq_summaryItemActions level here is what keeps the summary's
 * own confirm geometry authoritative instead of silently reverting to the
 * shared 140px label. */
.dsq_summaryItemActions .dsq_deleteConfirm .dsq_deleteConfirmInner .dsq_deleteConfirmLabel {
  position: absolute;
  top: 50%;
  right: 100%;
  /* A span needs a block box for ellipsis to apply. */
  display: block;
  margin-right: 6px;
  margin-left: 0;
  max-width: 92px;
  padding: 4px 8px;
  border-radius: 7px;
  background: var(--dsq-danger-bg);
  color: var(--dsq-danger);
  font-size: 11.5px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateY(-50%);
  /* Collapsed state: invisible and inert, but always laid out so the first
     press can fade it in without measuring anything. */
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

/* Confirm state. Declared at [0,4,0] so it outranks preview.ts's
   [0,3,0] shorthand, which would otherwise restore max-width:140px and the
   in-flow behaviour this module replaced. */
.dsq_summaryItemActions .dsq_deleteConfirm[data-confirming='true'] .dsq_deleteConfirmInner .dsq_deleteConfirmLabel {
  max-width: 92px;
  margin-left: 0;
  opacity: 1;
  pointer-events: auto;
}

/* The row's own label yields to the confirm step rather than competing with it. */
.dsq_summaryItemHead .dsq_summaryItemLabel {
  min-width: 0;
  margin-top: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Same reasoning as the card: the pill overlays the head row, so the static
   label steps aside while the destructive step is armed. */
.dsq_summaryItemHead:has(.dsq_deleteConfirm[data-confirming='true']) > .dsq_summaryItemLabel {
  visibility: hidden;
}

/* "移除全部" on the summary card, second step.
 *
 * The corner button swaps .dsq_cardClose for .dsq_deleteConfirm when it
 * enters the confirm step — and cardClose is what carries
 * position:absolute. Without a replacement the button lands back in the
 * card's flex row, takes its width from the grown label, and squeezes the
 * title/hint column into a vertical stack ("注 / 悬停查 / 看批注"). So the
 * confirm state re-anchors the button to the same corner and hangs the pill
 * off its trailing edge, exactly like the per-item confirm does. */
.dsq_summary > .dsq_deleteConfirm {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  gap: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsq-danger);
  overflow: visible;
}

.dsq_summary > .dsq_deleteConfirm .dsq_deleteConfirmInner {
  display: grid;
  place-items: center;
  white-space: nowrap;
}

/* While the card asks for confirmation, the title/hint step aside so the pill
   has the row to itself instead of covering "1 条批注". visibility keeps the
   box, so the card never resizes and the corner button does not move. */
.dsq_summary:has(> .dsq_deleteConfirm[data-confirming='true']) > .dsq_summaryBody {
  visibility: hidden;
}

/* [0,4,0]: outranks preview.ts's [0,3,0] confirm shorthand. */
.dsq_summary > .dsq_deleteConfirm[data-confirming='true'] .dsq_deleteConfirmInner .dsq_deleteConfirmLabel {
  position: absolute;
  top: 50%;
  right: 100%;
  display: block;
  max-width: 92px;
  margin-right: 6px;
  margin-left: 0;
  padding: 4px 8px;
  border-radius: 7px;
  background: var(--dsq-danger-bg);
  color: var(--dsq-danger);
  font-size: 11.5px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transform: translateY(-50%);
  opacity: 1;
  pointer-events: auto;
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
