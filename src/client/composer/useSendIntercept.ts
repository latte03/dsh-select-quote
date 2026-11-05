import { useEffect, type MutableRefObject } from 'react'
import { composerCardOf, isSubmitKey, willSubmit } from '../dom/composer-host.ts'
import { composeAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { clearAnnotations, getAnnotations } from '../state/annotation-store.ts'
import { writeDraft, type InputActionsFace } from './draft-write.ts'

export interface SendInterceptDeps {
  readonly itemCount: number
  readonly draftRef: MutableRefObject<string>
  /** Rewrites the draft in place where the host supports it (see `draft-write`). */
  readonly actionsRef: MutableRefObject<InputActionsFace>
  /** Stamps the fold as a self-write so it is not read back as a rewind. */
  readonly onSelfWrite: () => void
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
  actionsRef,
  onSelfWrite,
  onFolded,
  foldingRef,
}: SendInterceptDeps): void {
  useEffect(() => {
    if (itemCount === 0) return

    const inject = (): void => {
      const current = getAnnotations()
      if (current.length === 0) return
      if (foldingRef !== undefined) foldingRef.current = true
      onSelfWrite()
      // In-place rewrite keeps the user's own quote nodes; the folded text is
      // read by the composer's own submit path immediately after this.
      writeDraft(
        actionsRef.current,
        composeAnnotatedMessage(draftRef.current, current),
        draftRef.current,
      )
      // Cross-session records stay (state becomes `sent`) while the target
      // list clears; a plain clear would delete the source's arrow mark.
      clearAnnotations(undefined, 'sent')
      onFolded()
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isSubmitKey(event)) return
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
  }, [itemCount, draftRef, actionsRef, onSelfWrite, onFolded, foldingRef])
}
