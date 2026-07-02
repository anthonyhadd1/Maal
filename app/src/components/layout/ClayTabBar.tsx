import { GraduationCap, Target, Trophy, User, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale } from '@/components/layout/PressableScale';
import { selection } from '@/lib/haptics';
import { clayHighlight, colors, radii, shadows, spacing, typography } from '@/theme/tokens';

/**
 * Minimal structural typing for the tab-bar render prop.
 * (SDK 56's expo-router forked React Navigation — we must not import
 * `@react-navigation/*` types directly, per design_mobile.md §1.)
 */
export interface ClayTabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    emit: (event: {
      type: string;
      target?: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

interface TabConfig {
  labelKey: string;
  Icon: LucideIcon;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  index: { labelKey: 'tabs.learn', Icon: GraduationCap },
  leagues: { labelKey: 'tabs.league', Icon: Trophy },
  quests: { labelKey: 'tabs.quests', Icon: Target },
  profile: { labelKey: 'tabs.profile', Icon: User },
};

/**
 * Custom claymorphic tab bar: 4 tabs, always-visible labels,
 * violet pill behind the active tab, safe-area padded.
 */
export function ClayTabBar({ state, navigation }: ClayTabBarProps) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.s) }]}>
      <View pointerEvents="none" style={styles.highlight} />
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name];
        if (!config) return null;
        const focused = state.index === index;
        const label = t(config.labelKey);
        const color = focused ? colors.primary[600] : colors.neutral[500];

        const onPress = () => {
          // Tab switches use the subtler selection tick (not the impact tap).
          selection();
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <PressableScale
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            clay={false}
            haptic={false}
            key={route.key}
            onPress={onPress}
            pressedTranslateY={2}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <config.Icon color={color} size={24} strokeWidth={focused ? 2.4 : 2} />
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.s,
    paddingHorizontal: spacing.s,
    ...shadows.clayFloating,
  },
  highlight: {
    position: 'absolute',
    top: 2,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 2,
    backgroundColor: clayHighlight,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    minWidth: 68,
  },
  pillActive: {
    backgroundColor: colors.primary[100],
  },
  label: {
    ...typography.caption,
    fontFamily: typography.caption.fontFamily,
  },
});
