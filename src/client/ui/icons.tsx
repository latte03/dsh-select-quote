/**
 * Inline lucide icons (lucide.dev) — shapes copied verbatim from the lucide
 * source, ISC licensed. No network fetch; strokes inherit currentColor.
 */
import type { ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

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
  copy: jsxs('g', {
    children: [
      jsx('rect', { key: 'r', width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 }),
      jsx('path', { key: 'p', d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }),
    ],
  }),
  pencil: jsxs('g', {
    children: [
      jsx('path', {
        key: 'p1',
        d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
      }),
      jsx('path', { key: 'p2', d: 'm15 5 4 4' }),
    ],
  }),
  'trash-2': jsxs('g', {
    children: [
      jsx('path', { key: 'p1', d: 'M10 11v6' }),
      jsx('path', { key: 'p2', d: 'M14 11v6' }),
      jsx('path', { key: 'p3', d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
      jsx('path', { key: 'p4', d: 'M3 6h18' }),
      jsx('path', { key: 'p5', d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
    ],
  }),
  x: jsxs('g', {
    children: [
      jsx('path', { key: 'p1', d: 'M18 6 6 18' }),
      jsx('path', { key: 'p2', d: 'm6 6 12 12' }),
    ],
  }),
  plus: jsxs('g', {
    children: [
      jsx('path', { key: 'p1', d: 'M5 12h14' }),
      jsx('path', { key: 'p2', d: 'M12 5v14' }),
    ],
  }),
  'external-link': jsxs('g', {
    children: [
      jsx('path', {
        key: 'p1',
        d: 'M15 3h6v6',
      }),
      jsx('path', { key: 'p2', d: 'M10 14 21 3' }),
      jsx('path', { key: 'p3', d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
    ],
  }),
}

export function LucideIcon({ name, size = 15 }: { name: IconName; size?: number }): ReactNode {
  return jsx('svg', { ...SVG_ATTRS, width: size, height: size, children: SHAPES[name] })
}
