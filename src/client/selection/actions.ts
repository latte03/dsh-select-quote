import type { SelectionSnapshot } from '../dom/selection.ts'
import { linkTarget } from '../dom/selection-url.ts'
import { t } from '../i18n.ts'
import type { IconName } from '../ui/icons.tsx'

/** The entry points offered for a selection, whichever surface shows them. */
export type SelectionActionKey =
  | 'open'
  | 'copy'
  | 'translate'
  | 'annotate'
  | 'side'
  /** The Host's own quote cell, painted only inside its merged pill. */
  | 'quote'

/**
 * Where a quoted passage goes after the comment is written.
 *
 * `here` is the default and is not a menu row: the annotation button itself
 * keeps the passage in the conversation being read. The chevron only offers
 * the places that are somewhere else.
 */
export type SelectionDestinationKey = 'target' | 'picker'

/** One row behind an entry's chevron: a destination for the quoted passage. */
export interface SelectionDestination {
  readonly key: SelectionDestinationKey
  readonly label: string
  /** Split label, so the row can accent the session name it points at. */
  readonly labelParts?: readonly SelectionLabelPart[]
}

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
  /**
   * The action is offered but cannot run in this Host.
   *
   * Disabled entries stay in the row instead of disappearing: a button that
   * silently vanishes reads as a missing feature, while a disabled one that
   * explains itself on hover tells the user the capability exists and what is
   * missing. Clicks are ignored; the reason travels in `disabledReason`.
   */
  readonly disabled?: boolean
  /** Tooltip shown on hover while `disabled`. */
  readonly disabledReason?: string
  /**
   * Places this entry can send the passage to, painted behind one chevron.
   *
   * Empty or absent means the entry is a plain button. The main click always
   * means `here` — the current conversation — so the destinations are strictly
   * the "somewhere else" half of the same intent.
   */
  readonly destinations?: readonly SelectionDestination[]
}

/**
 * Cross-session handoff entry. `label` is the menu row that sends the passage
 * to the latched default target (only painted when there is one), `menuLabel`
 * the row that always opens the picker. `available` is false when the host
 * lacks the workspace services or the source session has no workspace and no
 * cwd — then the annotation button has no chevron at all.
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
  /**
   * Runs the entry for one destination. Bound by the coordinator, because only
   * it knows how to write a passage into another session.
   */
  readonly pick?: (destination: SelectionDestinationKey) => void
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
/** Runtime bridges that decide whether an entry point can actually run. */
export interface SelectionActionAvailability {
  /** `runtime.sideTask` is published by the Remote mount. */
  readonly sideTask?: boolean
  /** `runtime.translate` is published by the Remote mount. */
  readonly translate?: boolean
}

export function selectionActions(
  snapshot: SelectionSnapshot,
  handoff?: HandoffActionOptions,
  visibility?: SelectionActionVisibility,
  availability?: SelectionActionAvailability,
): readonly SelectionAction[] {
  const translateDisabled = availability?.translate === false
  const sideDisabled = availability?.sideTask === false
  return [
    ...(linkTarget(snapshot.text, snapshot.anchorHref) === null
      ? []
      : [{ key: 'open' as const, icon: 'external-link' as const, label: t('toolbar.openLink') }]),
    { key: 'copy', icon: 'copy', label: t('toolbar.copy') },
    ...(visibility?.hideTranslate
      ? []
      : [
          {
            key: 'translate' as const,
            icon: 'languages' as const,
            label: t('toolbar.translate'),
            ...(translateDisabled
              ? { disabled: true, disabledReason: t('toolbar.translateUnavailable') }
              : {}),
          },
        ]),
    // Annotation is one intent with two halves: keep the passage in the
    // conversation being read (the main click — nothing is written elsewhere)
    // and send it to a different one (the chevron). Both halves share the same
    // comment, so they share one button and one label.
    {
      key: 'annotate' as const,
      icon: 'plus' as const,
      // The trailing half names where it goes right now; the chevron changes it.
      label: `${t('toolbar.annotate')} ${t('annotate.here')}`,
      labelParts: [
        { text: `${t('toolbar.annotate')} ` },
        { text: t('annotate.here'), accent: true },
      ],
      ...(handoff?.available
        ? {
            destinations: [
              ...(handoff.targetName === undefined
                ? []
                : [
                    {
                      key: 'target' as const,
                      label: handoff.label,
                      labelParts: splitLabelAt(handoff.label, handoff.targetName),
                    },
                  ]),
              { key: 'picker' as const, label: handoff.menuLabel ?? t('handoff.menu') },
            ],
          }
        : {}),
    },
    // A file quoted from the Sidebar preview has no conversation message to
    // fork around, so the side-question entry point stays in the transcript.
    ...(snapshot.surface === 'sidebarFile'
      ? []
      : [
          {
            key: 'side' as const,
            icon: 'panel-right' as const,
            label: t('toolbar.askInSide'),
            ...(sideDisabled
              ? { disabled: true, disabledReason: t('toolbar.sideUnavailable') }
              : {}),
          },
        ]),
  ]
}

/**
 * Expand a composite entry into one menu row per destination.
 *
 * A vertical menu has no room for a chevron, and burying the destinations of
 * the annotation button behind another click would leave 放入 unreachable from
 * the right-click menu. Rows keep both halves one click away, and they are
 * built from the same list the chevron paints.
 */
export function destinationRows(
  action: SelectionActionEntry,
  run: (destination: SelectionDestinationKey) => void,
): readonly SelectionActionEntry[] {
  const destinations = action.destinations
  if (destinations === undefined || destinations.length === 0) return [action]
  return destinations.map((destination) => ({
    key: action.key,
    icon: action.icon,
    label: destination.label,
    ...(destination.labelParts === undefined ? {} : { labelParts: destination.labelParts }),
    ...(action.disabled === true
      ? {
          disabled: true,
          ...(action.disabledReason === undefined
            ? {}
            : { disabledReason: action.disabledReason }),
        }
      : {}),
    onClick: () => run(destination.key),
  }))
}
