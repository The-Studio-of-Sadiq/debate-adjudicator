import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from './theme';

const STROKE = 3.4;

/**
 * The mark, "The House": Government's bench (solid) and Opposition's bench
 * (open) across the floor, with the Speaker's chair at its head. Same
 * geometry as scripts/brand-assets.mjs; drawn on its 48×40 bounding box.
 */
export function Logo({ size = 40, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.text;
  return (
    <Svg width={(size * 48) / 40} height={size} viewBox="8 12 48 40" accessibilityLabel="Debate Adjudicator">
      <Rect x={8} y={12} width={14} height={40} rx={3} fill={c} />
      <Rect
        x={42 + STROKE / 2}
        y={12 + STROKE / 2}
        width={14 - STROKE}
        height={40 - STROKE}
        rx={3 - STROKE / 4}
        fill="none"
        stroke={c}
        strokeWidth={STROKE}
      />
      <Path d="M25 12h14v3a7 7 0 0 1-14 0z" fill={c} />
    </Svg>
  );
}

/** Mark with the wordmark: "DEBATE" eyebrow over "Adjudicator" in Instrument Serif. */
export function Lockup({ size = 44 }: { size?: number }) {
  const { styles } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.32 }} accessibilityRole="header">
      <Logo size={size} />
      <View>
        <Text style={[styles.eyebrow, { fontSize: size * 0.24 }]}>Debate</Text>
        <Text style={[styles.h1, { fontSize: size * 0.95, lineHeight: size * 1.05 }]}>Adjudicator</Text>
      </View>
    </View>
  );
}
