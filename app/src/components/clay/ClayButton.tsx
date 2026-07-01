import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type PressableScaleProps } from '@/components/layout/PressableScale';
import { clayHighlight, colors, fonts, radii, spacing } from '@/theme/tokens';

export type ClayButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'gold';
export type ClayButtonSize = 'm' | 'l';

export interface ClayButtonProps extends Omit<PressableScaleProps, 'children'> {
  title: string;
  variant?: ClayButtonVariant;
  size?: ClayButtonSize;
  loading?: boolean;
  /** Optional leading icon element (lucide icon). */
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface VariantStyle {
  backgroundColor: string;
  labelColor: string;
  borderColor?: string;
}

const VARIANTS: Record<ClayButtonVariant, VariantStyle> = {
  primary: { backgroundColor: colors.primary[500], labelColor: colors.neutral[0] },
  secondary: {
    backgroundColor: colors.neutral[0],
    labelColor: colors.primary[600],
    borderColor: colors.neutral[300],
  },
  success: { backgroundColor: colors.success, labelColor: colors.neutral[0] },
  danger: { backgroundColor: colors.danger, labelColor: colors.neutral[0] },
  gold: { backgroundColor: colors.xpGold, labelColor: colors.neutral[900] },
};

const SIZES: Record<ClayButtonSize, { height: number; fontSize: number; paddingH: number; radius: number }> = {
  m: { height: 48, fontSize: 16, paddingH: spacing.xl, radius: radii.m },
  l: { height: 56, fontSize: 18, paddingH: spacing.xxl, radius: radii.l },
};

/** Primary tappable: clay pill button with press spring + haptic. */
export function ClayButton({
  title,
  variant = 'primary',
  size = 'm',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ClayButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: v.backgroundColor,
          height: s.height,
          paddingHorizontal: s.paddingH,
          borderRadius: s.radius,
        },
        v.borderColor ? { borderWidth: 1.5, borderColor: v.borderColor } : undefined,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      <View pointerEvents="none" style={[styles.highlight, { borderRadius: s.radius / 2 }]} />
      {loading ? (
        <ActivityIndicator testID="clay-button-spinner" color={v.labelColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            numberOfLines={1}
            style={[styles.label, { color: v.labelColor, fontSize: s.fontSize }]}
          >
            {title}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  label: {
    fontFamily: fonts.heading,
  },
  highlight: {
    position: 'absolute',
    top: 3,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: clayHighlight,
  },
});
