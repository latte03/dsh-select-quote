/**
 * Every style the plugin ships, in four layers.
 *
 *   1. tokens   — product design tokens, aliased once with their fallbacks
 *   2. atoms    — shared shapes (`.dsq_a_*`), no numbers, no colors
 *   3. components — one block per UI piece; everything measurable lives here
 *   4. host     — rules that reach into product DOM, theme flips, keyframes
 *
 * Injection order is the cascade order, so a component rule always wins over an
 * atom on the same element — which is what lets atoms stay shape-only and the
 * component blocks stay the single source of numbers.
 */

/** Layer 2 — atoms. Shape only: adding a number here is a layering violation. */
const ATOMS = {
  row: 'display: flex; align-items: center;',
  inlineRow: 'display: inline-flex; align-items: center;',
  col: 'display: flex; flex-direction: column;',
  colEnd: 'display: flex; flex-direction: column; align-items: flex-end;',
  gridMid: 'display: grid; place-items: center;',
  ell: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  plain: 'appearance: none; border: none; background: transparent; cursor: pointer;',
  keep: 'flex: none;',
  grow: 'flex: 1; min-width: 0;',
  box: 'box-sizing: border-box;',
} as const

const toKebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const atomRules = Object.entries(ATOMS)
  .map(([name, declarations]) => `.dsq_a_${toKebab(name)} { ${declarations} }`)
  .join('\n')

/** Atom class names, for `cx(styles.card, A.row)`. */
export const A = Object.fromEntries(
  Object.keys(ATOMS).map((name) => [name, `dsq_a_${toKebab(name)}`]),
) as Record<keyof typeof ATOMS, string>

/** Join class parts, dropping the falsy ones so a variant can be `cond && A.x`. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const CSS = `
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
  --dsq-bg-toast: var(--dsw-alias-bg-layer-3, rgba(0, 0, 0, 0.78));
  --dsq-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  --dsq-line-divider: var(--dsw-alias-border-l4, rgba(0, 0, 0, 0.12));
  --dsq-focus-ring: var(--dsw-alias-button-primary-fill, #1677ff);
  --dsq-fill-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  --dsq-label: var(--dsw-alias-label-primary, rgba(0, 0, 0, 0.88));
  --dsq-label-inverted: var(--dsw-alias-label-primary-inverted, #fff);
  --dsq-label-2: var(--dsw-alias-label-secondary, rgba(0, 0, 0, 0.65));
  --dsq-label-3: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, 0.45));
  --dsq-link: var(--dsw-alias-link, rgba(0, 0, 0, 0.65));
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  /* 浮层阴影统一走宿主的 prominent 档——和宿主自己的菜单/弹层同一档。覆层不需要描边*/
  --dsq-shadow: var(--dsw-elevation-prominent, 0 0 0 .5px rgba(0, 0, 0, 0.16), 0 3px 8px rgba(0, 0, 0, 0.04), 0 0 20px rgba(0, 0, 0, 0.05));
  --dsq-bubble: var(--dsw-specific-bubble, rgba(0, 0, 0, 0.05));
  --dsq-menu: var(--dsw-menu-surface-fill, rgba(248, 249, 250, .58));
  --dsq-menu-backdrop: var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  --dsq-accent-400: var(--dsw-static-blue-400, #1677ff);
  --dsq-accent: var(--dsw-static-blue-500, #3b82f6);
  --dsq-accent-tint: var(--dsw-static-blue-50p, #eaf3ff);
  --dsq-accent-tint-hover: var(--dsw-static-blue-75, #e5f0ff);
  --dsq-accent-tint-dark: var(--dsw-static-blue-950, #172554);
  --dsq-neutral-50: var(--dsw-static-neutral-50, #fafafa);
  --dsq-neutral-100: var(--dsw-static-neutral-100, #f5f5f5);
  --dsq-neutral-800: var(--dsw-static-neutral-800, #292929);
  --dsq-neutral-850: var(--dsw-static-neutral-850, #212123);
}

/* Layer 2 — atoms (generated from ATOMS above; the class names and the rules
   cannot drift apart because both come from the same table). */
${atomRules}

/* Layer 3 — components. Floating selection toolbar. */

/* 入场动画位置（2026-10-19 定稿）：scale + Y 位移都放在 .dsq_toolbar 容器上。
   规范层面 transform 不形成 backdrop root（opacity 才会），磨砂不受影响；用户已在
   真实客户端验证过容器 scale 没问题。若日后换环境再出问题，回退路径：去掉容器上的
   animation，给 .dsq_toolbarInner 加回 dsq-rise-in（关键帧还在）。 */
@keyframes dsq-toolbar-in {
  from {
    transform: translate(-50%, -100%) translateY(4px) scale(0.96);
  }
  to {
    transform: translate(-50%, -100%) translateY(0) scale(1);
  }
}

/* 内容层的 rise：悬停面板的列表在用；工具条改用容器 scale 后这条在这里待命。 */
@keyframes dsq-rise-in {
  from {
    transform: translateY(4px);
  }
  to {
    transform: translateY(0);
  }
}

/* 宿主菜单材质（官方 material 图层同款）：填充走 --dsw-menu-surface-fill，模糊走
   --dsw-menu-backdrop-filter（恒为 blur(40px) saturate(150%)），亮暗自动翻。
   画在 z-index:-1 的独立图层上，内容在它之上：模糊只取身后的页面，不会把
   面板里的文字一起糊掉。工具条、评论气泡、悬停面板三个浮层共用这一条。
   注意：macOS 上宿主另有一个 --dsw-specific-menu（覆写成 94% 不透明）给它的
   菜单用；这里按需求用 surface-fill，所以我们的浮层会比宿主自己的菜单更透。 */
.dsq_toolbar::before,
.dsq_commentPop::before,
.dsq_summaryHoverInner::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--dsq-menu);
  backdrop-filter: var(--dsq-menu-backdrop);
  -webkit-backdrop-filter: var(--dsq-menu-backdrop);
  pointer-events: none;
}

.dsq_toolbar {
  position: fixed;
  z-index: 10060;
  transform: translate(-50%, -100%);
  gap: 2px;
  padding: 4px;
  /* 无边框：--dsq-shadow（宿主的 elevation-prominent）自带 0 0 0 .5px 的描边环，
     由它勾勒轮廓，所以这里不要再画 border，否则描边会和环叠成两条线。 */
  border: 0;
  border-radius: 12px;
  /* 底色与模糊都在上面的材质图层里，这里不再画背景 */
  box-shadow: var(--dsq-shadow);
  pointer-events: auto;
  /* A/B：scale 入场放在容器上（材质图层归它所有）。关键帧自带 translate(-50%,-100%)，
     所以缩放不会破坏居中。若真实客户端里磨砂在放大期间消失，改回内容层方案。 */
  animation: dsq-toolbar-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 按钮行：只负责布局；入场动画在容器上（见 .dsq_toolbar 的 A/B 说明）。 */
.dsq_toolbarInner {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.dsq_button {
  color: var(--dsq-label);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  border-radius: 8px;
  padding: 4px 10px;
  gap: 6px;
  white-space: nowrap;
}
.dsq_button:hover {
  background: var(--dsq-fill-hover);
}

.dsq_buttonAddComment {
  background: var(--dsq-accent);
  color:#fff;
}
.dsq_buttonAddComment:hover {
  background: var(--dsq-accent-400);
}

.dsq_button:focus-visible {
  outline: 2px solid var(--dsq-focus-ring);
  outline-offset: 1px;
}

.dsq_button svg {
  flex: none;
}

.dsq_divider {
  width: 1px;
  height: 14px;
  background: var(--dsq-line-divider);
  margin: 0 2px;
}

.dsq_status {
  position: fixed;
  z-index: 10061;
  transform: translate(-50%, 8px);
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--dsq-bg-toast);
  color: var(--dsq-label-inverted);
  font-size: 12px;
  line-height: 18px;
  pointer-events: none;
  white-space: nowrap;
}

/* Annotation stack — inside the composer card (input.overlay), ~1/5 width. */
.dsq_cardStack {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 40;
  width: 20%;
  min-width: 148px;
  max-width: 220px;
  align-items: stretch;
  gap: 6px;
  pointer-events: auto;
}

/* One annotation card, shared by the composer and the transcript: the base
   carries the shape, and \`.dsq_tCard\` / \`.dsq_tCardIcon\` override only the
   numbers where the transcript really differs.
   Geometry mirrors the product's own file card (\`.nyYjTG_file\` in
   ui-deliverables): hairline border, neutral fill, 18px radius, fixed 72px row. */
.dsq_card {
  --dsq-card-fill: var(--dsq-neutral-50);
  --dsq-card-hover: var(--dsq-neutral-100);
  flex: 0 0 auto;
  gap: 10px;
  width: fit-content;
  max-width: calc(25% - 5px);
  min-width: 0;
  height: 64px;
  margin: 0;
  padding: 10px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 18px;
  background: var(--dsq-card-fill);
  color: var(--dsq-label);
  transition: background-color 0.12s;
  position: relative;
  overflow: hidden;
  user-select: none;
  pointer-events: auto;
}

.dsq_card:hover {
  background: var(--dsq-card-hover);
}

/* Scaled down from the reference 48px: the composer card is width-capped at a
   quarter of the input, so 48px would leave no room for the quote text. */
.dsq_cardIcon {
  z-index: 2;
  width: 36px;
  height: 36px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 12px;
  background: var(--dsq-card-fill);
  color: var(--dsq-link);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.dsq_cardBody {
  z-index: 2;
  justify-content: center;
  gap: 2px;
}

/* Keeps the ellipsised title clear of the corner remove button, which only the
   composer stack renders. */
.dsq_cardStack .dsq_cardBody {
  padding-right: 14px;
}

.dsq_cardTitle {
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  color: var(--dsq-label);
}

.dsq_cardSubtitle {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsq-label-3);
}

/* Corner remove button: hidden until the card is hovered or focused. */
.dsq_cardClose {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 3;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: var(--dsq-label-3);
  font-size: 14px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s, background-color 0.12s;
}

.dsq_card:hover .dsq_cardClose,
.dsq_card:focus-within .dsq_cardClose,
.dsq_summary:hover .dsq_cardClose,
.dsq_summary:focus-within .dsq_cardClose {
  opacity: 1;
  pointer-events: auto;
}

.dsq_cardClose:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

/* Secondary corner action (edit comment). */
.dsq_cardAction {
  position: absolute;
  top: 4px;
  right: 28px;
  z-index: 3;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: var(--dsq-label-3);
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s, background-color 0.12s;
}

.dsq_card:hover .dsq_cardAction,
.dsq_card:focus-within .dsq_cardAction {
  opacity: 1;
  pointer-events: auto;
}

.dsq_cardAction:hover {
  background: var(--dsq-fill-hover);
}

/* Qoder-style annotation summary (“N 条批注”) inside the composer. */
.dsq_summary {
  position: relative;
  z-index: 10040;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  padding: 8px 10px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 18px;
  background: var(--dsq-neutral-50);
  pointer-events: auto;
  user-select: none;
}

.dsq_summaryIcon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-link);
  font-size: 13px;
  font-weight: 600;
}

.dsq_summaryBody {
  position: relative;
}

.dsq_summaryTitle {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--dsq-label);
}

.dsq_summaryHint {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsq-label-3);
}

.dsq_summaryHover {
  /* \`display: none\` here is the closed state, so this rule must not take the
     flex atoms — the open class below turns display back on. */
  display: none;
  position: fixed;
  z-index: 10050;
  width: min(320px, calc(100vw - 16px));
  flex-direction: column;
  padding: 12px;
  /* Facing-side pad is set in JS from placement side; this is the base. */
  padding-top: 12px;
  padding-bottom: 12px;
  background: transparent;
  pointer-events: auto;
  opacity: 0;
}

/* Must come after .dsq_summaryHover (same class weight otherwise loses to display:none). */
/* 容器上不做 opacity 过渡、也不做 scale 入场。opacity 那条是规范实锤：祖先一带上
   opacity<1 就成了 backdrop root，::before 采样不到身后的页面，磨砂在整段淡入里
   消失、结束才糊上——所以 opacity 过渡删掉，只留 place() 里那次 0→1 瞬时翻转
   （「定位前不可见」的守卫）。scale 一并去掉是保守起见：容器彻底静止，采样区域
   不会逐帧移动；入场感交给内层列表的 rise（内容不是材质的祖先）。 */
.dsq_summaryHover.dsq_summaryHoverOpen {
  display: flex;
}

.dsq_summaryHoverInner {
  position: relative;
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  /* 不画 border：--dsq-shadow（宿主的 elevation-prominent）自带 0 0 0 .5px 的
     描边环，再画一遍会叠成两条线。底色与模糊都在材质图层里。 */
  box-shadow: var(--dsq-shadow);
}

/* 滚动只放在列表上：材质图层是绝对定位的，留在会滚动的容器里会跟着内容跑掉，
   滚到底部时面板顶部就露空。入场 rise 也在这层——内容不是材质图层的祖先，
   动它不会切断磨砂的采样源。 */
.dsq_summaryList {
  gap: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
  max-height: min(412px, calc(100vh - 128px));
  animation: dsq-rise-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* 老浏览器没有 backdrop-filter：图层退成不透明底色，否则半透明直接糊在文字上。 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dsq_toolbar::before,
  .dsq_commentPop::before,
  .dsq_summaryHoverInner::before {
    background: var(--dsq-bg-raised);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.dsq_summaryItem {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background-color 0.12s;
}

.dsq_summaryItem:hover {
  background: color-mix(in srgb, var(--dsq-fill-hover) 50%, transparent) ;
}

.dsq_summaryItemHead {
  gap: 6px;
}

.dsq_summaryItemBadge {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--dsq-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.dsq_summaryItemActions {
  gap: 2px;
  margin-left: auto;
  opacity: 0.5;
  transition: opacity 0.12s;
}

.dsq_summaryItem:hover .dsq_summaryItemActions,
.dsq_summaryItem:focus-within .dsq_summaryItemActions {
  opacity: 1;
}

.dsq_summaryItemAction {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: var(--dsq-label-3);
}

.dsq_summaryItemAction:hover {
  background: var(--dsq-fill-hover);
  color: var(--dsq-label);
}

.dsq_summaryItemMain {
  min-width: 0;
}

.dsq_summaryItemButton {
  display: block;
  width: 100%;
  text-align: left;
  font: inherit;
  border-radius: 8px;
  padding: 2px 0 0;
}

.dsq_annAnchor {
  display: block;
  width: 100%;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

.dsq_summaryItemLabel {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsq-label-3);
}

.dsq_summaryItemText {
  font-size: 13px;
  line-height: 18px;
  color: var(--dsq-label);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dsq_summaryItemTextEmpty {
  color: var(--dsq-label-3);
}

/* Inline edit form rendered inside the hover panel item (no extra layer). */
.dsq_annEditText {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsq-label);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 132px;
  overflow-y: auto;
  margin: 2px 0 6px;
}

.dsq_annEditInput {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border: none;
  border-radius: 10px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsq-label);
  background: var(--dsq-fill-hover);
  outline: none;
}

.dsq_annEditInput::placeholder {
  color: var(--dsq-label-3);
}

.dsq_annEditActions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.dsq_annEditCancel {
  color: var(--dsq-label-2);
  font: inherit;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 10px;
}

.dsq_annEditCancel:hover {
  background: var(--dsq-fill-hover);
}

.dsq_annEditSave {
  appearance: none;
  border: none;
  background: var(--dsq-accent);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: filter 0.12s;
}

.dsq_annEditSave:hover {
  background: var(--dsq-accent-400);
}

.dsq_annEditSave:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Inline comment composer under the floating selection toolbar. */
.dsq_commentPop {
  position: fixed;
  z-index: 10050;
  transform: translate(-50%, 4px);
  width: min(320px, calc(100vw - 24px));
  gap: 8px;
  padding: 8px;
  border-radius: 16px;
  /* 底色与模糊都在材质图层里 */
  box-shadow: var(--dsq-shadow);
}

.dsq_commentInput {
  width: 100%;
  min-height: 64px;
  resize: none;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsq-label);
  background: var(--dsq-fill-hover);
  outline: none;
}

.dsq_commentInput::placeholder {
  color: var(--dsq-label-3);
}

.dsq_commentActions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* Transcript cards — in-flow rows under the user bubble, side by side. */
.dsq_tCardStack {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: stretch;
  gap: 6px;
  margin: 4px 0 8px;
  /* Cards lay out horizontally and wrap onto the next row when they run out of
     width. Each card carries the selected text plus the user's comment, so they
     stay compact and stay on the user-bubble side (right). */
  max-width: 100%;
  margin-left: auto;
  margin-right: 0;
}

/* Transcript-only differences from the shared card. Unlike the composer
   summary (one collapsed row per message) each history card shows its own
   comment, so the fixed height and single-line clamps are lifted on \`.dsq_tCardButton\`. */
.dsq_tCard {
  max-width: min(calc(var(--dsq-chat-width) * 0.72), 520px);
  margin-left: auto;
}

.dsq_tCardIcon {
  width: 40px;
  height: 40px;
  font-size: 14px;
}

.dsq_tCardButton {
  /* Compact cards: several fit in one row before wrapping. */
  display: block;
  flex: 0 1 auto;
  width: 230px;
  max-width: 100%;
  padding: 0;
  font: inherit;
  text-align: left;
  border-radius: 14px;
}

.dsq_tCardButton:focus-visible {
  outline: 2px solid var(--dsq-accent);
  outline-offset: 2px;
}

.dsq_tCardButton .dsq_card {
  height: auto;
  min-height: 0;
  align-items: flex-start;
  width: 100%;
  gap: 8px;
  padding: 8px;
  border-radius: 14px;
}

.dsq_tCardButton .dsq_cardIcon {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  font-size: 11px;
}

.dsq_tCardButton .dsq_cardTitle {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 18px;
}

.dsq_tCardButton .dsq_cardSubtitle {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-top: 2px;
  font-size: 12px;
  line-height: 16px;
}

/* A comment is the user's own words — give it more presence than the neutral
   "no comment" placeholder. */
.dsq_cardSubtitle[data-dsq-has-comment='true'] {
  color: var(--dsq-label-2);
}

/* Replacement user bubble (quote block stripped from display). */
.dsq_userRow {
  gap: 6px;
}

.dsq_userStack {
  min-width: 0;
  max-width: min(calc(var(--dsq-chat-width) * 0.702), 82%);
  gap: 8px;
}

.dsq_userBubble {
  max-width: 100%;
  padding: 10px 16px;
  border-radius: 22px;
  background: var(--dsq-bubble);
  color: var(--dsq-label);
  font-size: var(--dsq-font-size);
  line-height: calc(22px + var(--dsq-font-delta));
  white-space: pre-wrap;
  word-break: break-word;
}

/* Durable message images of a replacement user bubble. */
.dsq_userImages {
  max-width: 100%;
}

/* Model-written :dsh-annotation{index="N"} chips. */
.dsq_annDirective {
  appearance: none;
  margin: 0 2px;
  padding: 0 6px;
  border: 0.5px solid var(--dsq-line);
  border-radius: 6px;
  background: var(--dsq-fill-hover);
  color: var(--dsq-link);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  vertical-align: baseline;
}

/* Inline annotation mark in message bodies: highlight underline + ordinal badge. */
.dsq_annMark {
  --dsq-mark-color: var(--dsq-accent);
  --dsq-mark-tint: var(--dsq-accent-tint);
  background: var(--dsq-mark-tint);
  text-decoration: underline;
  text-decoration-style: dashed;
  text-decoration-color: var(--dsq-mark-color);
  text-decoration-thickness: 2px;
  text-underline-offset: 2px;
  border-radius: 2px;
  scroll-margin-block: 96px;
  transition: background-color 0.12s;
}

/* Ordinal as a superscript corner badge at the END of the marked text, so it
   never sits between the reader and the sentence. Only the last fragment of a
   multi-fragment mark carries the index, so the number appears exactly once. */
.dsq_annMark[data-dsq-ann-index]::after {
  content: attr(data-dsq-ann-index);
  display: inline-grid;
  place-items: center;
  min-width: 15px;
  height: 15px;
  margin-left: 2px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--dsq-mark-color);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  vertical-align: super;
}

.dsq_annMark:hover {
  background: var(--dsq-accent-tint-hover);
}

.dsq_annMarkFlash {
  animation: dsq-ann-flash 1.4s ease-out;
}

/* Layer 4 — host surface: keyframes, theme flips, and the two rules that reach
   into product-owned DOM. */

@keyframes dsq-ann-flash {
  0% {
    background: var(--dsq-mark-color);
    color: #fff;
  }
  100% {
    background: var(--dsq-mark-tint);
    color: inherit;
  }
}

/* The product flips its palette on body[data-ds-dark-theme], and every
   --dsq-* alias follows it. Only values we own ourselves need restating — the
   transcript card carries .dsq_card too, so one selector covers both. */
body[data-ds-dark-theme] .dsq_card {
  --dsq-card-fill: var(--dsq-neutral-850);
  --dsq-card-hover: var(--dsq-neutral-800);
}

body[data-ds-dark-theme] .dsq_annMark {
  --dsq-mark-tint: var(--dsq-accent-tint-dark);
}

/* Reserve room for the floating quote cards inside the composer card, so the
   attachment rail and the editor flow below them instead of being covered. */
.dsq_cardPad {
  padding-top: var(--dsq-quote-pad, 88px) !important;
}
`

const TAG_ID = 'dsh-select-quote/toolbar.css'
export function ensureToolbarStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-select-quote'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

export const styles = {
  toolbar: 'dsq_toolbar',
  toolbarInner: 'dsq_toolbarInner',
  button: 'dsq_button',
  buttonAddComment: 'dsq_buttonAddComment',
  divider: 'dsq_divider',
  status: 'dsq_status',
  cardStack: 'dsq_cardStack',
  card: 'dsq_card',
  cardIcon: 'dsq_cardIcon',
  cardBody: 'dsq_cardBody',
  cardTitle: 'dsq_cardTitle',
  cardSubtitle: 'dsq_cardSubtitle',
  cardClose: 'dsq_cardClose',
  cardPad: 'dsq_cardPad',
  cardAction: 'dsq_cardAction',
  summary: 'dsq_summary',
  summaryIcon: 'dsq_summaryIcon',
  summaryBody: 'dsq_summaryBody',
  summaryTitle: 'dsq_summaryTitle',
  summaryHint: 'dsq_summaryHint',
  summaryHover: 'dsq_summaryHover',
  summaryItem: 'dsq_summaryItem',
  summaryItemLabel: 'dsq_summaryItemLabel',
  summaryItemText: 'dsq_summaryItemText',
  summaryItemBadge: 'dsq_summaryItemBadge',
  summaryItemMain: 'dsq_summaryItemMain',
  summaryItemHead: 'dsq_summaryItemHead',
  summaryItemTextEmpty: 'dsq_summaryItemTextEmpty',
  annEditText: 'dsq_annEditText',
  annEditInput: 'dsq_annEditInput',
  annEditActions: 'dsq_annEditActions',
  annEditCancel: 'dsq_annEditCancel',
  annEditSave: 'dsq_annEditSave',
  summaryHoverInner: 'dsq_summaryHoverInner',
  summaryList: 'dsq_summaryList',
  summaryItemButton: 'dsq_summaryItemButton',
  summaryHoverOpen: 'dsq_summaryHoverOpen',
  summaryItemActions: 'dsq_summaryItemActions',
  summaryItemAction: 'dsq_summaryItemAction',
  annDirective: 'dsq_annDirective',
  annAnchor: 'dsq_annAnchor',
  annMark: 'dsq_annMark',
  annMarkFlash: 'dsq_annMarkFlash',
  commentPop: 'dsq_commentPop',
  commentInput: 'dsq_commentInput',
  commentActions: 'dsq_commentActions',
  tCardStack: 'dsq_tCardStack',
  tCardButton: 'dsq_tCardButton',
  tCard: 'dsq_tCard',
  tCardIcon: 'dsq_tCardIcon',
  userRow: 'dsq_userRow',
  userStack: 'dsq_userStack',
  userImages: 'dsq_userImages',
  userBubble: 'dsq_userBubble',
} as const
