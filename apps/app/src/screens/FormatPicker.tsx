import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FEATURED, formatRegion, type DebateFormat } from '@debate/core';
import { formatName, i18n, isRTL, useT } from '../i18n';
import { FONTS, useTheme } from '../theme';
import { Btn, Chip, Row } from '../ui';

const FEATURED_IDS = new Set(FEATURED.map((f) => f.id));

/** "Australia · High school · 45 min prep": what sets a format apart in the list. */
export function formatDetails(t: ReturnType<typeof useT>, f: DebateFormat) {
  const prep = f.info?.prepSec ? t('home.prep', { minutes: Math.round(f.info.prepSec / 60) }) : undefined;
  return [f.info?.region, f.info?.level, prep].filter(Boolean).join(' · ');
}

/**
 * Our own formats as chips, plus a searchable list of every format grouped by
 * region (the Debatekeeper library adds several dozen).
 */
export function FormatPicker(props: { formats: DebateFormat[]; selectedId: string; onSelect: (id: string) => void }) {
  const { colors, styles } = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const chips = props.formats.filter((f) => FEATURED_IDS.has(f.id) || f.id === props.selectedId);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = props.formats.filter((f) => {
      if (!q) return true;
      const i = f.info ?? {};
      return [formatName(t, f), f.name, i.region, i.level, i.usedAt, i.description].some((v) => v?.toLowerCase().includes(q));
    });
    const byRegion = new Map<string, DebateFormat[]>();
    for (const f of matches) {
      const region = formatRegion(f) ?? t('home.otherRegion');
      byRegion.set(region, [...(byRegion.get(region) ?? []), f]);
    }
    return [...byRegion].sort(([a], [b]) => (a === 'World' ? -1 : b === 'World' ? 1 : a.localeCompare(b)));
  }, [props.formats, query, t]);

  function choose(id: string) {
    props.onSelect(id);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ gap: 8 }}>
      <Row>
        {chips.map((f) => (
          <Chip key={f.id} label={formatName(t, f)} active={f.id === props.selectedId} onPress={() => props.onSelect(f.id)} />
        ))}
        <Btn
          title={open ? t('home.fewerFormats') : t('home.allFormats', { count: props.formats.length })}
          variant="outline"
          onPress={() => setOpen(!open)}
        />
      </Row>

      {open && (
        <View style={{ gap: 4 }}>
          <TextInput
            style={styles.input}
            placeholder={t('home.searchFormats')}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {groups.length === 0 && <Text style={styles.muted}>{t('home.noFormatMatch', { query: query.trim() })}</Text>}
          {groups.map(([region, formats]) => (
            <View key={region}>
              <Text style={[styles.muted, { marginTop: 8, textTransform: 'uppercase', letterSpacing: isRTL(i18n.language) ? 0 : 1, fontSize: 12, fontFamily: FONTS.semibold }]}>{region}</Text>
              {formats.map((f) => {
                const active = f.id === props.selectedId;
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => choose(f.id)}
                    style={({ pressed }) => ({
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: active ? colors.surfaceHi : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={[styles.text, active && { fontFamily: FONTS.semibold }]}>
                      {active ? '✓ ' : ''}
                      {formatName(t, f)}
                    </Text>
                    {!!f.info?.description && <Text style={styles.muted}>{f.info.description}</Text>}
                    <Text style={styles.muted}>{formatDetails(t, f)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
