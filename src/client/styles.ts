/**
 * Style entry point for dsh-select-quote.
 *
 * The cascade is the concatenation order below: tokens → atoms → components →
 * host. Each layer lives in `./styles/` so a CSS change touches one file and
 * never re-reads the whole sheet. Layer 2's rules and class names are both
 * generated from one table in `atoms.ts`; `A` is re-exported for callers.
 */

import { atomRules } from './styles/atoms.ts'
import { COMPONENTS_CSS } from './styles/components/index.ts'
import { HOST_CSS } from './styles/host.ts'
import { TOKENS_CSS } from './styles/tokens.ts'

export { A } from './styles/atoms.ts'

/** Join class parts, dropping the falsy ones so a variant can be `cond && A.x`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const CSS = [TOKENS_CSS, atomRules, COMPONENTS_CSS, HOST_CSS].join('\n\n')

const TAG_ID = 'dsh-select-quote/toolbar.css'
/**
 * Install this module's sheet, replacing one an earlier copy of the module left
 * behind.
 *
 * The Host reloads client modules every 500ms while the document stays put, so
 * the tag outlives the code that wrote it: returning early on a found tag froze
 * the page on the first sheet ever injected, and every CSS fix after that one
 * reached nobody until a full reload. Rewriting when the text differs keeps the
 * page on the sheet this code builds.
 */
export function ensureToolbarStyles(): void {
  if (typeof document === 'undefined') return
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${TAG_ID}"]`)
  if (existing !== null) {
    if (existing.textContent !== CSS) existing.textContent = CSS
    return
  }
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-select-quote'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

export const styles = {
  toolbar: 'dsq_toolbar',
  toolbarInner: 'dsq_toolbarInner',
  hostPill: 'dsq_hostPill',
  button: 'dsq_button',
  buttonCompact: 'dsq_buttonCompact',
  iconCell: 'dsq_iconCell',
  tip: 'dsq_tip',
  buttonAddComment: 'dsq_buttonAddComment',
  kbd: 'dsq_kbd',
  divider: 'dsq_divider',
  status: 'dsq_status',
  statusIcon: 'dsq_statusIcon',
  ctxMenu: 'dsq_ctxMenu',
  ctxItem: 'dsq_ctxItem',
  modelSeat: 'dsq_modelSeat',
  modelTrigger: 'dsq_modelTrigger',
  modelTriggerIcon: 'dsq_modelTriggerIcon',
  modelTriggerLabel: 'dsq_modelTriggerLabel',
  modelTriggerEffort: 'dsq_modelTriggerEffort',
  modelChevron: 'dsq_modelChevron',
  modelChevronOpen: 'dsq_modelChevronOpen',
  modelMenu: 'dsq_modelMenu',
  modelCell: 'dsq_modelCell',
  modelCellLabel: 'dsq_modelCellLabel',
  modelCellValue: 'dsq_modelCellValue',
  modelSearchRow: 'dsq_modelSearchRow',
  modelSearch: 'dsq_modelSearch',
  modelSearchWithQuery: 'dsq_modelSearchWithQuery',
  modelSearchClear: 'dsq_modelSearchClear',
  modelStatus: 'dsq_modelStatus',
  modelEmpty: 'dsq_modelEmpty',
  modelError: 'dsq_modelError',
  modelWarning: 'dsq_modelWarning',
  modelRetry: 'dsq_modelRetry',
  modelGroups: 'dsq_modelGroups',
  modelGroup: 'dsq_modelGroup',
  modelGroupLabel: 'dsq_modelGroupLabel',
  modelOption: 'dsq_modelOption',
  modelModelOption: 'dsq_modelModelOption',
  modelOptionActive: 'dsq_modelOptionActive',
  modelSelected: 'dsq_modelSelected',
  modelOptionCopy: 'dsq_modelOptionCopy',
  modelModelName: 'dsq_modelModelName',
  modelLabel: 'dsq_modelLabel',
  modelTag: 'dsq_modelTag',
  modelCheck: 'dsq_modelCheck',
  cardStack: 'dsq_cardStack',
  cardClose: 'dsq_cardClose',
  cardPad: 'dsq_cardPad',
  summary: 'dsq_summary',
  summaryIcon: 'dsq_summaryIcon',
  summaryBody: 'dsq_summaryBody',
  summaryTitle: 'dsq_summaryTitle',
  summaryHint: 'dsq_summaryHint',
  summaryHintPointer: 'dsq_summaryHintPointer',
  summaryHintTouch: 'dsq_summaryHintTouch',
  summaryHover: 'dsq_summaryHover',
  summaryHoverLeaving: 'dsq_summaryHoverLeaving',
  summaryItem: 'dsq_summaryItem',
  summaryItemLabel: 'dsq_summaryItemLabel',
  summaryItemText: 'dsq_summaryItemText',
  summaryItemBadge: 'dsq_summaryItemBadge',
  summaryItemMain: 'dsq_summaryItemMain',
  summaryItemHead: 'dsq_summaryItemHead',
  summaryItemTextEdit: 'dsq_summaryItemTextEdit',
  annEditInput: 'dsq_annEditInput',
  annEditActions: 'dsq_annEditActions',
  annEditCancel: 'dsq_annEditCancel',
  annEditSave: 'dsq_annEditSave',
  summaryHoverInner: 'dsq_summaryHoverInner',
  summaryList: 'dsq_summaryList',
  summaryItemButton: 'dsq_summaryItemButton',
  summaryHoverOpen: 'dsq_summaryHoverOpen',
  summaryItemActions: 'dsq_summaryItemActions',
  summaryItemAction: 'dsq_summaryItemAction',
  annDirective: 'dsq_annDirective',
  annAnchor: 'dsq_annAnchor',
  annMark: 'dsq_annMark',
  annBadge: 'dsq_annBadge',
  annMarkFlash: 'dsq_annMarkFlash',
  annMessageFlash: 'dsq_annMessageFlash',
  handoffRow: 'dsq_handoffRow',
  handoffRowHead: 'dsq_handoffRowHead',
  targetPicker: 'dsq_targetPicker',
  targetHead: 'dsq_targetHead',
  targetHeading: 'dsq_targetHeading',
  targetSearchRow: 'dsq_targetSearchRow',
  targetSearch: 'dsq_targetSearch',
  targetList: 'dsq_targetList',
  targetGroupLabel: 'dsq_targetGroupLabel',
  targetOption: 'dsq_targetOption',
  targetOptionMain: 'dsq_targetOptionMain',
  targetTitleMain: 'dsq_targetTitleMain',
  targetMeta: 'dsq_targetMeta',
  targetNew: 'dsq_targetNew',
  targetTime: 'dsq_targetTime',
  targetEmpty: 'dsq_targetEmpty',
  handoffChevron: 'dsq_handoffChevron',
  handoffTargetName: 'dsq_handoffTargetName',
  handoffChip: 'dsq_handoffChip',
  handoffChipTitle: 'dsq_handoffChipTitle',
  handoffChipLabel: 'dsq_handoffChipLabel',
  handoffChange: 'dsq_handoffChange',
  handoffHint: 'dsq_handoffHint',
  handoffError: 'dsq_handoffError',
  originLink: 'dsq_originLink',
  toast: 'dsq_toast',
  commentPop: 'dsq_commentPop',
  commentPopSide: 'dsq_commentPopSide',
  commentPopTranslate: 'dsq_commentPopTranslate',
  translateQuote: 'dsq_translateQuote',
  translateHead: 'dsq_translateHead',
  translateTargetLabel: 'dsq_translateTargetLabel',
  translateClose: 'dsq_translateClose',
  translateCopy: 'dsq_translateCopy',
  translateBody: 'dsq_translateBody',
  translateText: 'dsq_translateText',
  translateHint: 'dsq_translateHint',
  translateLoading: 'dsq_translateLoading',
  progressGrid: 'dsq_progressGrid',
  progressCell: 'dsq_progressCell',
  translateShimmer: 'dsq_translateShimmer',
  translateCaret: 'dsq_translateCaret',
  translateError: 'dsq_translateError',
  translateReasoning: 'dsq_translateReasoning',
  translateReasoningSummary: 'dsq_translateReasoningSummary',
  translateReasoningChevron: 'dsq_translateReasoningChevron',
  translateReasoningText: 'dsq_translateReasoningText',
  translateReasoningLive: 'dsq_translateReasoningLive',
  translateActions: 'dsq_translateActions',
  langSeat: 'dsq_langSeat',
  langTrigger: 'dsq_langTrigger',
  langChevron: 'dsq_langChevron',
  langChevronOpen: 'dsq_langChevronOpen',
  langMenu: 'dsq_langMenu',
  langOption: 'dsq_langOption',
  langOptionActive: 'dsq_langOptionActive',
  langCheck: 'dsq_langCheck',
  commentInput: 'dsq_commentInput',
  commentActions: 'dsq_commentActions',
  sideQuote: 'dsq_sideQuote',
  sideQuoteText: 'dsq_sideQuoteText',
  sideFooter: 'dsq_sideFooter',
  chipPreview: 'dsq_chipPreview',
  chipPreviewBody: 'dsq_chipPreviewBody',
  chipPreviewLeaving: 'dsq_chipPreviewLeaving',
  chipPreviewHead: 'dsq_chipPreviewHead',
  chipPreviewTitle: 'dsq_chipPreviewTitle',
  chipPreviewLabel: 'dsq_chipPreviewLabel',
  chipPreviewQuote: 'dsq_chipPreviewQuote',
  chipPreviewComment: 'dsq_chipPreviewComment',
  chipPreviewActions: 'dsq_chipPreviewActions',
  chipPreviewAction: 'dsq_chipPreviewAction',
  deleteConfirm: 'dsq_deleteConfirm',
  deleteConfirmInner: 'dsq_deleteConfirmInner',
  deleteConfirmLabel: 'dsq_deleteConfirmLabel',
  touchBar: 'dsq_touchBar',
  touchAction: 'dsq_touchAction',
  touchScrim: 'dsq_touchScrim',
  touchSheet: 'dsq_touchSheet',
  touchSheetHead: 'dsq_touchSheetHead',
  touchSheetTitle: 'dsq_touchSheetTitle',
  touchSheetClose: 'dsq_touchSheetClose',
  touchQuote: 'dsq_touchQuote',
  touchComment: 'dsq_touchComment',
  touchActions: 'dsq_touchActions',
  touchSecondary: 'dsq_touchSecondary',
  touchStatus: 'dsq_touchStatus',
  tSummary: 'dsq_tSummary',
  userRow: 'dsq_userRow',
  userStack: 'dsq_userStack',
  userImages: 'dsq_userImages',
  userBubble: 'dsq_userBubble',
  settings: 'dsq_settings',
  settingsSection: 'dsq_settingsSection',
  settingsCopy: 'dsq_settingsCopy',
  settingsLabel: 'dsq_settingsLabel',
  settingsHint: 'dsq_settingsHint',
  settingsSelect: 'dsq_settingsSelect',
  settingsModel: 'dsq_settingsModel',
  settingsField: 'dsq_settingsField',
  settingsInput: 'dsq_settingsInput',
  settingsShortcuts: 'dsq_settingsShortcuts',
  settingsShortcutRow: 'dsq_settingsShortcutRow',
  settingsShortcutName: 'dsq_settingsShortcutName',
  settingsShortcutKeys: 'dsq_settingsShortcutKeys',
  keycap: 'dsq_keycap',
  settingsDivider: 'dsq_settingsDivider',
  settingsNotice: 'dsq_settingsNotice',
  tabsStrip: 'dsq_tabsStrip',
  tabIndicator: 'dsq_tabIndicator',
  tab: 'dsq_tab',
  group: 'dsq_group',
  settingsSwitchRow: 'dsq_settingsSwitchRow',
  switch: 'dsq_switch',
  switchTrack: 'dsq_switchTrack',
  seg: 'dsq_seg',
  segThumb: 'dsq_segThumb',
  segOption: 'dsq_segOption',
  srOnly: 'dsq_srOnly',
} as const
