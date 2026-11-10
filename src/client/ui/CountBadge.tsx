/**
 * The annotation card's count tile.
 *
 * Split in two on purpose:
 *
 * - `CountTile` is the pure view — count, direction, mode in, markup out. No
 *   store, no hooks, so `renderToStaticMarkup` can pin both looks.
 * - `CountBadge` is the one line that reads the setting, so a mode change
 *   repaints this tile and nothing else in the card.
 *
 * Everything that decides *whether* it moves lives outside: `CountDirection`
 * comes from `summary-count.ts`, the mode from the settings. The tile itself is
 * the same 32×32 in both modes.
 */
import type { ReactNode } from 'react'
import { A, cx, styles } from '../styles.ts'
import { useConfig } from '../useConfig.ts'
import type { CountAnimation } from '../config.ts'
import { boldPixelCells, fitPixelCount, pixelCountOf, pixelCountPath } from './pixel-count.ts'
import type { CountDirection } from './summary-count.ts'
import { waveDelayA, waveDelayB } from './loading-dots.ts'

/**
 * Room the dots get inside the tile, leaving a 5px margin on the sides and 7px
 * top and bottom. Sized for the common case (one or two digits) and allowed to
 * shrink for `99+` rather than overflow.
 */
const DOT_BOX = { width: 22, height: 18 } as const

/** Markup for one tile state. Pure: same props, same string. */
export function CountTile({
  count,
  dir,
  animation,
  loading = false,
}: {
  readonly count: number
  readonly dir: CountDirection | null
  readonly animation: CountAnimation
  /** The turn is being answered: a dot wave runs behind the count. */
  readonly loading?: boolean
}): ReactNode {
  const text = String(count)
  const pixels = animation === 'dots' ? pixelCountOf(text) : null
  const box = pixels === null ? null : fitPixelCount(pixels, DOT_BOX)
  // Running: the same grid, drawn as cells so the wave can run through it.
  const cells = loading && pixels !== null ? boldPixelCells(pixels) : null
  return (
    <div
      className={cx(A.keep, A.gridMid, styles.summaryIcon)}
      aria-hidden="true"
      /* `none` is not a slower animation, it is the absence of one: dropping the
         attribute is what keeps the tile still — the CSS never asks the setting. */
      data-dir={animation === 'none' || dir === null ? undefined : dir}
      data-loading={loading ? '' : undefined}
    >

      {pixels === null || box === null ? (
        <span className={styles.summaryCount}>{text}</span>
      ) : (
        <svg
          className={styles.summaryPixels}
          viewBox={`0 0 ${pixels.cols} ${pixels.rows}`}
          width={box.width}
          height={box.height}
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          {cells === null ? (
            <path d={pixelCountPath(pixels)} />
          ) : (
            /* Two layers over one grid: where the two foci overlap the dot is
               brightest. The floor keeps the number readable while it pulses. */
            [0, 1].map((layer) => (
              <g key={layer}>
                {cells.map((cell) => (
                  <circle
                    key={`${layer}-${cell.x}-${cell.y}`}
                    cx={cell.x + 0.5}
                    cy={cell.y + 0.5}
                    r={0.36}
                    style={{
                      animationDelay: `${(layer === 0 ? waveDelayA(cell) : waveDelayB(cell))}ms`,
                    }}
                  />
                ))}
              </g>
            ))
          )}
        </svg>
      )}
    </div>
  )
}

/** The tile bound to the live setting. Keyed by the count so it remounts. */
export function CountBadge({
  count,
  dir,
  running = false,
}: {
  readonly count: number
  readonly dir: CountDirection | null
  /** The turn is being answered; the composer never passes this. */
  readonly running?: boolean
}): ReactNode {
  const { countAnimation } = useConfig()
  // The wave belongs to the dot grid: a `subtle` tile keeps its plain number and
  // says nothing about the run.
  const loading = countAnimation === 'dots' && running
  return <CountTile count={count} dir={dir} animation={countAnimation} loading={loading} />
}
