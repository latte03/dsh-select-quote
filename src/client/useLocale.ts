import { useSyncExternalStore } from 'react'
import { localeRevision, subscribeLocale } from './i18n.ts'

/**
 * Re-render the calling component when the host language changes, so slot copy
 * switches without a page reload. Subscriptions happen after mount, by which
 * time `apply()` has bound the locale service.
 */
export function useLocale(): void {
  useSyncExternalStore(subscribeLocale, localeRevision, localeRevision)
}
