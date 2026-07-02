import type {
  ChallengeDetail,
  ChallengeStatus,
  IncomingChallenge,
  OutgoingChallenge,
  PublicUser,
} from '@/api/types';

/**
 * Pure challenge presentation logic (design_gameplay.md §6):
 * status → chip + available action, with LAZY expiry — a `pending` challenge
 * whose `expires_at` is in the past renders as expired without waiting for
 * the server to sweep it.
 */

export type ChallengeDirection = 'incoming' | 'outgoing';

export type ChallengeChip =
  | 'pending'
  | 'inProgress'
  | 'expired'
  | 'declined'
  | 'won'
  | 'lost'
  | 'tie';

export type ChallengeAction = 'acceptDecline' | 'play' | 'detail' | 'none';

/** Lazy expiry: pending + past expires_at → expired (48 h window, §6). */
export function effectiveChallengeStatus(
  status: ChallengeStatus,
  expiresAt: string,
  now: number = Date.now(),
): ChallengeStatus {
  if (status === 'pending') {
    const expiry = Date.parse(expiresAt);
    if (Number.isFinite(expiry) && expiry <= now) return 'expired';
  }
  return status;
}

interface ChipInput {
  status: ChallengeStatus;
  expires_at: string;
  winner_username: string | null;
}

/** Status → chip key (completed resolves to won/lost/tie for `myUsername`). */
export function challengeChip(
  challenge: ChipInput,
  myUsername: string,
  now: number = Date.now(),
): ChallengeChip {
  const status = effectiveChallengeStatus(challenge.status, challenge.expires_at, now);
  switch (status) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'inProgress';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'completed':
      if (challenge.winner_username == null) return 'tie';
      return challenge.winner_username === myUsername ? 'won' : 'lost';
  }
}

/** What the card lets you do. Incoming pending → accept/decline; accepted → play. */
export function challengeAction(
  direction: ChallengeDirection,
  challenge: ChipInput,
  now: number = Date.now(),
): ChallengeAction {
  const status = effectiveChallengeStatus(challenge.status, challenge.expires_at, now);
  if (status === 'completed') return 'detail';
  if (direction === 'incoming' && status === 'pending') return 'acceptDecline';
  if (direction === 'incoming' && status === 'accepted') return 'play';
  return 'none';
}

// ---------------------------------------------------------------------------
// Orientation: « the other player vs me » regardless of direction
// ---------------------------------------------------------------------------

export interface OrientedChallenge {
  other: PublicUser;
  /** My score first (mine–theirs) — null until completion. */
  myScore: number | null;
  otherScore: number | null;
}

/** List cards: incoming → other = challenger; outgoing → other = opponent. */
export function orientChallenge(
  challenge: IncomingChallenge | OutgoingChallenge,
  direction: ChallengeDirection,
): OrientedChallenge {
  if (direction === 'incoming') {
    const c = challenge as IncomingChallenge;
    return { other: c.challenger, myScore: c.opponent_score, otherScore: c.challenger_score };
  }
  const c = challenge as OutgoingChallenge;
  return { other: c.opponent, myScore: c.challenger_score, otherScore: c.opponent_score };
}

export interface ChallengeOutcome {
  result: 'won' | 'lost' | 'tie';
  myScore: number;
  otherScore: number;
  otherName: string;
}

/**
 * Detail payload → resolved outcome for the results screen VS block.
 * Returns null until the challenge is completed / players are known.
 */
export function challengeOutcome(
  detail: Pick<
    ChallengeDetail,
    'status' | 'winner_username' | 'challenger_score' | 'opponent_score' | 'challenger' | 'opponent'
  >,
  myUsername: string,
): ChallengeOutcome | null {
  if (detail.status !== 'completed') return null;
  const { challenger, opponent } = detail;
  const meIsChallenger = challenger?.username === myUsername;
  const other = meIsChallenger ? opponent : challenger;
  if (!other) return null;
  const myScore = (meIsChallenger ? detail.challenger_score : detail.opponent_score) ?? 0;
  const otherScore = (meIsChallenger ? detail.opponent_score : detail.challenger_score) ?? 0;
  const result =
    detail.winner_username == null
      ? 'tie'
      : detail.winner_username === myUsername
        ? 'won'
        : 'lost';
  return { result, myScore, otherScore, otherName: other.display_name || other.username };
}
