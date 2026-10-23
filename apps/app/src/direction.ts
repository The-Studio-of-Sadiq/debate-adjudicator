/**
 * Web and Windows: the browser mirrors the layout from the document's `dir`,
 * and React Native Web follows it, so a change of language applies at once.
 */
export function applyDirection(rtl: boolean, language: string): { restartNeeded: boolean } {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }
  return { restartNeeded: false };
}

/**
 * Props for the app's root view. React Native Web resolves paddingStart,
 * borderStartWidth and the like from the nearest `dir`, not from the document.
 */
export function rootDirectionProps(rtl: boolean, language: string): object {
  return { dir: rtl ? 'rtl' : 'ltr', lang: language };
}

/** Never needed on the web; see direction.native.ts. */
export const restartApp: (() => void) | null = null;
