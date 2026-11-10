/**
 * Read the live Host settings inside a component.
 *
 * `config.ts` stays React-free so the normalizer can be tested as plain data;
 * this hook is the only adapter, and every surface that paints from a setting
 * subscribes through it. Reading `getConfig()` during render without the
 * subscription would freeze a surface at whatever was on screen when it mounted.
 */
import { useSyncExternalStore } from 'react'
import { getConfig, subscribeConfig, type SelectQuoteConfig } from './config.ts'

export function useConfig(): SelectQuoteConfig {
  return useSyncExternalStore(subscribeConfig, getConfig, getConfig)
}
