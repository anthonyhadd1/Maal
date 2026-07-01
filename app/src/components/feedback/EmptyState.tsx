import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ClayButton } from '@/components/clay/ClayButton';
import { Mascot } from '@/components/mascot/Mascot';
import type { MascotState } from '@/components/mascot/mascotStates';
import { colors, spacing, typography } from '@/theme/tokens';

interface EmptyStateProps {
  title: string;
  message?: string;
  mascotState?: MascotState;
  cta?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
}

/** Centered mascot + message for empty screens, with an optional CTA. */
export function EmptyState({ title, message, mascotState = 'thinking', cta, style }: EmptyStateProps) {
  return (
    <View style={[styles.root, style]}>
      <Mascot size={140} state={mascotState} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {cta ? (
        <ClayButton onPress={cta.onPress} style={styles.cta} title={cta.label} variant="primary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.m,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
    marginTop: spacing.s,
  },
  message: {
    ...typography.body,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.m,
  },
});
