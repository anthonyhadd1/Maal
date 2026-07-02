import type { FriendshipStatus } from '@/api/types';
import { searchRowAction } from '@/features/friends/friendshipActions';

describe('searchRowAction (friendship_status → row action)', () => {
  test.each<[FriendshipStatus, ReturnType<typeof searchRowAction>]>([
    ['none', 'add'],
    ['pending_out', 'sent'],
    ['pending_in', 'accept'],
    ['friends', 'friends'],
  ])('%s → %s', (status, expected) => {
    expect(searchRowAction(status)).toBe(expected);
  });
});
