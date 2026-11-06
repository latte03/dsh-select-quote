/**
 * Layer 4 — host surface: keyframes, theme flips, and the few rules that
 * reach into product DOM. Everything here depends on host structure.
 */
export const HOST_CSS = `
/* Layer 4 — host surface: keyframes, theme flips, and the two rules that reach
   into product-owned DOM. */

@keyframes dsq-ann-flash {
  0% {
    background: var(--dsq-mark-color);
    color: #fff;
    box-shadow: 0 0 0 3px var(--dsq-mark-tint);
  }
  100% {
    background: var(--dsq-mark-tint);
    color: inherit;
    box-shadow: 0 0 0 0 transparent;
  }
}

/* The product flips its palette on body[data-ds-dark-theme], and every
   --dsq-* alias follows it. Only values we own ourselves need restating. */
body[data-ds-dark-theme] .dsq_annMark {
  --dsq-mark-tint: var(--dsq-accent-tint-dark);
  --dsq-mark-hover: var(--dsw-static-blue-800, #1e40af);
}

/* Reserve room for the floating annotation summary inside the composer card, so the
   attachment rail and the editor flow below them instead of being covered. */
.dsq_cardPad {
  padding-top: var(--dsq-quote-pad, 88px) !important;
}

/* The Host markdown renderer makes every image block-level (chat images and
   screenshots need that), which turns this project's linked README badges into
   one badge per line. Scope the inline override to exactly these badge URLs;
   every other markdown image keeps the Host's block layout. The two-attribute
   forms also tolerate the parser percent-encoding the destination. */
img[src*="dshopen.org"][src*="dsh-select-quote"],
img[src*="awesome-dsh-plugin.com/badge"],
img[src*="img.shields.io/npm/"][src*="dsh-select-quote"],
img[src*="img.shields.io/badge/DSH-"],
img[src*="cdn.dsh.so/badge/dsh-select-quote"] {
  display: inline-block;
  margin: 0 4px 2px 0;
  vertical-align: middle;
}
`
