import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from './theme';

export function Btn(props: {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  big?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.btn,
        props.big && styles.big,
        { backgroundColor: props.color ?? colors.surfaceHi, opacity: props.disabled ? 0.35 : pressed ? 0.7 : 1 },
        props.style,
      ]}
    >
      <Text style={[styles.btnText, props.big && styles.bigText]}>{props.title}</Text>
    </Pressable>
  );
}

export function Chip(props: { label: string; active?: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.chip, props.active && { backgroundColor: props.color ?? colors.accent, borderColor: 'transparent' }]}
    >
      <Text style={styles.chipText}>{props.label}</Text>
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
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
