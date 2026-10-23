import i18n, { type TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { getLocales } from 'expo-localization';
import type { Interruption, SpeechTemplate } from '@debate/core';
import en from './en';

/** Languages the app ships. Add a dictionary here to offer it in the picker. */
export const LANGUAGES = { en } as const;
export type Language = keyof typeof LANGUAGES;
export type LanguagePreference = 'system' | Language;

export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code in LANGUAGES ? (code as Language) : 'en';
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(LANGUAGES).map(([code, translation]) => [code, { translation }])),
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

/** "Prime Minister" for a speech, falling back to the format's own name for custom roles. */
export const roleName = (t: T, s: Pick<SpeechTemplate, 'role' | 'name'>) => t(`roles.${s.role}`, { defaultValue: s.name });

export const formatName = (t: T, f: { id: string; name: string }) => t(`formats.${f.id}`, { defaultValue: f.name });

export const teamName = (t: T, id: string) => t(`teams.${id}`, { defaultValue: id });

/** Server reason codes → sentence; unknown text (e.g. from an older device) passes through. */
export const netReason = (t: T, code: string | undefined) => (code ? t(`net.${code}`, { defaultValue: code }) : '');

export function outcomeText(t: T, i: Interruption): string {
  if (i.status === 'ruled' && i.ruling) return t(`interruptions.outcomes.${i.ruling}`);
  if (i.status === 'accepted' && i.endedAtSec !== undefined && i.resolvedAtSec !== undefined) {
    return t('interruptions.outcomes.acceptedFor', { seconds: Math.round(i.endedAtSec - i.resolvedAtSec) });
  }
  return t(`interruptions.outcomes.${i.status}`);
}
