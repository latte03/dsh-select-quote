/** Chip preview popover.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const PREVIEW_CSS = `
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
`
