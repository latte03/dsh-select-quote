/** Model picker ported from the Host composer.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const MODEL_CSS = `
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
`
