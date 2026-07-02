import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { XpByDayEntry } from '@/api/types';
import { formatNumber } from '@/lib/format';
import { colors, fonts, spacing, typography } from '@/theme/tokens';

const CHART_HEIGHT = 120;
const DAYS_SHOWN = 14;

interface XpBarChartProps {
  data: XpByDayEntry[];
}

/**
 * 14-day XP bar chart in plain react-native-svg (no chart lib):
 * rounded violet-gradient bars, today highlighted in the full accent,
 * zero days as floor stubs, first/last date on the axis.
 */
export function XpBarChart({ data }: XpBarChartProps) {
  const { t } = useTranslation('profile');
  const [width, setWidth] = useState(0);
  const days = data.slice(-DAYS_SHOWN);
  const max = Math.max(1, ...days.map((d) => d.xp));
  const todayIso = isoToday();

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const gap = spacing.xs + 2;
  const barWidth = days.length > 0 ? (width - gap * (days.length - 1)) / days.length : 0;
  const radius = Math.min(6, Math.max(3, barWidth / 3));

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
            <Defs>
              <SvgLinearGradient id="xpBar" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={colors.primary[400]} />
                <Stop offset="1" stopColor={colors.primary[600]} />
              </SvgLinearGradient>
              <SvgLinearGradient id="xpBarToday" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={colors.xpGold} />
                <Stop offset="1" stopColor={colors.streakOrange} />
              </SvgLinearGradient>
            </Defs>
            {days.map((day, i) => {
              const isToday = day.date === todayIso;
              const h = Math.max(5, (day.xp / max) * CHART_HEIGHT);
              const fill =
                day.xp <= 0 ? colors.neutral[100] : isToday ? 'url(#xpBarToday)' : 'url(#xpBar)';
              return (
                <Rect
                  fill={fill}
                  height={h}
                  key={day.date}
                  rx={radius}
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
        <Text style={[styles.axisLabel, styles.axisToday]}>
          {days.length > 0 && days[days.length - 1].date === todayIso
            ? t('statsScreen.today')
            : days.length > 0
              ? shortDay(days[days.length - 1].date)
              : ''}
        </Text>
      </View>
    </View>
  );
}

/** Local date → "2026-07-02" (matches the API's day keys). */
function isoToday(): string {
  const d = new Date();
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    borderBottomColor: colors.neutral[200],
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
  axisToday: {
    fontFamily: fonts.bodyBold,
    color: colors.streakOrange,
  },
});
