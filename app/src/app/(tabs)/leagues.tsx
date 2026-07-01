import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

/** TAB 2 « Ligue » — weekly league + leaderboard (Phase 7). */
export default function LeaguesRoute() {
  const { t } = useTranslation('leagues');

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
      </View>
      <EmptyState
        mascotState="thinking"
        message={t('empty.message')}
        title={t('empty.title')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
});
