import type { FriendshipStatus } from '@/api/types';

/**
 * User-search result → which action the row shows
 * (Ajouter / Demande envoyée / Accepter / Amis ✓).
 */
export type SearchRowAction = 'add' | 'sent' | 'accept' | 'friends';

export function searchRowAction(status: FriendshipStatus): SearchRowAction {
  switch (status) {
    case 'none':
      return 'add';
    case 'pending_out':
      return 'sent';
    case 'pending_in':
      return 'accept';
    case 'friends':
      return 'friends';
  }
}
