import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { withAlpha } from '@/lib/color';
import { colors, focusRing, radii, spacing, typography } from '@/theme/tokens';

// Edge (Chromium) renders its own native reveal-password icon inside
// type="password" inputs via the legacy ::-ms-reveal pseudo-element it kept
// for IE compat — left alone it doubles up with our own Eye/EyeOff toggle.
// Web only; native iOS/Android render a real SecureTextEntry field, not a
// DOM <input>, so there's nothing to suppress there.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'clay-input-suppress-ms-reveal';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-ms-clear {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }
}

export interface ClayInputProps extends TextInputProps {
  /** Visible label above the field (never placeholder-only). */
  label: string;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Dark-surface variant — a translucent "glass" field instead of solid
   * white, for screens on the near-black auth/marketing background. Every
   * other screen (the light clay study app) is unaffected; this only
   * activates when explicitly passed.
   */
  dark?: boolean;
}

/**
 * Labeled text input on an inset ("pressed clay") surface.
 * - label always visible above the field
 * - error text below in danger red
 * - built-in show/hide toggle for secure entry
 */
export const ClayInput = forwardRef<TextInput, ClayInputProps>(function ClayInput(
  { label, error, hint, secureTextEntry, containerStyle, dark, onFocus, onBlur, ...rest },
  ref,
) {
  const { t } = useTranslation('common');
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary[dark ? 400 : 500]
      : dark
        ? withAlpha(colors.neutral[0], 0.16)
        : colors.neutral[200];

  return (
    <View style={containerStyle}>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      <View
        style={[
          styles.field,
          dark && styles.fieldDark,
          { borderColor },
          focused && (dark ? styles.fieldFocusedDark : styles.fieldFocused),
          error ? styles.fieldError : null,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          style={[styles.input, dark && styles.inputDark]}
          placeholderTextColor={dark ? withAlpha(colors.neutral[0], 0.4) : colors.neutral[500]}
          secureTextEntry={secureTextEntry ? hidden : false}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? 'a11y.showPassword' : 'a11y.hidePassword')}
            hitSlop={spacing.s}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            {hidden ? (
              <Eye color={dark ? withAlpha(colors.neutral[0], 0.6) : colors.neutral[500]} size={20} />
            ) : (
              <EyeOff color={dark ? withAlpha(colors.neutral[0], 0.6) : colors.neutral[500]} size={20} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.hint, dark && styles.hintDark]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    marginBottom: spacing.xs,
  },
  labelDark: {
    color: withAlpha(colors.neutral[0], 0.78),
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: radii.s + 2,
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    minHeight: 52,
    paddingHorizontal: spacing.l,
  },
  fieldDark: {
    backgroundColor: withAlpha(colors.neutral[0], 0.06),
  },
  fieldFocused: {
    backgroundColor: colors.neutral[0],
    ...focusRing,
  },
  fieldFocusedDark: {
    backgroundColor: withAlpha(colors.neutral[0], 0.09),
  },
  fieldError: {
    backgroundColor: colors.danger + '0D',
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.neutral[900],
    paddingVertical: spacing.m,
    // The clay focus ring replaces the UA outline on web. RN's TextStyle
    // typing doesn't know the react-native-web-only 'none' value.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as object) : null),
  },
  inputDark: {
    color: colors.neutral[0],
  },
  eye: {
    padding: spacing.xs,
    marginLeft: spacing.s,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.neutral[500],
    marginTop: spacing.xs,
  },
  hintDark: {
    color: withAlpha(colors.neutral[0], 0.55),
  },
});
