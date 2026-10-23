/**
 * Geometry for the comment step: the popover below the selected text, and the
 * toolbar that moves out of its way.
 *
 * Coordinates in, coordinates out — the caller owns measuring and painting.
 * Keeping this separate from the React component lets the flip/clamp rules be
 * unit-tested without a layout engine.
 */

export interface PlacementBox {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface PlacementPoint {
  readonly left: number
  readonly top: number
}

/** The coordinate conversions the transcript layer provides. */
export interface ContentLayer {
  bounds(): PlacementBox
  toContent(left: number, top: number): PlacementPoint
  fromContent(left: number, top: number): PlacementPoint
}

export interface CommentSelection {
  readonly left: number
  readonly top: number
  readonly selectionBottom: number
  /** Toolbar renders below the first line instead of above it. */
  readonly below: boolean
}

export interface CommentPlacementInput {
  readonly layer: ContentLayer
  readonly selection: CommentSelection
  readonly toolbar: { readonly width: number; readonly height: number }
  readonly panel: { readonly width: number; readonly height: number }
}

export interface CommentPlacement {
  readonly popover: PlacementPoint
  readonly toolbar: PlacementPoint
}

const GAP = 8
/** Horizontal slack around the popover, and the minimum margin to the box. */
const EDGE = 8
/** Gap between the popover corner and the "add a comment" toolbar. */
const TOOLBAR_GAP = 6

export function placeCommentSurfaces({
  layer,
  selection,
  toolbar,
  panel,
}: CommentPlacementInput): CommentPlacement {
  const bounds = layer.bounds()
  const home = layer.fromContent(selection.left, selection.top)
  const anchor = {
    left: home.left - toolbar.width / 2,
    top: home.top - (selection.below ? 0 : toolbar.height),
    width: toolbar.width,
    height: toolbar.height,
  }

  // Prefer below the selected text, not below the toolbar: the toolbar sits
  // only 12px above the first line, so anchoring here would cover the words
  // being commented on. When the selection is too low, go above the toolbar
  // instead — never over the selection.
  const belowTop = layer.fromContent(0, selection.selectionBottom).top + GAP
  const aboveTop = anchor.top - panel.height - GAP
  const top =
    belowTop <= bounds.bottom - EDGE - panel.height
      ? belowTop
      : aboveTop >= bounds.top + EDGE
        ? aboveTop
        : Math.max(
            bounds.top + EDGE,
            Math.min(belowTop, bounds.bottom - EDGE - panel.height),
          )

  const half = panel.width / 2 + EDGE
  const min = bounds.left + half
  const center = Math.min(
    Math.max(anchor.left + anchor.width / 2, min),
    Math.max(min, bounds.right - half),
  )
  const popover = layer.toContent(center, top)

  // The hint toolbar sits above the popover's top-left corner: left edges
  // aligned, 6px clear of the card. Flip below the card only when the top of
  // the scroller leaves no room.
  const popCenter = layer.fromContent(popover.left, popover.top)
  const popLeftView = popCenter.left - panel.width / 2
  let leftView = popLeftView
  let topView = top - TOOLBAR_GAP - toolbar.height
  if (topView < bounds.top + EDGE) topView = top + panel.height + TOOLBAR_GAP
  leftView = Math.max(
    bounds.left + EDGE,
    Math.min(leftView, bounds.right - EDGE - toolbar.width),
  )
  topView = Math.max(
    bounds.top + EDGE,
    Math.min(topView, bounds.bottom - EDGE - toolbar.height),
  )

  return { popover, toolbar: layer.toContent(leftView, topView) }
}
