import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { colors, spacing, typography } from '@/theme/tokens';

interface ScreenHeaderProps {
  title: string;
  /** Optional trailing actions (icon buttons). */
  right?: ReactNode;
  onBack?: () => void;
}

/** Push-screen header: clay back button + title + optional right slot. */
export function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <View style={styles.row}>
      <ClayIconButton
        accessibilityLabel={t('cta.back')}
        onPress={onBack ?? (() => router.back())}
        testID="screen-header-back"
      >
        <ChevronLeft color={colors.neutral[700]} size={22} />
      </ClayIconButton>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
});
