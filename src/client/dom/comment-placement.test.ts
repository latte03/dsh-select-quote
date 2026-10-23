import { describe, expect, it } from 'vitest'
import { placeCommentSurfaces, type ContentLayer } from './comment-placement.ts'

const bounds = { left: 0, top: 0, right: 1000, bottom: 800 }
const layer: ContentLayer = {
  bounds: () => bounds,
  fromContent: (left, top) => ({ left, top }),
  toContent: (left, top) => ({ left, top }),
}

const toolbar = { width: 200, height: 40 }
const panel = { width: 320, height: 180 }

describe('placeCommentSurfaces', () => {
  it('puts the popover below the selection and the toolbar above the card', () => {
    expect(
      placeCommentSurfaces({
        layer,
        selection: { left: 400, top: 500, selectionBottom: 520, below: false },
        toolbar,
        panel,
      }),
    ).toEqual({
      popover: { left: 400, top: 528 },
      toolbar: { left: 240, top: 482 },
    })
  })

  it('flips the popover above when the selection is low', () => {
    const result = placeCommentSurfaces({
      layer,
      selection: { left: 400, top: 700, selectionBottom: 720, below: true },
      toolbar,
      panel,
    })
    expect(result.popover).toEqual({ left: 400, top: 512 })
  })

  it('clamps a tall popover inside the visible box', () => {
    const result = placeCommentSurfaces({
      layer,
      selection: { left: 400, top: 700, selectionBottom: 720, below: true },
      toolbar,
      panel: { width: 320, height: 780 },
    })
    expect(result.popover.top).toBe(12)
  })

  it('keeps a wide popover centered inside the right edge', () => {
    const result = placeCommentSurfaces({
      layer,
      selection: { left: 980, top: 500, selectionBottom: 520, below: false },
      toolbar,
      panel,
    })
    expect(result.popover.left).toBe(832)
  })

  it('flips the toolbar below the card when the top edge leaves no room', () => {
    const result = placeCommentSurfaces({
      layer,
      selection: { left: 400, top: 0, selectionBottom: 20, below: true },
      toolbar,
      panel,
    })
    expect(result.toolbar.top).toBe(214)
  })
})
