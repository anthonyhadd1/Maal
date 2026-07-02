import { useRouter } from 'expo-router';
import { Check, EllipsisVertical, Search, Swords, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
} from '@/api/queries/friends';
import { useChallenges } from '@/api/queries/challenges';
import type { Friend } from '@/api/types';
import { ClayIconButton } from '@/components/clay/ClayIconButton';
import { ClayDialog } from '@/components/feedback/ClayDialog';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Avatar } from '@/components/game/Avatar';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { effectiveChallengeStatus } from '@/features/friends/challengeStatus';
import { ChallengeSheet } from '@/features/friends/ChallengeSheet';
import { formatNumber } from '@/lib/format';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * PUSH /friends — requests (accept/decline), friends list with
 * Défier / Retirer actions, header buttons to search + challenges inbox.
 */
export function FriendsScreen() {
  const { t } = useTranslation('friends');
  const { t: tErrors } = useTranslation('errors');
  const router = useRouter();
  const toast = useToast();

  const friends = useFriends();
  const requests = useFriendRequests();
  const challenges = useChallenges();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const removeFriend = useRemoveFriend();

  const [actionsFor, setActionsFor] = useState<Friend | null>(null);
  const [removing, setRemoving] = useState<Friend | null>(null);
  const [challenging, setChallenging] = useState<Friend | null>(null);

  const pendingChallenges =
    challenges.data?.incoming.filter(
      (c) => effectiveChallengeStatus(c.status, c.expires_at) === 'pending',
    ).length ?? 0;

  const onError = () => toast.show({ type: 'error', message: tErrors('server') });

  const confirmRemove = () => {
    if (!removing) return;
    removeFriend.mutate(removing.user_id, {
      onSuccess: () => setRemoving(null),
      onError: () => {
        setRemoving(null);
        onError();
      },
    });
  };

  return (
    <Screen scroll>
      <ScreenHeader
        right={
          <>
            <ClayIconButton
              accessibilityLabel={t('search.title')}
              onPress={() => router.push('/friends/search')}
              size={40}
              testID="friends-search-btn"
            >
              <Search color={colors.neutral[700]} size={20} />
            </ClayIconButton>
            <View>
              <ClayIconButton
                accessibilityLabel={t('challenges.title')}
                onPress={() => router.push('/friends/challenges')}
                size={40}
                testID="friends-challenges-btn"
              >
                <Swords color={colors.neutral[700]} size={20} />
              </ClayIconButton>
              {pendingChallenges > 0 ? (
                <View style={styles.badge} testID="challenges-badge">
                  <Text style={styles.badgeText}>{pendingChallenges}</Text>
                </View>
              ) : null}
            </View>
          </>
        }
        title={t('title')}
      />

      {/* Requests */}
      {requests.data &&
      (requests.data.incoming.length > 0 || requests.data.outgoing.length > 0) ? (
        <>
          <Text style={styles.sectionTitle}>{t('requests.title')}</Text>
          <View style={styles.section} testID="requests-section">
            {requests.data.incoming.map((request) => (
              <View key={`in-${request.id}`} style={styles.row} testID={`request-in-${request.id}`}>
                <Avatar
                  avatarId={request.from.avatar_id}
                  name={request.from.display_name || request.from.username}
                  size={44}
                />
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {request.from.display_name || request.from.username}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>
                    @{request.from.username}
                  </Text>
                </View>
                <ClayIconButton
                  accessibilityLabel={t('requests.accept')}
                  backgroundColor={colors.success}
                  onPress={() => acceptRequest.mutate(request.id, { onError })}
                  size={38}
                  testID={`accept-${request.id}`}
                >
                  <Check color={colors.neutral[0]} size={18} strokeWidth={3} />
                </ClayIconButton>
                <ClayIconButton
                  accessibilityLabel={t('requests.decline')}
                  onPress={() => declineRequest.mutate(request.id, { onError })}
                  size={38}
                  testID={`decline-${request.id}`}
                >
                  <X color={colors.danger} size={18} strokeWidth={3} />
                </ClayIconButton>
              </View>
            ))}
            {requests.data.outgoing.map((request) => (
              <View key={`out-${request.id}`} style={styles.row} testID={`request-out-${request.id}`}>
                <Avatar
                  avatarId={request.to.avatar_id}
                  name={request.to.display_name || request.to.username}
                  size={44}
                />
                <View style={styles.rowBody}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {request.to.display_name || request.to.username}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowMeta}>
                    @{request.to.username}
                  </Text>
                </View>
                <View style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>{t('requests.pending')}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Friends list */}
      <Text style={styles.sectionTitle}>{t('list.title')}</Text>
      {friends.isPending ? (
        <View style={styles.section} testID="friends-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton height={64} key={i} radius={radii.m} width="100%" />
          ))}
        </View>
      ) : friends.isError ? (
        <ErrorState onRetry={() => void friends.refetch()} retrying={friends.isRefetching} />
      ) : friends.data.length === 0 ? (
        <EmptyState
          cta={{ label: t('empty.cta'), onPress: () => router.push('/friends/search') }}
          mascotState="idle"
          message={t('empty.message')}
          title={t('empty.title')}
        />
      ) : (
        <View style={styles.section} testID="friends-list">
          {friends.data.map((friend) => (
            <View key={friend.user_id} style={styles.row} testID={`friend-${friend.user_id}`}>
              <Avatar
                avatarId={friend.avatar_id}
                name={friend.display_name || friend.username}
                size={44}
              />
              <View style={styles.rowBody}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {friend.display_name || friend.username}
                </Text>
                <Text numberOfLines={1} style={styles.rowMeta}>
                  {t('list.xpWeek', { xp: formatNumber(friend.xp_week) })}
                </Text>
              </View>
              <ClayIconButton
                accessibilityLabel={t('actions.more', {
                  name: friend.display_name || friend.username,
                })}
                onPress={() => setActionsFor(friend)}
                size={38}
                testID={`friend-actions-${friend.user_id}`}
              >
                <EllipsisVertical color={colors.neutral[500]} size={18} />
              </ClayIconButton>
            </View>
          ))}
        </View>
      )}

      {/* Overflow actions: Défier / Retirer */}
      <ClayDialog
        actions={[
          {
            label: t('actions.challenge'),
            onPress: () => {
              setChallenging(actionsFor);
              setActionsFor(null);
            },
            variant: 'primary',
            testID: 'action-challenge',
          },
          {
            label: t('actions.remove'),
            onPress: () => {
              setRemoving(actionsFor);
              setActionsFor(null);
            },
            variant: 'danger',
            testID: 'action-remove',
          },
          {
            label: t('actions.cancel'),
            onPress: () => setActionsFor(null),
            variant: 'secondary',
          },
        ]}
        onRequestClose={() => setActionsFor(null)}
        title={actionsFor ? actionsFor.display_name || actionsFor.username : ''}
        visible={actionsFor != null}
      />

      {/* Remove confirm */}
      <ClayDialog
        actions={[
          {
            label: t('remove.confirm'),
            onPress: confirmRemove,
            variant: 'danger',
            loading: removeFriend.isPending,
            testID: 'remove-confirm',
          },
          {
            label: t('actions.cancel'),
            onPress: () => setRemoving(null),
            variant: 'secondary',
          },
        ]}
        message={t('remove.body')}
        onRequestClose={() => setRemoving(null)}
        title={t('remove.title', {
          name: removing ? removing.display_name || removing.username : '',
        })}
        visible={removing != null}
      />

      {/* Level picker → POST /challenges/ */}
      <ChallengeSheet friend={challenging} onClose={() => setChallenging(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.h2,
    color: colors.neutral[900],
    marginBottom: spacing.m,
  },
  section: {
    gap: spacing.s,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowName: {
    ...typography.bodyMedium,
    color: colors.neutral[900],
  },
  rowMeta: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  pendingChip: {
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  pendingChipText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.neutral[0],
  },
});
