import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { XpByDayEntry } from '@/api/types';
import { formatNumber } from '@/lib/format';
import { colors, spacing, typography } from '@/theme/tokens';

const CHART_HEIGHT = 120;
const BAR_RADIUS = 4;
const DAYS_SHOWN = 14;

interface XpBarChartProps {
  data: XpByDayEntry[];
}

/**
 * 14-day XP bar chart in plain react-native-svg (no chart lib).
 * Bars scale to the max value; zero days render a floor stub.
 */
export function XpBarChart({ data }: XpBarChartProps) {
  const { t } = useTranslation('profile');
  const [width, setWidth] = useState(0);
  const days = data.slice(-DAYS_SHOWN);
  const max = Math.max(1, ...days.map((d) => d.xp));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const gap = spacing.xs;
  const barWidth = days.length > 0 ? (width - gap * (days.length - 1)) / days.length : 0;

  return (
    <View testID="xp-bar-chart">
      <View style={styles.maxRow}>
        <Text style={styles.maxLabel}>
          {t('statsScreen.maxXp', { xp: formatNumber(max) })}
        </Text>
      </View>
      <View onLayout={onLayout} style={styles.chartArea}>
        {width > 0 ? (
          <Svg height={CHART_HEIGHT} width={width}>
            {days.map((day, i) => {
              const h = Math.max(4, (day.xp / max) * CHART_HEIGHT);
              return (
                <Rect
                  fill={day.xp > 0 ? colors.primary[500] : colors.neutral[100]}
                  height={h}
                  key={day.date}
                  rx={BAR_RADIUS}
                  width={Math.max(2, barWidth)}
                  x={i * (barWidth + gap)}
                  y={CHART_HEIGHT - h}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{days[0] ? shortDay(days[0].date) : ''}</Text>
        <Text style={styles.axisLabel}>
          {days.length > 0 ? shortDay(days[days.length - 1].date) : ''}
        </Text>
      </View>
    </View>
  );
}

/** "2026-06-18" → "18/06" (compact, locale-neutral). */
function shortDay(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  maxRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  maxLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  chartArea: {
    height: CHART_HEIGHT,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.neutral[100],
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
});
