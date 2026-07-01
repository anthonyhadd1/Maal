import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme/tokens';

/**
 * Slim top banner shown while the device is offline (expo-network listener).
 */
export function OfflineBanner() {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const networkState = useNetworkState();

  const offline =
    networkState.isConnected === false || networkState.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}
    >
      <WifiOff color={colors.neutral[0]} size={14} />
      <Text style={styles.label}>{t('offline.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 900,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    backgroundColor: colors.neutral[900],
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  label: {
    ...typography.caption,
    color: colors.neutral[0],
  },
});
