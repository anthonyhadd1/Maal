import { LogOut, Mail } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useLogout, useMe } from '@/api/queries/auth';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayCard } from '@/components/clay/ClayCard';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/layout/Screen';
import { formatDate } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/** TAB 4 « Profil » — renders real /me/ data + logout. */
export function ProfileScreen() {
  const { t } = useTranslation('profile');
  const me = useMe();
  const logout = useLogout();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('title')}
        </Text>
      </View>

      {me.isPending ? (
        <ProfileSkeleton />
      ) : me.isError ? (
        <ErrorState onRetry={() => void me.refetch()} retrying={me.isRefetching} />
      ) : (
        <>
          <ClayCard style={styles.card}>
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {(me.data.profile.display_name || me.data.username).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.identity}>
                <Text numberOfLines={1} style={styles.displayName}>
                  {me.data.profile.display_name || me.data.username}
                </Text>
                <Text numberOfLines={1} style={styles.username}>
                  {t('usernamePrefix', { username: me.data.username })}
                </Text>
                <Text style={styles.memberSince}>
                  {t('memberSince', { date: formatDate(me.data.date_joined) })}
                </Text>
              </View>
            </View>
          </ClayCard>

          <ClayCard style={styles.card}>
            <View style={styles.row}>
              <Mail color={colors.neutral[500]} size={20} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{t('email')}</Text>
                <Text numberOfLines={1} style={styles.rowValue}>
                  {me.data.email || t('noEmail')}
                </Text>
              </View>
            </View>
          </ClayCard>

          <ClayButton
            fullWidth
            icon={<LogOut color={colors.neutral[0]} size={20} />}
            loading={logout.isPending}
            onPress={() => logout.mutate()}
            size="l"
            style={styles.logout}
            testID="profile-logout"
            title={t('logout')}
            variant="danger"
          />
        </>
      )}
    </Screen>
  );
}

function ProfileSkeleton() {
  return (
    <View style={styles.skeletonGroup}>
      <View style={styles.skeletonRow}>
        <Skeleton height={64} radius={radii.pill} width={64} />
        <View style={styles.skeletonLines}>
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} width="45%" />
          <Skeleton height={14} width="55%" />
        </View>
      </View>
      <Skeleton height={72} radius={radii.l} />
      <Skeleton height={56} radius={radii.l} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.l,
  },
  title: {
    ...typography.h1,
    color: colors.neutral[900],
  },
  card: {
    marginBottom: spacing.l,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    ...typography.h1,
    color: colors.primary[600],
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    ...typography.h2,
    color: colors.neutral[900],
  },
  username: {
    ...typography.small,
    color: colors.neutral[500],
  },
  memberSince: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  rowValue: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  logout: {
    marginTop: spacing.s,
  },
  skeletonGroup: {
    gap: spacing.l,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.l,
  },
  skeletonLines: {
    flex: 1,
    gap: spacing.s,
  },
});
