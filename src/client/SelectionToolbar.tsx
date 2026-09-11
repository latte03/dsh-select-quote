import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { createPortal } from 'react-dom'
import { saveQuote } from './quote-store.ts'
import {
  clearNativeSelection,
  copyText,
  focusComposer,
  readSelectionSnapshot,
  type SelectionSnapshot,
} from './selection.ts'
import { ensureToolbarStyles, styles } from './styles.ts'

export interface InputActionsLike {
  setDraft(text: string): void
}

export interface SelectionToolbarProps {
  useInput: <T>(
    selector: (state: {
      draft: string
      draftRev: number
      occurrences: readonly { offset: number; length: number }[]
    }) => T,
  ) => T
  inputActions: InputActionsLike
  sessionId?: string
}

export function SelectionToolbar({ sessionId }: SelectionToolbarProps): ReactNode {
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState<SelectionSnapshot | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const sessionRef = useRef(sessionId)
  sessionRef.current = sessionId

  useEffect(() => {
    ensureToolbarStyles()
  }, [])

  const hide = useCallback(() => {
    setActive(null)
    setStatus(null)
  }, [])

  const refresh = useCallback(() => {
    const next = readSelectionSnapshot(toolbarRef.current)
    setActive((prev) => {
      if (!next) return null
      if (prev && prev.text === next.text && prev.left === next.left && prev.top === next.top) {
        return prev
      }
      return next
    })
  }, [])

  useEffect(() => {
    const schedule = () => {
      window.setTimeout(refresh, 0)
    }

    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (toolbarRef.current?.contains(target)) return
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        schedule()
        return
      }
      hide()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', schedule, true)
    document.addEventListener('keyup', schedule, true)
    window.addEventListener('resize', hide)
    document.addEventListener('scroll', hide, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', schedule, true)
      document.removeEventListener('keyup', schedule, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('scroll', hide, true)
    }
  }, [hide, refresh])

  const handleToolbarPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleCopy = useCallback(async () => {
    const snapshot = active
    if (!snapshot) return
    try {
      await copyText(snapshot.text)
      clearNativeSelection()
      // Close the floating menu immediately after a successful copy.
      setActive(null)
      setStatus(null)
    } catch {
      setStatus('复制失败')
    }
  }, [active])

  const handleAddToTask = useCallback(() => {
    const snapshot = active
    if (!snapshot) return
    const sid = sessionRef.current
    if (!sid) {
      setStatus('会话未就绪')
      return
    }

    // The card is the only in-composer representation of the selection; the
    // `>` blockquote is folded into the draft at the send gesture instead.
    saveQuote(sid, snapshot.text)

    clearNativeSelection()
    setActive(null)
    setStatus(null)
    window.setTimeout(focusComposer, 16)
  }, [active])

  if (!active) return null

  const toolbarStyle: CSSProperties = {
    left: active.left,
    top: active.top,
  }

  return createPortal(
    jsxs(Fragment, {
      children: [
        jsx('div', {
          ref: toolbarRef,
          className: styles.toolbar,
          style: toolbarStyle,
          role: 'toolbar',
          'aria-label': '划词操作',
          'data-dsq-toolbar': 'true',
          onPointerDown: handleToolbarPointerDown,
          children: jsxs('div', {
            style: { display: 'inline-flex', alignItems: 'center', gap: 2 },
            children: [
              jsx('button', {
                type: 'button',
                className: styles.button,
                onClick: () => void handleCopy(),
                children: '复制',
              }),
              jsx('span', { className: styles.divider, 'aria-hidden': true }),
              jsx('button', {
                type: 'button',
                className: styles.button,
                onClick: handleAddToTask,
                children: '添加到任务',
              }),
            ],
          }),
        }),
        status
          ? jsx('div', {
              className: styles.status,
              style: toolbarStyle,
              role: 'status',
              children: status,
            })
          : null,
      ],
    }),
    document.body,
  )
}
