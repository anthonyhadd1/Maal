import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme/tokens';

/** TAB 3 « Quêtes » — daily goal + quests + achievements entry (Phase 7). */
export default function QuestsRoute() {
  const { t } = useTranslation('common');

  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('quests.title')}
        </Text>
      </View>
      <EmptyState
        mascotState="celebrate"
        message={t('quests.empty.message')}
        title={t('quests.empty.title')}
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
