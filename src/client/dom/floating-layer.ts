/**
 * Mount point for the selection UI: a zero-size host inside the transcript's
 * real scroll container.
 *
 * The host is `position: absolute` in **content coordinates**, so floating UI
 * scrolls with the selected text and the scroller clips it at its own edges.
 * That is what keeps the toolbar out of the app header and the composer:
 * clipping happens in the scroller's stacking context instead of competing
 * with the header (which is not positioned and therefore loses to any
 * body-level positioned portal, whatever its z-index).
 *
 * Two host layouts exist in the product:
 * - desktop / overlay composer: `ST7X_W_scrollBody` scrolls; the chat frame is
 *   content-sized and the chat's own `.icaHSq_scroll` is `overflow: visible`;
 * - regular layout: `.icaHSq_scroll` is the scroller.
 * Walking up from the selected flow item finds whichever one is live.
 */

import { flowItemOf } from './message-text.ts'

const HOST_ATTR = 'data-dsq-layer'
/** Below the composer seat (sticky, z-index 7); above in-content stickies (6). */
const HOST_Z = 6

export interface FloatingLayer {
  /** Portal target inside the scroll container. */
  readonly host: HTMLElement
  readonly scroller: HTMLElement
  /** Visible box of the scroller in viewport coordinates. */
  bounds(): DOMRect
  /** Viewport point → content coordinates under `host`. */
  toContent(left: number, top: number): { left: number; top: number }
  /** Content coordinates → viewport point (inverse of `toContent`). */
  fromContent(left: number, top: number): { left: number; top: number }
}

const layers = new WeakMap<HTMLElement, FloatingLayer>()
/** flow item → layer, so scrolling does not re-walk the ancestor chain. */
const itemLayers = new WeakMap<HTMLElement, FloatingLayer>()
let fallback: FloatingLayer | null = null

function contentCoords(scroller: HTMLElement, left: number, top: number) {
  const rect = scroller.getBoundingClientRect()
  return {
    left: left - rect.left - scroller.clientLeft + scroller.scrollLeft,
    top: top - rect.top - scroller.clientTop + scroller.scrollTop,
  }
}

function layerFor(scroller: HTMLElement): FloatingLayer {
  const cached = layers.get(scroller)
  if (cached?.host.isConnected) return cached

  // A containing block inside the scroller is required for absolute children to
  // scroll with the content and be clipped by it. `relative` does not change
  // layout and does not create a stacking context on its own.
  if (getComputedStyle(scroller).position === 'static') scroller.style.position = 'relative'

  let host = scroller.querySelector<HTMLElement>(`:scope > [${HOST_ATTR}]`)
  if (!host) {
    host = document.createElement('div')
    host.setAttribute(HOST_ATTR, '')
    host.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;z-index:${HOST_Z};pointer-events:none;`
    scroller.appendChild(host)
  }

  const layer: FloatingLayer = {
    host,
    scroller,
    bounds: () => {
      const rect = scroller.getBoundingClientRect()
      return new DOMRect(
        rect.left + scroller.clientLeft,
        rect.top + scroller.clientTop,
        scroller.clientWidth,
        scroller.clientHeight,
      )
    },
    toContent: (left, top) => contentCoords(scroller, left, top),
    fromContent: (left, top) => {
      const rect = scroller.getBoundingClientRect()
      return {
        left: left + rect.left + scroller.clientLeft - scroller.scrollLeft,
        top: top + rect.top + scroller.clientTop - scroller.scrollTop,
      }
    },
  }
  layers.set(scroller, layer)
  return layer
}

/** Fallback for hosts whose transcript has no scrollable ancestor. */
function fallbackLayer(): FloatingLayer {
  if (fallback?.host.isConnected) return fallback
  const host = document.createElement('div')
  host.setAttribute(HOST_ATTR, '')
  host.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;z-index:${HOST_Z};pointer-events:none;`
  document.body.appendChild(host)
  fallback = {
    host,
    scroller: document.body,
    bounds: () => new DOMRect(0, 0, window.innerWidth, window.innerHeight),
    toContent: (left, top) => ({ left, top }),
    fromContent: (left, top) => ({ left, top }),
  }
  return fallback
}

/** Layer for a node inside the transcript (falls back to a body host). */
export function floatingLayerFor(node: Node | null): FloatingLayer {
  const item = flowItemOf(node)
  const cached = item ? itemLayers.get(item) : undefined
  if (cached?.host.isConnected) return cached

  let el: HTMLElement | null = item
  while (el && el !== document.body) {
    const { overflowY } = getComputedStyle(el)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      const layer = layerFor(el)
      if (item) itemLayers.set(item, layer)
      return layer
    }
    el = el.parentElement
  }
  const layer = fallbackLayer()
  if (item) itemLayers.set(item, layer)
  return layer
}
