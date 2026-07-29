import { GraduationCap, Target, Trophy, User, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { PressableScale } from '@/components/layout/PressableScale';
import { selection } from '@/lib/haptics';
import { useReducedMotionPref } from '@/lib/motion';
import { colors, fonts, radii, shadows, spacing } from '@/theme/tokens';

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

const SPRING = { damping: 14, stiffness: 320 } as const;

/**
 * Floating clay dock: a rounded white bar lifted off the bottom edge.
 * Active tab = filled violet pill (icon + label), inactive = neutral icons.
 */
export function ClayTabBar({ state, navigation }: ClayTabBarProps) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.m) }]}
    >
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG[route.name];
          if (!config) return null;
          const focused = state.index === index;
          const label = t(config.labelKey);

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
            <TabItem
              Icon={config.Icon}
              focused={focused}
              key={route.key}
              label={label}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  Icon,
  focused,
  label,
  onPress,
}: {
  Icon: LucideIcon;
  focused: boolean;
  label: string;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotionPref();
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    if (focused) {
      // Subtle spring pop on switch.
      pop.value = 0.82;
      pop.value = withSpring(1, SPRING);
    }
  }, [focused, pop, reduceMotion]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      clay={false}
      haptic={false}
      onPress={onPress}
      pressedTranslateY={1}
      style={styles.tab}
    >
      <Animated.View style={[styles.pill, focused && styles.pillActive, popStyle]}>
        <Icon
          color={focused ? colors.neutral[0] : colors.neutral[500]}
          size={22}
          strokeWidth={focused ? 2.5 : 2}
        />
        <Text
          numberOfLines={1}
          style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
        >
          {label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.l,
    paddingTop: spacing.s,
  },
  dock: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.pill,
    padding: spacing.s,
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 62, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(36, 31, 62, 0.09)',
    ...shadows.clayFloating,
  },
  tab: {
    flex: 1,
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingVertical: spacing.s,
    minHeight: 54,
    marginHorizontal: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.primary[600],
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.heading,
  },
  labelActive: {
    color: colors.neutral[0],
  },
  labelInactive: {
    color: colors.neutral[500],
    fontFamily: fonts.bodyMedium,
  },
});
