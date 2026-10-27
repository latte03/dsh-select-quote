import type { SelectionSnapshot } from '../dom/selection.ts'
import { linkTarget } from '../dom/selection-url.ts'
import { t } from '../i18n.ts'
import type { IconName } from '../ui/icons.tsx'

/** The entry points offered for a selection, whichever surface shows them. */
export type SelectionActionKey = 'open' | 'copy' | 'add' | 'side'

export interface SelectionAction {
  readonly key: SelectionActionKey
  readonly icon: IconName
  readonly label: string
}

export interface SelectionActionEntry extends SelectionAction {
  readonly onClick: () => void
}

/**
 * One ordered list for both surfaces: the floating toolbar paints it inline,
 * the right-click menu paints it vertically. Adding or reordering an action
 * here reaches both, so the two entry points cannot drift apart.
 */
export function selectionActions(
  snapshot: SelectionSnapshot,
): readonly SelectionAction[] {
  return [
    ...(linkTarget(snapshot.text, snapshot.anchorHref) === null
      ? []
      : [{ key: 'open' as const, icon: 'external-link' as const, label: t('toolbar.openLink') }]),
    { key: 'copy', icon: 'copy', label: t('toolbar.copy') },
    { key: 'add', icon: 'plus', label: t('toolbar.addToTask') },
    { key: 'side', icon: 'panel-right', label: t('toolbar.askInSide') },
  ]
}
