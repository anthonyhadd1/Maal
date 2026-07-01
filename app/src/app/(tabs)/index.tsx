import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

/** TAB 1 « Apprendre » — the levels map lands here in Phase 6. */
export default function LearnRoute() {
  const { t } = useTranslation('map');

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
      </View>
      <EmptyState
        mascotState="idle"
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
  subtitle: {
    ...typography.body,
    color: colors.neutral[500],
  },
});
