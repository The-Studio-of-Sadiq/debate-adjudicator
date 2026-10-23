import { DevSettings, I18nManager } from 'react-native';

/**
 * Android: React Native mirrors the layout from I18nManager, which is read
 * when the app starts. Changing it is saved for the next launch, so switching
 * between left-to-right and right-to-left languages needs a restart.
 *
 * allowRTL(false) also keeps an English interface left-to-right on a phone
 * set to Arabic or Urdu.
 */
export function applyDirection(rtl: boolean, _language: string): { restartNeeded: boolean } {
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return { restartNeeded: I18nManager.isRTL !== rtl };
}

/** Android mirrors the whole app through I18nManager; the root view needs nothing. */
export function rootDirectionProps(_rtl: boolean, _language: string): object {
  return {};
}

/** Reload in development builds; release builds ask the user to reopen the app instead. */
export const restartApp: (() => void) | null = __DEV__ ? () => DevSettings.reload() : null;
