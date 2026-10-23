import type { ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './theme';

/**
 * primary: filled (white in dark mode, black in light mode) for the main action.
 * default: a grey surface. outline: transparent with a border (destructive or secondary).
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
  const { colors, styles } = useTheme();
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

/** Toggle chip; `dim` draws it in the fainter (opposition) tone. */
export function Chip(props: { label: string; active?: boolean; dim?: boolean; onPress: () => void }) {
  const { colors, styles } = useTheme();
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
  const { styles } = useTheme();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { styles } = useTheme();
  return <View style={[styles.row, style]}>{children}</View>;
}
