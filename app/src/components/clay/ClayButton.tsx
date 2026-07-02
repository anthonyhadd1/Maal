import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale, type PressableScaleProps } from '@/components/layout/PressableScale';
import { colors, fonts, gradients, radii, spacing } from '@/theme/tokens';

export type ClayButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'gold'
  /** White pill with violet label — CTAs sitting on brand gradients. */
  | 'inverted'
  /** Translucent white outline — secondary action on brand gradients. */
  | 'ghost';
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
  /** Darker bottom "clay edge" (the pressed-down 3D lip). */
  edgeColor: string;
  borderColor?: string;
  /** Skip the white top sheen (pointless on white/translucent buttons). */
  sheen?: boolean;
  spinnerColor?: string;
}

const VARIANTS: Record<ClayButtonVariant, VariantStyle> = {
  primary: {
    backgroundColor: colors.primary[600],
    labelColor: colors.neutral[0],
    edgeColor: colors.primary[800],
  },
  secondary: {
    backgroundColor: colors.neutral[0],
    labelColor: colors.primary[600],
    edgeColor: colors.neutral[300],
    borderColor: colors.neutral[200],
    sheen: false,
  },
  success: {
    backgroundColor: colors.successDeep,
    labelColor: colors.neutral[0],
    edgeColor: colors.successEdge,
  },
  danger: {
    backgroundColor: colors.dangerDeep,
    labelColor: colors.neutral[0],
    edgeColor: colors.dangerEdge,
  },
  gold: {
    backgroundColor: colors.xpGold,
    labelColor: colors.neutral[900],
    edgeColor: colors.goldDeep,
    spinnerColor: colors.neutral[900],
  },
  inverted: {
    backgroundColor: colors.neutral[0],
    labelColor: colors.primary[700],
    edgeColor: colors.primary[200],
    sheen: false,
  },
  ghost: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    labelColor: colors.neutral[0],
    edgeColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
    sheen: false,
  },
};

const EDGE = 4;

const SIZES: Record<ClayButtonSize, { height: number; fontSize: number; paddingH: number; radius: number }> = {
  m: { height: 48, fontSize: 16, paddingH: spacing.xl, radius: radii.m },
  l: { height: 56, fontSize: 18, paddingH: spacing.xxl, radius: radii.l },
};

/**
 * Primary tappable: claymorphic 3D pill — solid face, darker bottom edge,
 * soft top sheen, press spring (translates down onto its edge) + haptic.
 */
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
      pressedTranslateY={EDGE - 1}
      style={[
        styles.base,
        {
          backgroundColor: v.backgroundColor,
          height: s.height + EDGE,
          paddingHorizontal: s.paddingH,
          borderRadius: s.radius,
          borderBottomWidth: EDGE,
          borderBottomColor: v.edgeColor,
        },
        v.borderColor
          ? { borderWidth: 1.5, borderColor: v.borderColor, borderBottomWidth: EDGE, borderBottomColor: v.edgeColor }
          : undefined,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {v.sheen !== false ? (
        <LinearGradient
          colors={gradients.sheen}
          pointerEvents="none"
          style={[
            styles.sheen,
            { borderTopLeftRadius: s.radius, borderTopRightRadius: s.radius },
          ]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator testID="clay-button-spinner" color={v.spinnerColor ?? v.labelColor} />
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
    overflow: 'hidden',
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
    letterSpacing: 0.2,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
});
