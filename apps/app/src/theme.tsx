import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
// Import each weight from its own subpath: the packages' main entry pulls in
// every weight and italic, adding megabytes of unused fonts to the app.
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
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

/**
 * Type system ("Parliament"): Instrument Serif for display titles and motions,
 * Inter for everything else, with tabular figures on the clock. Fonts ship
 * inside the app (no network needed); see useBrandFonts().
 *
 * Android treats each weight of a custom font as its own family, so weights
 * are chosen by family name, never with fontWeight.
 */
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
  serif: 'InstrumentSerif_400Regular',
} as const;

export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    InstrumentSerif_400Regular,
  });
  // If a font fails to load, carry on with the system font rather than a blank app.
  return loaded || !!error;
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    container: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 16 },
    /** Screen titles. */
    h1: { color: c.text, fontSize: 34, lineHeight: 38, fontFamily: FONTS.serif },
    /** Motions and other quoted titles. */
    title: { color: c.text, fontSize: 24, lineHeight: 29, fontFamily: FONTS.serif },
    /** Section headings. */
    h2: { color: c.text, fontSize: 18, fontFamily: FONTS.semibold },
    text: { color: c.text, fontSize: 15, lineHeight: 21, fontFamily: FONTS.regular },
    muted: { color: c.muted, fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium },
    /** Small caps label above a title, e.g. "DEBATE". */
    eyebrow: { color: c.text, fontSize: 11, letterSpacing: 3.5, fontFamily: FONTS.bold, textTransform: 'uppercase' },
    /** Warnings and errors: bold, prefixed with ⚠ in the text itself. */
    alert: { color: c.text, fontSize: 14, fontFamily: FONTS.bold },
    /** Join codes and other things people read out or type. */
    code: { color: c.text, fontSize: 28, letterSpacing: 1, fontFamily: FONTS.bold, fontVariant: ['tabular-nums'] },
    /** The big clock. Size is set per screen. */
    clock: { fontFamily: FONTS.heavy, fontVariant: ['tabular-nums'], letterSpacing: -2 },
    input: {
      color: c.text,
      backgroundColor: c.surfaceHi,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: FONTS.regular,
      borderWidth: 1,
      borderColor: c.border,
    },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    big: { paddingVertical: 16, paddingHorizontal: 22, borderRadius: 14, minWidth: 120 },
    btnText: { color: c.text, fontSize: 15, fontFamily: FONTS.semibold },
    bigText: { fontSize: 18 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
    chipText: { fontSize: 13, fontFamily: FONTS.semibold },
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
