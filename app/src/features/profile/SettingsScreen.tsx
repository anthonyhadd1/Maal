import Constants from 'expo-constants';
import { ExternalLink, FileText, LogOut, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLogout, useMe } from '@/api/queries/auth';
import { useMeGame } from '@/api/queries/game';
import { useDeleteAccount, usePatchMe } from '@/api/queries/profile';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { ClayInput } from '@/components/clay/ClayInput';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Avatar, AVATAR_PRESET_IDS } from '@/components/game/Avatar';
import { PressableScale } from '@/components/layout/PressableScale';
import { Screen } from '@/components/layout/Screen';
import {
  PRIVACY_URL,
  TERMS_URL,
  hasLegalLinks,
  hasPrivacyLink,
  openLegal,
} from '@/lib/legal';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n';
import { cancelStreakReminders, scheduleStreakReminders } from '@/lib/notifications';
import { useSettingsStore } from '@/stores/settingsStore';
import { colors, fonts, radii, spacing, typography } from '@/theme/tokens';
import { tints } from '@/theme/tints';

/**
 * PUSH /profile/settings — Compte (name + avatar), Préférences (sons,
 * haptique, animations, langue), Ligue (opt-in), Zone de danger (logout,
 * delete in two steps). Version footer from expo-constants.
 */
export function SettingsScreen() {
  const { t } = useTranslation('profile');
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();
  const me = useMe();
  const game = useMeGame();
  const patchMe = usePatchMe();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();

  // --- Compte ---------------------------------------------------------------
  const [displayName, setDisplayName] = useState('');
  useEffect(() => {
    if (me.data) setDisplayName(me.data.profile.display_name);
  }, [me.data]);
  const nameDirty =
    me.data != null && displayName.trim() !== me.data.profile.display_name.trim();

  const saveDisplayName = () => {
    if (!nameDirty || patchMe.isPending) return;
    patchMe.mutate(
      { profile: { display_name: displayName.trim() } },
      {
        onSuccess: () => toast.show({ type: 'success', message: t('settings.saved') }),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  const pickAvatar = (avatarId: string) => {
    if (patchMe.isPending || avatarId === me.data?.profile.avatar_id) return;
    patchMe.mutate(
      { profile: { avatar_id: avatarId } },
      {
        onSuccess: () => toast.show({ type: 'success', message: t('settings.saved') }),
        onError: () => toast.show({ type: 'error', message: tErrors('server') }),
      },
    );
  };

  // --- Préférences ----------------------------------------------------------
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  const streakRemindersEnabled = useSettingsStore((s) => s.streakRemindersEnabled);
  const locale = useSettingsStore((s) => s.locale);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);
  const setStreakRemindersEnabled = useSettingsStore((s) => s.setStreakRemindersEnabled);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const { i18n } = useTranslation();
  const activeLocale = (locale ?? i18n.language) as SupportedLocale;

  /** « Rappels de série » — off cancels everything, on reschedules now. */
  const toggleStreakReminders = (value: boolean) => {
    setStreakRemindersEnabled(value);
    if (value) {
      void scheduleStreakReminders(game.data?.streak_current ?? 0);
    } else {
      void cancelStreakReminders();
    }
  };

  // --- Ligue ----------------------------------------------------------------
  const leaguesOptIn = me.data?.profile.leagues_opt_in ?? true;
  const toggleLeagues = (value: boolean) => {
    patchMe.mutate(
      { profile: { leagues_opt_in: value } },
      { onError: () => toast.show({ type: 'error', message: tErrors('server') }) },
    );
  };

  // --- Zone de danger ---------------------------------------------------------
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const confirmDelete = () => {
    deleteAccount.mutate(undefined, {
      onError: () => {
        setDeleteStep(0);
        toast.show({ type: 'error', message: tErrors('server') });
      },
    });
  };

  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} />

      {me.isPending ? (
        <SettingsSkeleton />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} retrying={me.isRefetching} />
      ) : (
        <>
          {/* Compte */}
          <Text style={styles.sectionTitle}>{t('settings.sections.account')}</Text>
          <ClayCard style={styles.card}>
            <ClayInput
              label={t('settings.displayName')}
              maxLength={40}
              onChangeText={setDisplayName}
              testID="settings-display-name"
              value={displayName}
            />
            {nameDirty ? (
              <ClayButton
                loading={patchMe.isPending}
                onPress={saveDisplayName}
                testID="settings-save-name"
                title={t('settings.save')}
              />
            ) : null}

            <Text style={styles.fieldLabel}>{t('settings.avatar')}</Text>
            <View style={styles.avatarGrid} testID="avatar-grid">
              {AVATAR_PRESET_IDS.map((id) => {
                const selected = me.data.profile.avatar_id === id;
                return (
                  <PressableScale
                    accessibilityLabel={t('settings.avatarOption', { id })}
                    accessibilityState={{ disabled: patchMe.isPending, selected }}
                    clay={false}
                    disabled={patchMe.isPending}
                    key={id}
                    onPress={() => pickAvatar(id)}
                    pressedTranslateY={2}
                    style={[
                      styles.avatarCell,
                      selected && styles.avatarCellSelected,
                      patchMe.isPending && styles.avatarCellDisabled,
                    ]}
                    testID={`avatar-option-${id}`}
                  >
                    <Avatar
                      avatarId={id}
                      name={me.data.profile.display_name || me.data.username}
                      size={48}
                    />
                  </PressableScale>
                );
              })}
            </View>
          </ClayCard>

          {/* Préférences */}
          <Text style={styles.sectionTitle}>{t('settings.sections.preferences')}</Text>
          <ClayCard style={styles.card}>
            <ToggleRow
              label={t('settings.sound')}
              onValueChange={setSoundEnabled}
              testID="toggle-sound"
              value={soundEnabled}
            />
            <ToggleRow
              label={t('settings.haptics')}
              onValueChange={setHapticsEnabled}
              testID="toggle-haptics"
              value={hapticsEnabled}
            />
            <ToggleRow
              label={t('settings.reduceMotion')}
              onValueChange={setReduceMotion}
              testID="toggle-reduce-motion"
              value={reduceMotion}
            />
            <ToggleRow
              label={t('settings.streakReminders')}
              onValueChange={toggleStreakReminders}
              testID="toggle-streak-reminders"
              value={streakRemindersEnabled}
            />

            <View style={styles.langRow}>
              <Text style={styles.rowLabel}>{t('settings.language')}</Text>
              <View style={styles.langPills}>
                {SUPPORTED_LOCALES.map((code) => {
                  const active = activeLocale === code;
                  return (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      clay={false}
                      hitSlop={{ top: 8, bottom: 8 }}
                      key={code}
                      onPress={() => setLocale(code)}
                      pressedTranslateY={2}
                      style={[styles.langPill, active && styles.langPillActive]}
                      testID={`lang-${code}`}
                    >
                      <Text style={[styles.langLabel, active && styles.langLabelActive]}>
                        {t(`settings.locales.${code}`)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </ClayCard>

          {/* Ligue */}
          <Text style={styles.sectionTitle}>{t('settings.sections.league')}</Text>
          <ClayCard style={styles.card}>
            <ToggleRow
              label={t('settings.leaguesOptIn')}
              onValueChange={toggleLeagues}
              testID="toggle-leagues"
              value={leaguesOptIn}
            />
          </ClayCard>

          {/* Légal — Apple requires the privacy policy and the terms to be
              reachable from INSIDE the binary, not only from the store
              listing. Hidden entirely when the URLs are not configured for
              this build: a legal row that goes nowhere is worse than none. */}
          {hasPrivacyLink() ? (
            <>
              <Text style={styles.sectionTitle}>{t('settings.sections.legal')}</Text>
              <ClayCard style={styles.card}>
                <PressableScale
                  accessibilityLabel={t('settings.privacy')}
                  accessibilityRole="link"
                  clay={false}
                  onPress={() => void openLegal(PRIVACY_URL)}
                  pressedTranslateY={2}
                  style={styles.legalRow}
                  testID="settings-privacy"
                >
                  <ShieldCheck color={colors.neutral[700]} size={20} />
                  <Text style={styles.legalRowLabel}>{t('settings.privacy')}</Text>
                  <ExternalLink color={colors.neutral[500]} size={16} />
                </PressableScale>
                {hasLegalLinks() ? (
                  <>
                    <View style={styles.dangerDivider} />
                    <PressableScale
                      accessibilityLabel={t('settings.terms')}
                      accessibilityRole="link"
                      clay={false}
                      onPress={() => void openLegal(TERMS_URL)}
                      pressedTranslateY={2}
                      style={styles.legalRow}
                      testID="settings-terms"
                    >
                      <FileText color={colors.neutral[700]} size={20} />
                      <Text style={styles.legalRowLabel}>{t('settings.terms')}</Text>
                      <ExternalLink color={colors.neutral[500]} size={16} />
                    </PressableScale>
                  </>
                ) : null}
              </ClayCard>
            </>
          ) : null}

          {/* Non-affiliation. The app names the USJ concours throughout; say
              plainly that it is not run by the university. */}
          <Text style={styles.disclaimer}>{t('settings.disclaimer')}</Text>

          {/* Zone de danger */}
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>
            {t('settings.sections.danger')}
          </Text>
          <ClayCard backgroundColor={tints.danger} highlight={false} style={[styles.card, styles.dangerCard]}>
            <PressableScale
              accessibilityLabel={t('logout')}
              clay={false}
              onPress={() => setLogoutVisible(true)}
              pressedTranslateY={2}
              style={styles.dangerRow}
              testID="settings-logout"
            >
              <LogOut color={colors.neutral[700]} size={20} />
              <Text style={styles.dangerRowLabel}>{t('logout')}</Text>
            </PressableScale>
            <View style={styles.dangerDivider} />
            <PressableScale
              accessibilityLabel={t('settings.deleteAccount')}
              clay={false}
              onPress={() => setDeleteStep(1)}
              pressedTranslateY={2}
              style={styles.dangerRow}
              testID="settings-delete"
            >
              <Trash2 color={colors.danger} size={20} />
              <Text style={[styles.dangerRowLabel, styles.deleteLabel]}>
                {t('settings.deleteAccount')}
              </Text>
            </PressableScale>
          </ClayCard>

          <Text style={styles.version} testID="settings-version">
            {t('settings.version', { version })}
          </Text>
        </>
      )}

      {/* Logout confirm */}
      <ClayDialog
        actions={[
          {
            label: t('logout'),
            onPress: () => {
              setLogoutVisible(false);
              logout.mutate();
            },
            variant: 'danger',
            testID: 'logout-confirm',
          },
          {
            label: t('settings.cancel'),
            onPress: () => setLogoutVisible(false),
            variant: 'secondary',
          },
        ]}
        message={t('settings.logoutConfirm.body')}
        onRequestClose={() => setLogoutVisible(false)}
        title={t('settings.logoutConfirm.title')}
        visible={logoutVisible}
      />

      {/* Delete account — step 1/2 (warning) */}
      <ClayDialog
        actions={[
          {
            label: t('settings.delete.confirm'),
            onPress: () => setDeleteStep(2),
            variant: 'danger',
            testID: 'delete-step-1',
          },
          {
            label: t('settings.cancel'),
            onPress: () => setDeleteStep(0),
            variant: 'secondary',
          },
        ]}
        mascotState="sad"
        message={t('settings.delete.body')}
        onRequestClose={() => setDeleteStep(0)}
        title={t('settings.delete.title')}
        visible={deleteStep === 1}
      />

      {/* Delete account — step 2/2 (final, irreversible) */}
      <ClayDialog
        actions={[
          {
            label: t('settings.delete.final'),
            onPress: confirmDelete,
            variant: 'danger',
            loading: deleteAccount.isPending,
            testID: 'delete-step-2',
          },
          {
            label: t('settings.cancel'),
            onPress: () => setDeleteStep(0),
            variant: 'secondary',
          },
        ]}
        message={t('settings.delete.confirmBody')}
        onRequestClose={() => setDeleteStep(0)}
        title={t('settings.delete.confirmTitle')}
        visible={deleteStep === 2}
      />
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        testID={testID}
        thumbColor={colors.neutral[0]}
        trackColor={{ false: colors.neutral[300], true: colors.primary[500] }}
        value={value}
      />
    </View>
  );
}

function SettingsSkeleton() {
  return (
    <View style={styles.skeleton} testID="settings-skeleton">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton height={112} key={i} radius={radii.l} width="100%" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.m,
  },
  dangerTitle: {
    color: tints.dangerText,
  },
  card: {
    gap: spacing.l,
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    ...typography.smallMedium,
    color: colors.neutral[700],
    marginBottom: -spacing.s,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  avatarCell: {
    borderRadius: radii.pill,
    padding: spacing.xs,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  avatarCellDisabled: {
    opacity: 0.5,
  },
  avatarCellSelected: {
    borderColor: colors.primary[500],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
    minHeight: 32,
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flexShrink: 1,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  langPills: {
    flexDirection: 'row',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    padding: spacing.xs,
  },
  langPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.xs,
  },
  langPillActive: {
    backgroundColor: colors.neutral[0],
  },
  langLabel: {
    ...typography.smallMedium,
    color: colors.neutral[500],
  },
  langLabelActive: {
    color: colors.primary[600],
  },
  dangerCard: {
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderBottomColor: 'rgba(185, 28, 28, 0.35)',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    minHeight: 48,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  legalRowLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
    flex: 1,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing.m,
    marginBottom: spacing.s,
    paddingHorizontal: spacing.m,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    minHeight: 44,
  },
  dangerRowLabel: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  deleteLabel: {
    color: tints.dangerText,
    fontFamily: fonts.bodyBold,
  },
  dangerDivider: {
    height: 1,
    backgroundColor: 'rgba(185, 28, 28, 0.18)',
  },
  version: {
    ...typography.caption,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingBottom: spacing.xl,
  },
  skeleton: {
    gap: spacing.l,
  },
});
