import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '@/components/mascot/Mascot';
import type { MascotState } from '@/components/mascot/mascotStates';
import { colors, gradients, radii, spacing, typography } from '@/theme/tokens';

interface AuthSheetProps {
  title: string;
  subtitle: string;
  mascotState?: MascotState;
}

/**
 * Auth screen shell: brand gradient header band with the mascot peeking
 * over a white sheet (rounded top corners) that hosts the form.
 */
export function AuthSheet({
  title,
  subtitle,
  mascotState = 'idle',
  children,
}: PropsWithChildren<AuthSheetProps>) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradients.brand}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.blob, styles.blobA]} />
      <View pointerEvents="none" style={[styles.blob, styles.blobB]} />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.grow}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Mascot size={124} state={mascotState} style={styles.mascot} />
            </View>
            <View style={styles.sheet}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary[600],
  },
  safe: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[0],
  },
  blobA: {
    width: 220,
    height: 220,
    top: -80,
    right: -70,
    opacity: 0.1,
  },
  blobB: {
    width: 150,
    height: 150,
    top: 60,
    left: -70,
    opacity: 0.08,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.s,
  },
  mascot: {
    // The chick peeks over the sheet edge.
    marginBottom: -30,
    zIndex: 2,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.neutral[50],
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.s,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral[700],
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});
