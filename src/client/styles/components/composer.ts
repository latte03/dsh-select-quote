/** Comment composer, side-task and translation popovers.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const COMPOSER_CSS = `
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
`
