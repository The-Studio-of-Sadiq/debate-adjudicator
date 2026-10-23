import type en from './en';

/** The shape of every dictionary: English is the reference. */
export type Translation = typeof en;

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/**
 * A translation may be incomplete: any missing key falls back to English.
 * Keys must exist in English, though (`npm run check:i18n` checks this).
 */
export type LocaleDictionary = DeepPartial<Translation>;

export interface LanguageEntry {
  /** The language's own name for itself, shown in the picker (e.g. "বাংলা"). */
  name: string;
  /** English name, for docs and the coverage report (e.g. "Bangla"). */
  englishName: string;
  translation: LocaleDictionary;
}
