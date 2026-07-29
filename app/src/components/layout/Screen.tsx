import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edges } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

interface ScreenProps {
  /** Wrap children in a ScrollView (default false). */
  scroll?: boolean;
  /** Horizontal + top padding (default true). */
  padded?: boolean;
  edges?: Edges;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area screen shell on the app background (neutral 50). */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  style,
  contentStyle,
}: PropsWithChildren<ScreenProps>) {
  return (
    <SafeAreaView edges={edges} style={[styles.root, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && styles.paddedScroll, styles.grow, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.grow, padded && styles.padded, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  // flexShrink+minHeight:0 (not just flexGrow) so this View is actually
  // height-bounded on web when a child renders its own ScrollView/FlatList
  // (padded={false}, scroll left false) — otherwise it grows to the list's
  // full intrinsic content height instead of the viewport's, the list never
  // becomes internally scrollable, and content past the fold is unreachable.
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  padded: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  // Scrollable content only: without this, a screen's last item lands flush
  // against the physical bottom edge (default `edges` excludes 'bottom', so
  // no safe-area inset applies either) — cramped everywhere, and on a pushed
  // (non-tab) screen with a notched/gesture-bar device, the last row can sit
  // right under the home indicator. Some screens patched this themselves
  // (e.g. SettingsScreen's version caption); most didn't.
  paddedScroll: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
  },
});
