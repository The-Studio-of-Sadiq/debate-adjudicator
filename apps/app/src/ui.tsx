import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from './theme';

/**
 * primary: filled white (the main action). default: dark grey.
 * outline: transparent with a border (destructive or secondary actions).
 */
export type BtnVariant = 'primary' | 'default' | 'outline';

export function Btn(props: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  big?: boolean;
  style?: ViewStyle;
}) {
  const variant = props.variant ?? 'default';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        props.big && styles.big,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'default' && { backgroundColor: colors.surfaceHi },
        variant === 'outline' && { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.text },
        { opacity: props.disabled ? 0.35 : pressed ? 0.7 : 1 },
        props.style,
      ]}
    >
      <Text style={[styles.btnText, props.big && styles.bigText, variant === 'primary' && { color: colors.onPrimary }]}>{props.title}</Text>
    </Pressable>
  );
}

/** Toggle chip; `dim` draws the inactive outline in the dimmer (opposition) grey. */
export function Chip(props: { label: string; active?: boolean; dim?: boolean; onPress: () => void }) {
  const tone = props.dim ? colors.opp : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!props.active }}
      onPress={props.onPress}
      style={[styles.chip, { borderColor: props.active ? tone : colors.border }, props.active && { backgroundColor: tone }]}
    >
      <Text style={[styles.chipText, { color: props.active ? colors.onPrimary : tone }]}>{props.label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  container: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, gap: 16 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '700' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '600' },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  /** Warnings and errors: bold white, prefixed with ⚠ in the text itself. */
  alert: { color: colors.text, fontSize: 14, fontWeight: '700' },
  input: {
    color: colors.text,
    backgroundColor: colors.surfaceHi,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  big: { paddingVertical: 16, paddingHorizontal: 22, borderRadius: 14, minWidth: 120 },
  btnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  bigText: { fontSize: 18 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
});
