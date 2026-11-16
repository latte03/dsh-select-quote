/** Side-question tab chrome that lives inside the host's tab chip. */
export const SIDE_CSS = `
/* The host title slot uses display: contents, so this button is a direct flex
   item of the chip. Keep its hit box compact and never let it shrink. */
.dsq_keepTab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 18px;
  height: 18px;
  margin-left: 2px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  transition: opacity 0.12s, background-color 0.12s;
}

.dsq_keepTab:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.dsq_keepTab:focus-visible {
  outline: 2px solid var(--dsq-accent);
  outline-offset: 1px;
  opacity: 1;
}
`
