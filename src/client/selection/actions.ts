import type { SelectionSnapshot } from '../dom/selection.ts'
import { linkTarget } from '../dom/selection-url.ts'
import { t } from '../i18n.ts'
import type { IconName } from '../ui/icons.tsx'

/** The entry points offered for a selection, whichever surface shows them. */
export type SelectionActionKey = 'open' | 'copy' | 'translate' | 'add' | 'handoff' | 'side'

/** One render segment of an action label; the accent one is the target name. */
export interface SelectionLabelPart {
  readonly text: string
  readonly accent?: boolean
}

export interface SelectionAction {
  readonly key: SelectionActionKey
  readonly icon: IconName
  readonly label: string
  /** Split label for styling the target name without changing the wording. */
  readonly labelParts?: readonly SelectionLabelPart[]
  /** Right-click menu wording when it differs (the menu always opens the picker). */
  readonly menuLabel?: string
}

/**
 * Cross-session handoff entry. `label` is the main button (normally the
 * latched default target), `menuLabel` the right-click row that always opens
 * the picker. `available` is false when the host lacks the workspace services
 * or the source session has no workspace and no cwd.
 */
export interface HandoffActionOptions {
  readonly available: boolean
  readonly label: string
  /** Live target title inside `label`, rendered in the accent color. */
  readonly targetName?: string
  readonly menuLabel?: string
}

/**
 * Split a label around the target title so only the name is highlighted.
 * Language order stays intact: the split follows the translated template, not
 * a hard-coded "放入 {target}" shape.
 */
export function splitLabelAt(
  label: string,
  accent: string | undefined,
): readonly SelectionLabelPart[] {
  const needle = accent?.trim()
  if (!needle) return [{ text: label }]
  const at = label.indexOf(needle)
  if (at < 0) return [{ text: label }]
  return [
    { text: label.slice(0, at) },
    { text: needle, accent: true },
    { text: label.slice(at + needle.length) },
  ].filter((part) => part.text !== '')
}

export interface SelectionActionEntry extends SelectionAction {
  readonly onClick: () => void
}

/** Per-selection visibility switches that depend on the text itself. */
export interface SelectionActionVisibility {
  /** Hide translate when the selection already is the target language. */
  readonly hideTranslate?: boolean
}

/**
 * One ordered list for both surfaces: the floating toolbar paints it inline,
 * the right-click menu paints it vertically. Adding or reordering an action
 * here reaches both, so the two entry points cannot drift apart.
 */
export function selectionActions(
  snapshot: SelectionSnapshot,
  handoff?: HandoffActionOptions,
  visibility?: SelectionActionVisibility,
): readonly SelectionAction[] {
  return [
    ...(linkTarget(snapshot.text, snapshot.anchorHref) === null
      ? []
      : [{ key: 'open' as const, icon: 'external-link' as const, label: t('toolbar.openLink') }]),
    { key: 'copy', icon: 'copy', label: t('toolbar.copy') },
    ...(visibility?.hideTranslate
      ? []
      : [{ key: 'translate' as const, icon: 'languages' as const, label: t('toolbar.translate') }]),
    { key: 'add', icon: 'plus', label: t('toolbar.addToTask') },
    ...(handoff?.available
      ? [
          {
            key: 'handoff' as const,
            icon: 'arrow-up-right' as const,
            label: handoff.label,
            labelParts: splitLabelAt(handoff.label, handoff.targetName),
            menuLabel: handoff.menuLabel ?? handoff.label,
          },
        ]
      : []),
    { key: 'side', icon: 'panel-right', label: t('toolbar.askInSide') },
  ]
}
