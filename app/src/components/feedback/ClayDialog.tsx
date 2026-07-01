import type { PropsWithChildren } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { ClayButton, type ClayButtonVariant } from '@/components/clay/ClayButton';
import { ClaySurface } from '@/components/clay/ClaySurface';
import { Mascot } from '@/components/mascot/Mascot';
import type { MascotState } from '@/components/mascot/mascotStates';
import { colors, scrim, spacing, typography } from '@/theme/tokens';

export interface ClayDialogAction {
  label: string;
  onPress: () => void;
  variant?: ClayButtonVariant;
  loading?: boolean;
  testID?: string;
}

export interface ClayDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  mascotState?: MascotState;
  actions: ClayDialogAction[];
  /** Android back / dismiss request. Omit to make the dialog blocking. */
  onRequestClose?: () => void;
}

/**
 * Centered clay confirmation dialog on a scrim — the in-brand replacement
 * for Alert.alert (quit-confirm, resume-session, out-of-hearts…).
 */
export function ClayDialog({
  visible,
  title,
  message,
  mascotState,
  actions,
  onRequestClose,
  children,
}: PropsWithChildren<ClayDialogProps>) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.scrim}>
        <ClaySurface radius="xl" shadow="floating" style={styles.card}>
          {mascotState ? <Mascot size={104} state={mascotState} /> : null}
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children}
          <View style={styles.actions}>
            {actions.map((action) => (
              <ClayButton
                fullWidth
                key={action.label}
                loading={action.loading}
                onPress={action.onPress}
                testID={action.testID}
                title={action.label}
                variant={action.variant ?? 'primary'}
              />
            ))}
          </View>
        </ClaySurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.m,
  },
  title: {
    ...typography.h2,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.m,
    marginTop: spacing.s,
  },
});
