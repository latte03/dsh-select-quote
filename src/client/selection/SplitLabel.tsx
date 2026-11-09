/**
 * Label text with the destination name painted in the accent color.
 *
 * `selectionActions()` splits the wording around the target title, so a row can
 * point at which session it means without changing the translated word order
 * (see `splitLabelAt`). Shared by the action row and the menu rows.
 */

import { Fragment, type ReactNode } from 'react'
import { styles } from '../styles.ts'
import type { SelectionLabelPart } from './actions.ts'

export function SplitLabel({ parts }: { parts: readonly SelectionLabelPart[] }): ReactNode {
  return parts.map((part, index) =>
    part.accent === true ? (
      <span key={index} className={styles.handoffTargetName}>
        {part.text}
      </span>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  )
}
