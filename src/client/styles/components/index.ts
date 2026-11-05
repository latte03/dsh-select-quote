/**
 * Layer 3 composition. Module order is cascade order: do not reorder.
 */
import { SELECTION_CSS } from './selection.ts'
import { MODEL_CSS } from './model.ts'
import { ANNOTATIONS_CSS } from './annotations.ts'
import { COMPOSER_CSS } from './composer.ts'
import { PREVIEW_CSS } from './preview.ts'
import { HANDOFF_CSS } from './handoff.ts'
import { A11Y_CSS } from './a11y.ts'
import { SETTINGS_CSS } from './settings.ts'

export const COMPONENTS_CSS = [SELECTION_CSS, MODEL_CSS, ANNOTATIONS_CSS, COMPOSER_CSS, PREVIEW_CSS, HANDOFF_CSS, A11Y_CSS, SETTINGS_CSS].join('\n\n')
