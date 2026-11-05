/**
 * Layer 2 — atoms. Shape only: adding a number here (or a color) is a
 * layering violation.
 *
 * The CSS rules and the exported class names are generated from one table,
 * so they cannot drift apart.
 */
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

export const atomRules = Object.entries(ATOMS)
  .map(([name, declarations]) => `.dsq_a_${toKebab(name)} { ${declarations} }`)
  .join('\n')

/** Atom class names, for `cx(styles.summary, A.row)`. */
export const A = Object.fromEntries(
  Object.keys(ATOMS).map((name) => [name, `dsq_a_${toKebab(name)}`]),
) as Record<keyof typeof ATOMS, string>
