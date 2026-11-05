/**
 * Layer 1 — product design tokens, aliased once with their fallbacks.
 *
 * Owned by this module so the rest of the styles never repeat a --dsw-* value.
 */
export const TOKENS_CSS = `
/* Layer 1 — tokens. Every product token this plugin reads is aliased here once,
   with the fallback it used to repeat inline at each use site. Scoped to \`body\`,
   not \`:root\`: the product flips its palette on body[data-ds-dark-theme], so an
   alias computed on the root element would freeze the light values and inherit
   them into the dark page. */
body {
  --dsq-chat-width: var(--dsh-chat-content-width, 748px);
  --dsq-font-size: var(--dsh-content-font-size, 14px);
  --dsq-font-delta: var(--dsh-content-font-delta, 0px);
  --dsq-bg-raised: var(--dsw-alias-bg-layer-1, #fff);
  /* Toast pill. The product token that used to back this (bg-layer-3) is plain
     white in dsh 0.2.2 while the label inverted token is white too — a white
     pill with white text. Pair two tokens that are guaranteed to be each
     other's inverse instead: primary label as the surface, raised surface as
     the ink. Light theme gives dark-on-light, dark theme flips with it. */
  --dsq-toast-bg: var(--dsq-bg-raised);
  --dsq-toast-fg: var(--dsq-label);
  --dsq-toast-line: var(--dsq-line);
  /* The settings switch mirrors the Host's own switch: neutral track when off,
     brand fill when on, and a thumb that inverts with the theme. */
  --dsq-switch-off: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.12));
  --dsq-switch-on: var(--dsw-alias-brand-primary, #0f1115);
  --dsq-switch-thumb-off: var(--dsw-alias-switch-thumb, #fff);
  --dsq-switch-thumb-on: var(--dsw-alias-label-primary-foreground, #fff);
  --dsq-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  --dsq-line-divider: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.12));
  --dsq-focus-ring: var(--dsw-alias-button-primary-fill, #1677ff);
  --dsq-focus-ring-soft: color-mix(in srgb, var(--dsq-accent) 50%, transparent);
  --dsq-fill-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  --dsq-label: var(--dsw-alias-label-primary, rgba(0, 0, 0, 0.88));
  --dsq-label-inverted: var(--dsw-alias-label-primary-inverted, #fff);
  --dsq-label-2: var(--dsw-alias-label-secondary, rgba(0, 0, 0, 0.65));
  --dsq-label-3: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, 0.45));
  --dsq-link: var(--dsw-alias-link, rgba(0, 0, 0, 0.65));
  --dsq-bubble: var(--dsw-specific-bubble, rgba(0, 0, 0, 0.05));
  --dsq-menu: var(--dsw-menu-surface-fill, rgba(248, 249, 250, .58));
  --dsq-menu-backdrop: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  --dsq-scrim: rgba(0, 0, 0, 0.32);
  --dsq-accent-400: var(--dsw-static-blue-400, #1677ff);
  --dsq-accent: var(--dsw-static-blue-500, #3b82f6);
  --dsq-accent-tint: var(--dsw-static-blue-50p, #eaf3ff);
  --dsq-accent-tint-hover: var(--dsw-static-blue-75, #e5f0ff);
  --dsq-accent-tint-dark: var(--dsw-static-blue-950, #172554);
  --dsq-summary-bg: var(--dsw-alias-bg-layer-2, #fff);
  --dsq-mark-hover: var(--dsw-static-blue-75, #e5f0ff);
  --dsq-neutral-50: var(--dsw-static-neutral-50, #fafafa);
  --dsq-neutral-100: var(--dsw-static-neutral-100, #f5f5f5);
  --dsq-neutral-800: var(--dsw-static-neutral-800, #292929);
  --dsq-neutral-850: var(--dsw-static-neutral-850, #212123);
  --dsq-radius-sm: var(--dsw-radius-sm, 6px);
  --dsq-radius-md: var(--dsw-radius-md, 8px);
  --dsq-menu-icon: var(--dsw-alias-menu-icon, rgba(0, 0, 0, 0.45));
  --dsq-danger-bg: var(--dsw-alias-interactive-bg-hover-danger, rgba(217, 48, 37, 0.1));
  --dsq-danger: var(--dsw-alias-state-error-primary, #d93025);
  --dsq-warn-bg: var(--dsw-alias-bg-module-platform, rgba(0, 0, 0, 0.05));
  --dsq-warn: var(--dsw-alias-state-warn-label, #b26a00);
  /* Tone of the Host's info tag, used by the model release badge. */
  --dsq-business: var(--dsw-alias-state-business-primary, #4176e6);
  --dsq-business-bg: color-mix(in srgb, var(--dsq-business) 10%, transparent);
}
`
