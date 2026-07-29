import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/theme/tokens';

/** This banner's own height, beyond the safe-area inset it also pads for —
 * exported so Toast (an independent, sibling overlay also anchored near the
 * top) can offset itself below this instead of rendering on top of it when
 * both are visible at once (e.g. a "server error" toast firing while
 * offline — a very likely pairing, not an edge case). */
export const OFFLINE_BANNER_CONTENT_HEIGHT = spacing.xs + typography.caption.lineHeight + spacing.xs;

/** True whenever this banner would render — kept alongside it so Toast can
 * mirror the same check without duplicating the isConnected/isReachable logic. */
export function useIsOffline(): boolean {
  const networkState = useNetworkState();
  return networkState.isConnected === false || networkState.isInternetReachable === false;
}

/**
 * Slim top banner shown while the device is offline (expo-network listener).
 */
export function OfflineBanner() {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();

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
