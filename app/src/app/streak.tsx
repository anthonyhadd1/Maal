import { useLocalSearchParams, useRouter } from 'expo-router';
import { Flame } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayButton } from '@/components/clay/ClayButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { Mascot } from '@/components/mascot/Mascot';
import { play } from '@/lib/sounds';
import { colors, scrim, spacing, typography } from '@/theme/tokens';

/**
 * Transparent modal celebrating a streak day earned (routed from the results
 * screen when `streak.extended_today` is true).
 */
export default function StreakRoute() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { days } = useLocalSearchParams<{ days?: string }>();
  const count = Number(days ?? 0) || 0;

  // The flame moment gets its own fanfare.
  useEffect(() => {
    play('streak');
  }, []);

  return (
    <View style={styles.scrim}>
      <ClaySurface radius="xl" shadow="floating" style={styles.card}>
        <View style={styles.flameWrap}>
          <Flame color={colors.streakOrange} fill={colors.streakOrange} size={72} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('streak.celebrate', { count })}
        </Text>
        <Text style={styles.subtitle}>{t('streak.todayDone', { count })}</Text>
        <Mascot size={120} state="celebrate" />
        <ClayButton
          fullWidth
          onPress={() => router.back()}
          size="l"
          testID="streak-continue"
          title={t('cta.continue')}
          variant="primary"
        />
      </ClaySurface>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.xl,
  },
  flameWrap: {
    marginTop: spacing.s,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
  },
});
