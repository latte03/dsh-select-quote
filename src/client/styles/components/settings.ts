/** Plugin settings page.
 *
 * Layer 3 module; the entry concatenates component modules in source order
 * (the cascade depends on it).
 */
export const SETTINGS_CSS = `
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
`
