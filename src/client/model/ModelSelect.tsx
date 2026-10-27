/**
 * Model picker matching the Host's composer model seat.
 *
 * Ported from `@deepseek-ai/dsh-client-ui-model-selection`'s `ModelSelect`: the
 * trigger shows model + effort, the menu is the Model / Effort cell pair, each
 * drilling into its own list, and a catalog above four entries gains search
 * with ordered-subsequence ranking. The Host component is internal and client
 * packages cannot be required from a plugin, so the logic and styling live
 * here; the catalog and its projection still come from `ctx.modelDirectories`.
 *
 * One deliberate difference: choosing a model does not switch the conversation
 * route. The side task passes the choice as the child's `agentOptions`, so this
 * component reports through `onChange` and never calls `directory.select()`.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from '../ui/icons.tsx'
import { rankByName } from './rank.ts'
import { hasReleaseTag, type TaggedModel } from './label.ts'
import type {
  ModelChoice,
  ModelDirectoryFace,
  ModelGroup,
  ModelReasoning,
} from './types.ts'

export interface ModelSelectProps {
  readonly directory: ModelDirectoryFace
  /** Chosen override; `null` follows the main conversation's route. */
  readonly value: ModelChoice | null
  readonly onChange: (value: ModelChoice | null) => void
}

type Pane = 'root' | 'model' | 'effort'

/** Unplaced portal menu: laid out at a fixed origin so its size is measurable. */
const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 } as const
const MARGIN = 12
const SEARCH_THRESHOLD = 4

interface ProviderGroup extends ModelGroup {
  readonly displayName: string
}

interface Choice {
  readonly group: ProviderGroup
  readonly model: ProviderGroup['models'][number]
}

/** Account and official providers first; everything else keeps catalog order. */
function orderProviders(groups: readonly ModelGroup[]): readonly ModelGroup[] {
  const rank = (id: string): number =>
    id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2
  return [...groups].sort((left, right) => rank(left.id) - rank(right.id))
}

function sameRoute(left: ModelChoice | null, right: ModelChoice | null): boolean {
  return left?.provider === right?.provider && left?.model === right?.model
}

function effortName(reasoning: ModelReasoning, effort: string | undefined): string | undefined {
  if (effort === undefined) return undefined
  return reasoning.efforts.find((level) => level.id === effort)?.name ?? effort
}

/** Model name in the Host's shape: the official Flash entry carries its release tag. */
function ModelLabel({ providerId, model }: { providerId: string; model: TaggedModel }): ReactNode {
  if (!hasReleaseTag(providerId, model)) return model.name
  return (
    <span className={styles.modelLabel}>
      <span>{model.name}</span>
      <span className={styles.modelTag}>{t('model.releaseBadge')}</span>
    </span>
  )
}

export function ModelSelect({ directory, value, onChange }: ModelSelectProps): ReactNode {
  const state = useSyncExternalStore(
    (listener) => directory.store.subscribe(listener),
    () => directory.store.getSnapshot(),
    () => directory.store.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [selectionFocus, setSelectionFocus] = useState(false)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const groupsRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const paneFocus = useRef<'drill' | 'model' | 'effort' | null>(null)
  const id = useId()

  const groups = useMemo<readonly ProviderGroup[]>(
    () =>
      orderProviders(state.groups).map((group) => ({
        ...group,
        displayName: group.id === 'deepseek-account' ? t('model.providerAccount') : group.name,
      })),
    [state.groups],
  )

  const choices = useMemo<readonly Choice[]>(
    () => groups.flatMap((group) => group.models.map((model) => ({ group, model }))),
    [groups],
  )

  const showSearch = choices.length > SEARCH_THRESHOLD
  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          models: showSearch ? rankByName(group.models, query.trim()) : group.models,
        }))
        .filter((group) => group.models.length > 0),
    [groups, query, showSearch],
  )
  const visibleModels = useMemo(
    () => filteredGroups.flatMap((group) => group.models.map((model) => ({ group, model }))),
    [filteredGroups],
  )

  const currentChoice = useMemo(
    () =>
      value === null
        ? undefined
        : choices.find(
            (choice) =>
              choice.group.id === value.provider && choice.model.id === value.model,
          ),
    [choices, value],
  )
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = value?.reasoningEffort ?? reasoning?.defaultEffort
  const effortLabel =
    currentChoice === undefined || reasoning === undefined
      ? undefined
      : effectiveEffort === undefined
        ? t('model.providerDefault')
        : effortName(reasoning, effectiveEffort)

  const currentVisibleIndex = visibleModels.findIndex(
    (entry) =>
      entry.group.id === value?.provider && entry.model.id === value?.model,
  )
  const activeModelIndex = Math.min(
    highlightedIndex ?? Math.max(0, currentVisibleIndex),
    visibleModels.length - 1,
  )
  const waiting = value !== null && currentChoice === undefined && state.status === 'loading'
  const followLabel = t('model.follow')
  const modelLabel = waiting
    ? t('model.triggerLoading')
    : currentChoice?.model.name ?? (value === null ? followLabel : value.model)
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = waiting
    ? t('model.triggerLoading')
    : value === null
      ? followLabel
      : effortLabel === undefined
        ? t('model.triggerAria', { model: modelLabel })
        : t('model.triggerAriaEffort', { model: modelLabel, effort: effortLabel })

  const reload = useCallback(() => {
    void directory.load().catch(() => {})
  }, [directory])

  // The host refreshes the shared catalog when the menu opens; the store also
  // publishes the startup load, so a failed refresh leaves the old list usable.
  useEffect(() => {
    if (!open) return
    reload()
  }, [open, reload])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    // Capture the whole gesture: the transcript watcher hides its own surfaces
    // on pointerdown, so the picker must settle before that bubble runs.
    document.addEventListener('mousedown', closeOutside, true)
    return () => document.removeEventListener('mousedown', closeOutside, true)
  }, [open])

  const previousShowSearch = useRef(showSearch)
  useEffect(() => {
    const changed = previousShowSearch.current !== showSearch
    previousShowSearch.current = showSearch
    const intent = paneFocus.current ?? (changed && pane === 'model' ? 'drill' : null)
    paneFocus.current = null
    if (!open || intent === null) return
    if (intent === 'drill') {
      if (pane === 'model' && showSearch) {
        searchRef.current?.focus()
        return
      }
      const checked = menuRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"][aria-checked="true"]:not([disabled])',
      )
      const first = itemRefs.current.find((item) => item !== null && !item.disabled)
      ;(checked ?? first ?? triggerRef.current)?.focus()
      return
    }
    const cell = itemRefs.current[intent === 'effort' ? 1 : 0]
    ;(cell !== null && cell !== undefined && !cell.disabled ? cell : triggerRef.current)?.focus()
  }, [open, pane, showSearch])

  useLayoutEffect(() => {
    if (open && pane === 'model' && activeModelIndex >= 0) {
      itemRefs.current[activeModelIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, pane, activeModelIndex, visibleModels])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    const place = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (rect === undefined || menu === null) return
      const height = menu.offsetHeight
      const width = menu.offsetWidth
      let left = rect.right - width
      let top = rect.top - 8 - height
      if (width > 0) left = Math.min(Math.max(left, MARGIN), window.innerWidth - width - MARGIN)
      if (height > 0) top = Math.min(Math.max(top, MARGIN), window.innerHeight - height - MARGIN)
      setMenuPos({ left, top })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const menu = menuRef.current
    const observer = typeof ResizeObserver === 'undefined' || menu === null ? null : new ResizeObserver(place)
    if (menu !== null) observer?.observe(menu)
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, pane, state, query])

  /** Paint group headings only while they are pinned by the scrolled viewport. */
  const pinHeadings = useCallback(() => {
    const viewport = groupsRef.current
    if (!viewport) return
    const top = viewport.getBoundingClientRect().top
    for (const heading of viewport.querySelectorAll<HTMLElement>('[data-dsq-model-group]')) {
      const group = heading.parentElement
      if (!group) continue
      const rect = group.getBoundingClientRect()
      if (rect.top < top && rect.bottom > top) heading.dataset.pinned = ''
      else delete heading.dataset.pinned
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    pinHeadings()
  }, [open, pane, query, filteredGroups, pinHeadings])

  const show = useCallback(() => {
    setSelectionFocus(false)
    triggerRef.current?.focus()
    setQuery('')
    setHighlightedIndex(null)
    if (value === null) paneFocus.current = 'drill'
    setPane(value === null ? 'model' : 'root')
    setOpen(true)
  }, [value])

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    setPane('root')
    if (restoreFocus) {
      queueMicrotask(() => triggerRef.current?.focus())
    }
  }, [])

  const closeAfterSelection = useCallback(() => {
    setSelectionFocus(true)
    close(true)
  }, [close])

  const drill = useCallback((next: Pane) => {
    setQuery('')
    setHighlightedIndex(null)
    paneFocus.current = 'drill'
    setPane(next)
  }, [])

  const back = useCallback((from: Exclude<Pane, 'root'>) => {
    paneFocus.current = from
    setPane('root')
  }, [])

  const changeQuery = useCallback((next: string) => {
    setQuery(next)
    setHighlightedIndex(0)
  }, [])

  const chooseModel = useCallback(
    (choice: Choice) => {
      if (sameRoute(value, { provider: choice.group.id, model: choice.model.id })) {
        closeAfterSelection()
        return
      }
      onChange({ provider: choice.group.id, model: choice.model.id })
      closeAfterSelection()
    },
    [closeAfterSelection, onChange, value],
  )

  const chooseFollow = useCallback(() => {
    onChange(null)
    closeAfterSelection()
  }, [closeAfterSelection, onChange])

  const chooseEffort = useCallback(
    (effort: string | undefined) => {
      if (value === null) return
      if (effectiveEffort === effort) {
        closeAfterSelection()
        return
      }
      onChange({
        provider: value.provider,
        model: value.model,
        ...(effort === undefined ? {} : { reasoningEffort: effort }),
      })
      closeAfterSelection()
    },
    [closeAfterSelection, effectiveEffort, onChange, value],
  )

  const moveFocus = useCallback((offset: number) => {
    const items = itemRefs.current.filter((item) => item !== null)
    if (items.length === 0) return
    const active = items.findIndex((item) => item === document.activeElement)
    const next =
      active === -1
        ? offset > 0
          ? 0
          : items.length - 1
        : (active + offset + items.length) % items.length
    items[next]?.focus()
  }, [])

  const onRootKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        if (pane !== 'root') back(pane)
        else close(true)
        return
      }
      if (!open) return
      if (
        pane === 'model' &&
        showSearch &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      ) {
        event.preventDefault()
        if (visibleModels.length > 0) {
          setHighlightedIndex(
            (activeModelIndex + (event.key === 'ArrowDown' ? 1 : -1) + visibleModels.length) %
              visibleModels.length,
          )
          searchRef.current?.focus()
        }
        return
      }
      if (
        pane === 'model' &&
        showSearch &&
        event.target instanceof HTMLInputElement &&
        (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey))
      ) {
        if (event.key === 'Tab' && visibleModels.length === 0) return
        event.preventDefault()
        const highlighted = visibleModels[activeModelIndex]
        if (highlighted !== undefined) {
          chooseModel({ group: highlighted.group, model: highlighted.model })
        }
        return
      }
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          event.preventDefault()
          if (pane !== 'root') back(pane)
          else close(true)
          return
        }
        const focused = document.activeElement
        const rows = itemRefs.current.filter((item) => item !== null)
        if (focused instanceof HTMLButtonElement && rows.includes(focused)) {
          event.preventDefault()
          focused.click()
          return
        }
        if (focused !== triggerRef.current) return
        event.preventDefault()
        if (pane === 'model' && showSearch) {
          setHighlightedIndex(null)
          searchRef.current?.focus()
          return
        }
        ;(
          menuRef.current?.querySelector<HTMLButtonElement>(
            '[role="menuitemradio"][aria-checked="true"]:not([disabled])',
          ) ?? rows.find((item) => !item.disabled)
        )?.focus()
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveFocus(event.key === 'ArrowDown' ? 1 : -1)
      }
    },
    [activeModelIndex, back, chooseModel, close, moveFocus, open, pane, showSearch, visibleModels],
  )

  const onBlur = useCallback(
    (event: { relatedTarget: Node | null }) => {
      const next = event.relatedTarget
      if (next instanceof Node) {
        if (rootRef.current?.contains(next)) return
        if (menuRef.current?.contains(next)) return
      }
      close()
    },
    [close],
  )

  const effortChoices = useMemo(() => {
    if (reasoning === undefined) return []
    return [
      ...(reasoning.defaultEffort === undefined
        ? [{ key: 'provider-default', effort: undefined, label: t('model.providerDefault') }]
        : []),
      ...reasoning.efforts.map((level) => ({
        key: `effort:${level.id}`,
        effort: level.id as string | undefined,
        label: level.name,
      })),
    ]
  }, [reasoning])

  let itemIndex = 0
  let modelIndex = 0
  itemRefs.current.length = 0
  const itemRef = (): ((node: HTMLButtonElement | null) => void) => {
    const at = itemIndex++
    return (node) => {
      itemRefs.current[at] = node
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.modelSeat}
      onKeyDown={onRootKeyDown}
      onBlur={onBlur}
      onMouseDown={(event) => {
        if (event.target instanceof Element && event.target.closest('button') !== null) {
          event.preventDefault()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.modelTrigger}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        data-selection-focus={selectionFocus ? '' : undefined}
        onBlur={() => setSelectionFocus(false)}
        onClick={() => {
          if (open) close(true)
          else show()
        }}
      >
        <LucideIcon name="database" size={16} className={styles.modelTriggerIcon} />
        <span
          className={styles.modelTriggerLabel}
          data-provider-id={value?.provider}
          data-model-id={value?.model}
        >
          {value === null ? (
            followLabel
          ) : currentChoice === undefined ? (
            modelLabel
          ) : (
            <ModelLabel providerId={currentChoice.group.id} model={currentChoice.model} />
          )}
        </span>
        {effortLabel !== undefined ? (
          <span className={styles.modelTriggerEffort}>{effortLabel}</span>
        ) : null}
        <LucideIcon
          name="chevron-down"
          size={14}
          className={cx(styles.modelChevron, open && styles.modelChevronOpen)}
        />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={`${id}-menu`}
              className={styles.modelMenu}
              style={menuPos ?? MEASURE_STYLE}
              role={pane === 'model' ? 'group' : 'menu'}
              aria-label={t('model.menuAria')}
              aria-busy={state.status === 'loading'}
              data-dsq-menu="true"
            >
              {pane === 'root' ? (
                <>
                  <button
                    ref={itemRef()}
                    type="button"
                    role="menuitem"
                    className={styles.modelCell}
                    onClick={() => drill('model')}
                  >
                    <span className={styles.modelCellLabel}>{t('model.model')}</span>
                    <span className={styles.modelCellValue}>
                      {currentChoice === undefined ? (
                        modelLabel
                      ) : (
                        <ModelLabel
                          providerId={currentChoice.group.id}
                          model={currentChoice.model}
                        />
                      )}
                    </span>
                    <LucideIcon name="chevron-right" size={12} />
                  </button>
                  {reasoning !== undefined ? (
                    <button
                      ref={itemRef()}
                      type="button"
                      role="menuitem"
                      className={styles.modelCell}
                      onClick={() => drill('effort')}
                    >
                      <span className={styles.modelCellLabel}>{t('model.effort')}</span>
                      <span className={styles.modelCellValue}>{effortLabel}</span>
                      <LucideIcon name="chevron-right" size={12} />
                    </button>
                  ) : null}
                </>
              ) : null}

              {pane === 'model' ? (
                <>
                  {showSearch ? (
                    <div className={styles.modelSearchRow}>
                      <input
                        ref={searchRef}
                        type="text"
                        role="searchbox"
                        className={cx(
                          styles.modelSearch,
                          query !== '' && styles.modelSearchWithQuery,
                        )}
                        aria-label={t('model.searchPlaceholder')}
                        aria-controls={`${id}-models`}
                        aria-activedescendant={
                          activeModelIndex < 0 ? undefined : `${id}-model-${activeModelIndex}`
                        }
                        placeholder={t('model.searchPlaceholder')}
                        value={query}
                        onChange={(event) => changeQuery(event.target.value)}
                      />
                      {query !== '' ? (
                        <button
                          type="button"
                          className={styles.modelSearchClear}
                          aria-label={t('model.searchClear')}
                          onClick={() => {
                            changeQuery('')
                            searchRef.current?.focus()
                          }}
                        >
                          <LucideIcon name="x" size={12} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {state.status === 'loading' ? (
                    <div className={styles.modelStatus}>{t('model.statusLoading')}</div>
                  ) : null}
                  {state.error !== null ? (
                    <div className={styles.modelError}>
                      <span>{t('model.errorAction', { message: state.error })}</span>
                      <button type="button" className={styles.modelRetry} onClick={reload}>
                        {t('model.retry')}
                      </button>
                    </div>
                  ) : null}
                  {state.failures.map((failure) => (
                    <div className={styles.modelWarning} key={failure.id}>
                      <span>
                        {t('model.groupLoad', {
                          name:
                            failure.id === 'deepseek-account'
                              ? t('model.providerAccount')
                              : failure.name,
                          message: failure.message,
                        })}
                      </span>
                      <button type="button" className={styles.modelRetry} onClick={reload}>
                        {t('model.retry')}
                      </button>
                    </div>
                  ))}
                  <div
                    ref={groupsRef}
                    id={`${id}-models`}
                    className={cx(styles.modelGroups, 'scrollable')}
                    role="menu"
                    aria-label={t('model.model')}
                    hidden={filteredGroups.length === 0}
                    onScroll={pinHeadings}
                  >
                    <button
                      ref={itemRef()}
                      type="button"
                      role="menuitemradio"
                      aria-checked={value === null}
                      tabIndex={showSearch ? -1 : 0}
                      className={cx(
                        styles.modelOption,
                        value === null && styles.modelSelected,
                      )}
                      onClick={chooseFollow}
                    >
                      <span className={styles.modelOptionCopy}>
                        <span className={styles.modelModelName}>{followLabel}</span>
                      </span>
                      <span className={styles.modelCheck}>
                        {value === null ? <LucideIcon name="check" size={14} /> : null}
                      </span>
                    </button>
                    {filteredGroups.map((group) => (
                      <div className={styles.modelGroup} key={group.id}>
                        <div className={styles.modelGroupLabel} data-dsq-model-group>
                          {group.displayName}
                        </div>
                        {group.models.map((model) => {
                          const index = modelIndex++
                          const selected =
                            value !== null &&
                            value.provider === group.id &&
                            value.model === model.id
                          return (
                            <button
                              ref={itemRef()}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              id={`${id}-model-${index}`}
                              tabIndex={showSearch ? -1 : 0}
                              onFocus={() => setHighlightedIndex(index)}
                              data-highlighted={index === activeModelIndex ? '' : undefined}
                              className={cx(
                                styles.modelOption,
                                styles.modelModelOption,
                                selected && styles.modelSelected,
                                index === activeModelIndex && styles.modelOptionActive,
                              )}
                              onMouseMove={
                                index === activeModelIndex
                                  ? undefined
                                  : () => {
                                      if (showSearch) setHighlightedIndex(index)
                                      else itemRefs.current[index]?.focus()
                                    }
                              }
                              title={model.name}
                              onClick={() => chooseModel({ group, model })}
                              key={model.id}
                            >
                              <span className={styles.modelOptionCopy}>
                                <span
                                  className={styles.modelModelName}
                                  data-provider-id={group.id}
                                  data-model-id={model.id}
                                >
                                  <ModelLabel providerId={group.id} model={model} />
                                </span>
                              </span>
                              <span className={styles.modelCheck}>
                                {selected ? <LucideIcon name="check" size={14} /> : null}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  {state.status === 'ready' && filteredGroups.length === 0 ? (
                    <div className={styles.modelEmpty} role="status">
                      {choices.length === 0 ? t('model.emptyModels') : t('model.searchEmpty')}
                    </div>
                  ) : null}
                </>
              ) : null}

              {pane === 'effort' ? (
                <>
                  {effortChoices.length === 0 ? (
                    <div className={styles.modelEmpty}>{t('model.emptyEfforts')}</div>
                  ) : (
                    effortChoices.map((level) => (
                      <button
                        ref={itemRef()}
                        type="button"
                        role="menuitemradio"
                        aria-checked={effectiveEffort === level.effort}
                        className={cx(
                          styles.modelOption,
                          effectiveEffort === level.effort && styles.modelSelected,
                        )}
                        onClick={() => chooseEffort(level.effort)}
                        key={level.key}
                      >
                        <span className={styles.modelOptionCopy}>
                          <span className={styles.modelModelName}>{level.label}</span>
                        </span>
                        <span className={styles.modelCheck}>
                          {effectiveEffort === level.effort ? (
                            <LucideIcon name="check" size={14} />
                          ) : null}
                        </span>
                      </button>
                    ))
                  )}
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
