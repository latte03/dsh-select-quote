/**
 * Inline lucide icons (lucide.dev) — shapes copied verbatim from the lucide
 * source, ISC licensed. No network fetch; strokes inherit currentColor.
 */
import type { ReactNode } from 'react'

const SVG_ATTRS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export type IconName = 'copy' | 'pencil' | 'trash-2' | 'x' | 'plus' | 'external-link'

const SHAPES: Record<IconName, ReactNode> = {
  copy: (
    <g>
      <rect width={14} height={14} x={8} y={8} rx={2} ry={2} />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </g>
  ),
  pencil: (
    <g>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </g>
  ),
  'trash-2': (
    <g>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </g>
  ),
  x: (
    <g>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </g>
  ),
  plus: (
    <g>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </g>
  ),
  'external-link': (
    <g>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </g>
  ),
}

export function LucideIcon({ name, size = 15 }: { name: IconName; size?: number }): ReactNode {
  return (
    <svg {...SVG_ATTRS} width={size} height={size}>
      {SHAPES[name]}
    </svg>
  )
}
