import { BadgeCheck, Check, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  SEARCH_MIN_CHARS,
  useAcceptFriendRequest,
  useFriendRequests,
  useSendFriendRequest,
  useUserSearch,
} from '@/api/queries/friends';
import type { UserSearchResult } from '@/api/types';
import { ClayButton } from '@/components/clay/ClayButton';
import { ClayInput } from '@/components/clay/ClayInput';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { Avatar } from '@/components/game/Avatar';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { searchRowAction } from '@/features/friends/friendshipActions';
import { useDebouncedValue } from '@/features/friends/useDebouncedValue';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/**
 * PUSH /friends/search — debounced (300 ms, ≥ 2 chars) user search;
 * row action follows friendship_status (Ajouter / Demande envoyée /
 * Accepter / Amis ✓).
 */
export function FriendSearchScreen() {
  const { t } = useTranslation('friends');
  const { t: tErrors } = useTranslation('errors');
  const toast = useToast();

  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 300);
  const search = useUserSearch(debounced);
  const requests = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();

  /** Row currently mutating (send/accept) — per-row button spinner. */
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const tooShort = debounced.trim().length < SEARCH_MIN_CHARS;
  const onError = () => toast.show({ type: 'error', message: tErrors('server') });

  const add = (user: UserSearchResult) => {
    setBusyUserId(user.user_id);
    sendRequest.mutate(user.username, {
      onSettled: () => setBusyUserId(null),
      onError,
    });
  };

  const accept = (user: UserSearchResult) => {
    // pending_in → the matching incoming request carries the id we accept.
    const request = requests.data?.incoming.find((r) => r.from.user_id === user.user_id);
    if (!request) {
      void requests.refetch();
      onError();
      return;
    }
    setBusyUserId(user.user_id);
    acceptRequest.mutate(request.id, {
      onSettled: () => setBusyUserId(null),
      onError,
    });
  };

  return (
    <Screen>
      <ScreenHeader title={t('search.title')} />

      <ClayInput
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        hint={tooShort ? t('search.hint') : undefined}
        label={t('search.label')}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        returnKeyType="search"
        testID="friend-search-input"
        value={query}
      />

      <View style={styles.results}>
        {tooShort ? (
          <EmptyState
            mascotState="idle"
            message={t('search.promptMessage')}
            title={t('search.promptTitle')}
          />
        ) : search.isPending ? (
          <View style={styles.skeleton} testID="search-skeleton">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton height={64} key={i} radius={radii.m} width="100%" />
            ))}
          </View>
        ) : search.isError ? (
          <ErrorState onRetry={() => void search.refetch()} retrying={search.isRefetching} />
        ) : search.data.length === 0 ? (
          <EmptyState
            mascotState="thinking"
            message={t('search.emptyMessage')}
            title={t('search.empty', { q: debounced.trim() })}
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={search.data}
            keyExtractor={(item) => String(item.user_id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <SearchRow
                busy={busyUserId === item.user_id}
                onAccept={() => accept(item)}
                onAdd={() => add(item)}
                user={item}
              />
            )}
            showsVerticalScrollIndicator={false}
            testID="search-results"
          />
        )}
      </View>
    </Screen>
  );
}

function SearchRow({
  user,
  busy,
  onAdd,
  onAccept,
}: {
  user: UserSearchResult;
  busy: boolean;
  onAdd: () => void;
  onAccept: () => void;
}) {
  const { t } = useTranslation('friends');
  const action = searchRowAction(user.friendship_status);

  return (
    <View style={styles.row} testID={`search-row-${user.user_id}`}>
      <Avatar avatarId={user.avatar_id} name={user.display_name || user.username} size={44} />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowName}>
          {user.display_name || user.username}
        </Text>
        <Text numberOfLines={1} style={styles.rowMeta}>
          @{user.username}
        </Text>
      </View>

      {action === 'add' ? (
        <ClayButton
          icon={<UserPlus color={colors.neutral[0]} size={16} />}
          loading={busy}
          onPress={onAdd}
          testID={`add-${user.user_id}`}
          title={t('search.add')}
        />
      ) : action === 'accept' ? (
        <ClayButton
          icon={<Check color={colors.neutral[0]} size={16} strokeWidth={3} />}
          loading={busy}
          onPress={onAccept}
          testID={`accept-${user.user_id}`}
          title={t('requests.accept')}
          variant="success"
        />
      ) : action === 'sent' ? (
        <View style={styles.chip} testID={`sent-${user.user_id}`}>
          <Text style={styles.chipText}>{t('requests.sent')}</Text>
        </View>
      ) : (
        <View style={[styles.chip, styles.chipFriends]} testID={`friends-${user.user_id}`}>
          <BadgeCheck color={colors.success} size={16} />
          <Text style={[styles.chipText, styles.chipTextFriends]}>{t('search.friends')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  results: {
    flex: 1,
    marginTop: spacing.l,
  },
  listContent: {
    gap: spacing.s,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.neutral[0],
    borderRadius: radii.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderWidth: 1,
    borderColor: 'rgba(36, 31, 62, 0.05)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(36, 31, 62, 0.09)',
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
  },
  chipFriends: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1.5,
    borderColor: colors.success,
  },
  chipText: {
    ...typography.caption,
    color: colors.neutral[500],
  },
  chipTextFriends: {
    color: colors.successDeep,
  },
  skeleton: {
    gap: spacing.s,
  },
});
