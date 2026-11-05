import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRANSLATE_PROMPT,
  detectSourceLanguage,
  isAlreadyTargetLanguage,
  resolveTranslatePrompt,
  resolveTranslateTarget,
} from './translate.ts'

describe('detectSourceLanguage', () => {
  it('recognizes the scripts the plugin can name', () => {
    expect(detectSourceLanguage('这是一段中文。')).toBe('zh')
    expect(detectSourceLanguage('これはテストです。')).toBe('ja')
    expect(detectSourceLanguage('Это тест перевода.')).toBe('ru')
  })

  it('separates Latin languages by their own evidence', () => {
    expect(detectSourceLanguage('Hello, this is a test of the translation.')).toBe('en')
    expect(detectSourceLanguage('Hola, esta es una prueba de la traducción.')).toBe('es')
    expect(detectSourceLanguage('Bonjour, ceci est un test de la traduction.')).toBe('fr')
    expect(detectSourceLanguage('Dies ist ein Test der Übersetzung und der Sprache.')).toBe('de')
    expect(detectSourceLanguage('Olá, este é um teste da tradução.')).toBe('pt')
  })

  it('reports nothing for content without letters', () => {
    expect(detectSourceLanguage('12345 !!! ---')).toBeNull()
  })
})

describe('resolveTranslateTarget', () => {
  it('uses an explicit target as-is', () => {
    expect(resolveTranslateTarget('Hello', 'fr', 'zh')).toBe('fr')
    expect(resolveTranslateTarget('这是一段中文', 'en', 'zh')).toBe('en')
  })

  it('follows the UI language for a foreign passage', () => {
    expect(resolveTranslateTarget('Hello there, this is a test.', 'auto', 'zh')).toBe('zh')
    expect(resolveTranslateTarget('Hello there, this is a test.', 'auto', 'ja')).toBe('ja')
  })

  it('flips to English when the passage is already in the UI language', () => {
    expect(resolveTranslateTarget('这是一段中文。', 'auto', 'zh')).toBe('en')
    expect(resolveTranslateTarget('Dies ist ein Test der Sprache.', 'auto', 'de')).toBe('en')
  })

  it('flips to Chinese for an English reader selecting English', () => {
    expect(resolveTranslateTarget('Hello there, this is a test.', 'auto', 'en')).toBe('zh')
  })

  it('falls back to English for a UI language this plugin does not serve', () => {
    expect(resolveTranslateTarget('这是一段中文。', 'auto', 'ko')).toBe('en')
  })
})

describe('isAlreadyTargetLanguage', () => {
  it('matches the UI language under auto, even though the target flips', () => {
    expect(isAlreadyTargetLanguage('这是一段中文。', 'auto', 'zh')).toBe(true)
    expect(isAlreadyTargetLanguage('Hello there, this is a test.', 'auto', 'zh')).toBe(false)
    expect(isAlreadyTargetLanguage('Hello there, this is a test.', 'auto', 'en')).toBe(true)
  })

  it('matches a fixed target language only when the selection is in it', () => {
    expect(isAlreadyTargetLanguage('这是一段中文。', 'en', 'zh')).toBe(false)
    expect(isAlreadyTargetLanguage('Hello there, this is a test.', 'en', 'zh')).toBe(true)
    expect(isAlreadyTargetLanguage('Bonjour, ceci est un test.', 'fr', 'zh')).toBe(true)
  })

  it('never hides for content without a detectable language', () => {
    expect(isAlreadyTargetLanguage('12345 !!! ---', 'auto', 'zh')).toBe(false)
    expect(isAlreadyTargetLanguage('12345 !!! ---', 'en', 'en')).toBe(false)
    // Latin text without any hint word or diacritic is unknown, not English.
    expect(isAlreadyTargetLanguage('Merhaba, bu bir test.', 'auto', 'en')).toBe(false)
    expect(isAlreadyTargetLanguage('Halo, apa kabar?', 'en', 'zh')).toBe(false)
  })

  it('falls back to English for an unsupported UI locale', () => {
    expect(isAlreadyTargetLanguage('Hello there, this is a test.', 'auto', 'ko')).toBe(true)
  })
})

describe('resolveTranslatePrompt', () => {
  it('uses the built-in prompt with the model-facing target name', () => {
    const prompt = resolveTranslatePrompt('', 'zh')
    expect(prompt).toContain('Simplified Chinese')
    expect(prompt).toBe(DEFAULT_TRANSLATE_PROMPT.replaceAll('{target}', 'Simplified Chinese'))
  })

  it('uses a custom prompt and substitutes {target}', () => {
    expect(resolveTranslatePrompt('Translate into {target} only.', 'es')).toBe(
      'Translate into Spanish only.',
    )
  })

  it('keeps a custom prompt without placeholders as written', () => {
    expect(resolveTranslatePrompt('Always answer in one line.', 'ja')).toBe(
      'Always answer in one line.',
    )
  })

  it('falls back to the built-in prompt for whitespace', () => {
    expect(resolveTranslatePrompt('   \n  ', 'en')).toContain('translation engine')
  })
})
