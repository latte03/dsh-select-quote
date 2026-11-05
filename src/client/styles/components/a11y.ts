/** Keyboard focus and touch-target rules.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const A11Y_CSS = `
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
`
