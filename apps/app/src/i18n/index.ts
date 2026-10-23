import i18n, { type TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import type { Interruption, SpeechTemplate } from '@debate/core';
import en from './en';
import type { LanguageEntry } from './types';
import bn from './bn';
// i18n:new adds imports above this line.

/**
 * Languages the app ships, keyed by BCP 47 code ("bn", "pt-BR"). Add one with
 * `npm run i18n:new`, which also registers it here.
 */
export const LANGUAGES: Record<string, LanguageEntry> = {
  en: { name: 'English', englishName: 'English', translation: en },
  bn: { name: 'বাংলা', englishName: 'Bangla', translation: bn },
  // i18n:new adds entries above this line.
};
export type Language = string;
export type LanguagePreference = 'system' | Language;

/** The device's language if the app has it (exact tag first, then the base language), else English. */
export function deviceLanguage(): Language {
  const locale = getLocales()[0];
  if (locale?.languageTag && locale.languageTag in LANGUAGES) return locale.languageTag;
  if (locale?.languageCode && locale.languageCode in LANGUAGES) return locale.languageCode;
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(LANGUAGES).map(([code, l]) => [code, { translation: l.translation }])),
  lng: deviceLanguage(),
  fallbackLng: 'en',
  // React already escapes text; the PDF report escapes its own HTML.
  interpolation: { escapeValue: false },
  // Errors may be a key or raw text from a library; raw text containing ':'
  // must not be read as "namespace:key".
  nsSeparator: false,
});

/** Show an error that is either an i18n key or a raw message. */
export const errorText = (t: T, error: string) => t(error, { defaultValue: error });

export async function applyLanguage(pref: LanguagePreference) {
  await i18n.changeLanguage(pref === 'system' ? deviceLanguage() : pref);
}

export function useT() {
  return useTranslation().t;
}

export { i18n };
export type T = TFunction;

// Helpers for values that come from data rather than from the UI.

/**
 * A dictionary entry for data from a format, used only when its English matches
 * the format's own English name: imported formats reuse codes such as "LO" for
 * differently worded speeches ("Leader of the Opposition's Rebuttal").
 */
const fromDictionary = (t: T, key: string, english: string) =>
  i18n.getResource('en', 'translation', key) === english ? t(key) : english;

/** "Prime Minister" for a speech, falling back to the format's own name. */
export const roleName = (t: T, s: Pick<SpeechTemplate, 'role' | 'name'>) => fromDictionary(t, `roles.${s.role}`, s.name);

export const formatName = (t: T, f: { id: string; name: string }) => t(`formats.${f.id}`, { defaultValue: f.name });

/** Team name: translated if the dictionary has it, else the format's own English name. */
export const teamName = (t: T, id: string, fallback?: string) =>
  fallback === undefined ? t(`teams.${id}`, { defaultValue: id }) : fromDictionary(t, `teams.${id}`, fallback);

/** Server reason codes → sentence; unknown text (e.g. from an older device) passes through. */
export const netReason = (t: T, code: string | undefined) => (code ? t(`net.${code}`, { defaultValue: code }) : '');

export function outcomeText(t: T, i: Interruption): string {
  if (i.status === 'ruled' && i.ruling) return t(`interruptions.outcomes.${i.ruling}`);
  if (i.status === 'accepted' && i.endedAtSec !== undefined && i.resolvedAtSec !== undefined) {
    return t('interruptions.outcomes.acceptedFor', { seconds: Math.round(i.endedAtSec - i.resolvedAtSec) });
  }
  return t(`interruptions.outcomes.${i.status}`);
}
