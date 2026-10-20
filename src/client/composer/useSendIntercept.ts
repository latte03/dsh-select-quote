import { useEffect, type MutableRefObject } from 'react'
import { composerCardOf, willSubmit } from '../dom/composer-host.ts'
import { composeAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { clearAnnotations, getAnnotations } from '../state/annotation-store.ts'

export interface SendInterceptDeps {
  readonly itemCount: number
  readonly draftRef: MutableRefObject<string>
  readonly setDraft: (text: string) => void
  readonly onFolded: () => void
  /**
   * Set while the composed draft may still be in the editor. The composer
   * half must not treat the block it just wrote as a rewind restore.
   */
  readonly foldingRef?: MutableRefObject<boolean>
}

/**
 * Fold pending annotations into the draft at the send gesture (Enter in the
 * composer, or the primary send button) so the composer's submit path carries
 * the JSON protocol block.
 */
export function useSendIntercept({
  itemCount,
  draftRef,
  setDraft,
  onFolded,
  foldingRef,
}: SendInterceptDeps): void {
  useEffect(() => {
    if (itemCount === 0) return

    const inject = (): void => {
      const current = getAnnotations()
      if (current.length === 0) return
      if (foldingRef !== undefined) foldingRef.current = true
      setDraft(composeAnnotatedMessage(draftRef.current, current))
      clearAnnotations()
      onFolded()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey)
        return
      if (event.isComposing) return
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.isContentEditable) return
      const card = composerCardOf(target)
      if (!card || !willSubmit(card, draftRef.current)) return
      inject()
    }

    const onClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      const card = composerCardOf(target)
      if (!card) return
      const button = target.closest('button')
      if (!button || (button as HTMLButtonElement).disabled) return
      const buttons = card.querySelectorAll('button')
      if (buttons.length === 0 || buttons[buttons.length - 1] !== button) return
      if (button.querySelector('svg rect') !== null) return
      inject()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [itemCount, draftRef, setDraft, onFolded, foldingRef])
}
