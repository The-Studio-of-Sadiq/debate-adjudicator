import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import type { SpeechPhase } from '@debate/core';

/**
 * Monochrome light and dark themes. With no colour to lean on, meaning is
 * carried by brightness, filled-vs-outlined controls and words (every timer
 * phase is also named in text), which also keeps the app readable for
 * colour-blind users.
 */
export type ThemeName = 'dark' | 'light';
export type ThemePreference = 'system' | ThemeName;

export interface Palette {
  bg: string;
  surface: string;
  surfaceHi: string;
  border: string;
  text: string;
  muted: string;
  /** Filled primary controls, and the text on them. */
  primary: string;
  onPrimary: string;
  /** Opposition is a step fainter than Government wherever sides are shown. */
  gov: string;
  opp: string;
}

const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    bg: '#000000',
    surface: '#0f0f0f',
    surfaceHi: '#1d1d1d',
    border: '#3a3a3a',
    text: '#ffffff',
    muted: '#a3a3a3',
    primary: '#ffffff',
    onPrimary: '#000000',
    gov: '#ffffff',
    opp: '#b8b8b8',
  },
  light: {
    bg: '#ffffff',
    surface: '#f4f4f4',
    surfaceHi: '#e6e6e6',
    border: '#c4c4c4',
    text: '#000000',
    muted: '#5a5a5a',
    primary: '#000000',
    onPrimary: '#ffffff',
    gov: '#000000',
    opp: '#575757',
  },
};

/**
 * Timer card per phase: it moves from the page colour towards its opposite as
 * time runs out (dark mode brightens, light mode darkens), so the grace
 * period and overtime stand out in either theme.
 */
const PHASES: Record<ThemeName, Record<SpeechPhase, { bg: string; text: string }>> = {
  dark: {
    protected: { bg: '#141414', text: '#ffffff' },
    'poi-open': { bg: '#2a2a2a', text: '#ffffff' },
    closing: { bg: '#5a5a5a', text: '#ffffff' },
    grace: { bg: '#e8e8e8', text: '#000000' },
    overtime: { bg: '#ffffff', text: '#000000' },
  },
  light: {
    protected: { bg: '#f1f1f1', text: '#000000' },
    'poi-open': { bg: '#d9d9d9', text: '#000000' },
    closing: { bg: '#a6a6a6', text: '#000000' },
    grace: { bg: '#1c1c1c', text: '#ffffff' },
    overtime: { bg: '#000000', text: '#ffffff' },
  },
};

function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    container: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 16 },
    h1: { color: c.text, fontSize: 26, fontWeight: '700' },
    h2: { color: c.text, fontSize: 18, fontWeight: '600' },
    text: { color: c.text, fontSize: 15 },
    muted: { color: c.muted, fontSize: 13 },
    /** Warnings and errors: bold, prefixed with ⚠ in the text itself. */
    alert: { color: c.text, fontSize: 14, fontWeight: '700' },
    input: {
      color: c.text,
      backgroundColor: c.surfaceHi,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      borderWidth: 1,
      borderColor: c.border,
    },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    big: { paddingVertical: 16, paddingHorizontal: 22, borderRadius: 14, minWidth: 120 },
    btnText: { color: c.text, fontSize: 15, fontWeight: '600' },
    bigText: { fontSize: 18 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '600' },
  });
}

export interface Theme {
  name: ThemeName;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  phase: Record<SpeechPhase, { bg: string; text: string }>;
}

const THEMES: Record<ThemeName, Theme> = {
  dark: { name: 'dark', colors: PALETTES.dark, styles: makeStyles(PALETTES.dark), phase: PHASES.dark },
  light: { name: 'light', colors: PALETTES.light, styles: makeStyles(PALETTES.light), phase: PHASES.light },
};

const ThemeContext = createContext<Theme>(THEMES.dark);

/** "system" follows the device (Android dark mode, Windows app mode) and switches live. */
export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const name: ThemeName = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const theme = useMemo(() => THEMES[name], [name]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
