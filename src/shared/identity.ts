/**
 * Names the Loader and the settings layer agree on.
 *
 * The row id lives in `cordis.patch.yml` (and the local `dev.patch.yml`); the
 * Host config form is keyed by it, so renaming either without this constant
 * would silently orphan the form. The bundle config section is keyed by the
 * package name instead.
 */
export const PACKAGE_NAME = 'dsh-select-quote'
export const ROW_ID = 'select-quote'
