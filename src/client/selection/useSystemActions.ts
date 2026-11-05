/**
 * Selection hand-offs to the system: clipboard and the external browser. Both
 * are "take the latched quote, hand it to the OS, then dismiss", so they share
 * one module; a failure leaves the calling surface in place.
 */

import { useCallback } from 'react'
import { linkTarget } from '../dom/selection-url.ts'
import { clearNativeSelection, copyText, type SelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'

export interface SystemActionsInput {
  readonly hide: () => void
  readonly setStatus: (value: string | null) => void
}

export function useSystemActions({ hide, setStatus }: SystemActionsInput) {
  const copy = useCallback(
    async (snapshot: SelectionSnapshot) => {
      try {
        await copyText(snapshot.text)
        clearNativeSelection()
        hide()
      } catch {
        setStatus(t('toolbar.copyFailed'))
      }
    },
    [hide, setStatus],
  )

  /**
   * Hand the selected link to the system browser.
   *
   * `window.open` deliberately bypasses the host's in-app sidebar browser: the
   * desktop shell's window-open handler sends http(s) straight to
   * `shell.openExternal`, so the page never renders inside the client (loading
   * arbitrary URLs there is what wedges it). Only http(s) selections get this
   * button — every other scheme is refused by that handler.
   */
  const openLink = useCallback(
    (snapshot: SelectionSnapshot) => {
      const url = linkTarget(snapshot.text, snapshot.anchorHref)
      if (!url) return
      window.open(url, '_blank', 'noopener,noreferrer')
      clearNativeSelection()
      hide()
    },
    [hide],
  )

  return { copy, openLink }
}
