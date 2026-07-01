import { Eye, EyeOff } from 'lucide-react-native';
import { forwardRef, useState } from 'react';
import {
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

import { colors, radii, spacing, typography } from '@/theme/tokens';

export interface ClayInputProps extends TextInputProps {
  /** Visible label above the field (never placeholder-only). */
  label: string;
  error?: string | null;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Labeled text input on an inset ("pressed clay") surface.
 * - label always visible above the field
 * - error text below in danger red
 * - built-in show/hide toggle for secure entry
 */
export const ClayInput = forwardRef<TextInput, ClayInputProps>(function ClayInput(
  { label, error, hint, secureTextEntry, containerStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const { t } = useTranslation('common');
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureTextEntry);

  const borderColor = error ? colors.danger : focused ? colors.primary[500] : 'transparent';

  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.field,
          { borderColor },
          focused && styles.fieldFocused,
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={colors.neutral[500]}
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
              <Eye color={colors.neutral[500]} size={20} />
            ) : (
              <EyeOff color={colors.neutral[500]} size={20} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.s,
    borderWidth: 1.5,
    minHeight: 52,
    paddingHorizontal: spacing.l,
  },
  fieldFocused: {
    backgroundColor: colors.neutral[0],
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.neutral[900],
    paddingVertical: spacing.m,
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
});
