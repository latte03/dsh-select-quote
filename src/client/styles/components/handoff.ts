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

/* Badge painted at the END of a mark: the ordinal, the handoff arrow, or the
   bot glyph for a side question.
   A real element, not a ::after. A mark that wraps is one inline box spanning
   several lines, and percentage offsets resolve against a width unrelated to
   where the text actually ends (measured: a 678px two-line mark resolved
   +left: 100%+ to 0, a 91px one-line mark to 90.88px). annotate-text.ts
   therefore measures the last line fragment and writes left/top in pixels;
   collision offsets become a transform on this element alone. */
.dsq_annBadge {
  position: absolute;
  display: grid;
  place-items: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--dsq-mark-color);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  line-height: 1;
  /* Above the native selection highlight and the background of a later mark:
     both otherwise paint over the badge when their ranges meet. */
  z-index: 2;
  /* The mark stays the click target; the badge is decoration. */
  pointer-events: none;
  /* Never part of a text selection. Otherwise Ctrl+A or a drag across the
     sentence includes the glyph, and the native highlight paints a coloured
     box behind a badge that is meant to look like a superscript label. */
  user-select: none;
  -webkit-user-select: none;
}

/* Side-question mark: the lucide bot glyph instead of the ordinal, drawn in
   white to match the badge ink on the accent fill. The glyph is a data URI
   because the badge is a single element with no room for an inline svg. */
.dsq_annBadge[data-dsq-ann-robot] {
  /* Same padding as an ordinal badge, so the two read as one control; the
     glyph shrinks to the content box (15px min-width - 6px padding). */
  padding: 0 3px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 8V4H8'/%3E%3Crect width='16' height='12' x='4' y='8' rx='2'/%3E%3Cpath d='M2 14h2'/%3E%3Cpath d='M20 14h2'/%3E%3Cpath d='M15 13v2'/%3E%3Cpath d='M9 13v2'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 9px 9px;
}

/* Arrow badge for a selection sent to another conversation. One glyph, so the
   width is fixed instead of digit-based; the box matches the ordinal badge so
   collision offsets stay interchangeable. */
.dsq_annBadge[data-dsq-ann-arrow] {
  width: 15px;
  padding: 0;
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
