/** Annotation marks, handoff previews, target picker and notices.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const HANDOFF_CSS = `
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
`
