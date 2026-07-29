import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InkBackdrop } from '@/components/layout/InkBackdrop';
import { withAlpha } from '@/lib/color';
import { colors, radii, spacing, typography } from '@/theme/tokens';

interface AuthSheetProps {
  title: string;
  subtitle: string;
}

/**
 * Shared shell for the "getting set up" screens (login, register, forgot
 * password) — the same near-black/violet language as the welcome screen, but
 * lighter-weight: no hero mascot or medallion (this is a task the user wants
 * to get through quickly, not a first impression to linger on), just a
 * subtle glow for continuity and the form itself.
 */
export function AuthSheet({ title, subtitle, children }: PropsWithChildren<AuthSheetProps>) {
  return (
    <View style={styles.root}>
      <InkBackdrop glowOpacity={0.22} glowSize={420} glowTop="-4%" />

      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.grow}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
              <View style={styles.accentRule} />
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={styles.content}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.inkBottom,
  },
  safe: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 30,
    color: colors.neutral[0],
    textAlign: 'center',
  },
  accentRule: {
    width: 36,
    height: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[400],
    marginTop: spacing.m,
    marginBottom: spacing.m,
  },
  subtitle: {
    ...typography.body,
    color: withAlpha(colors.neutral[0], 0.68),
    textAlign: 'center',
    maxWidth: 300,
  },
  // Centers the form vertically in whatever space is left below the header
  // — a short form (login: 2 fields) previously sat pinned to the top with
  // its footer link forced to the bottom edge via flexGrow, leaving a bare
  // void between them on any screen taller than the form itself. Content
  // taller than the space (register's longer form) just flows normally.
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
