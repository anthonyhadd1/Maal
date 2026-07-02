import {
  challengeAction,
  challengeChip,
  challengeOutcome,
  effectiveChallengeStatus,
  orientChallenge,
} from '@/features/friends/challengeStatus';
import {
  challengeDetailCompleted,
  incomingChallenge,
  MY_USERNAME,
  outgoingChallenge,
} from '@/test/fixtures/social';

const NOW = Date.parse('2026-07-02T12:00:00Z');
const FUTURE = '2026-07-03T12:00:00Z';
const PAST = '2026-07-01T12:00:00Z';

describe('effectiveChallengeStatus (lazy 48 h expiry)', () => {
  test('pending + future expiry stays pending', () => {
    expect(effectiveChallengeStatus('pending', FUTURE, NOW)).toBe('pending');
  });

  test('pending + past expiry renders as expired WITHOUT a server sweep', () => {
    expect(effectiveChallengeStatus('pending', PAST, NOW)).toBe('expired');
  });

  test('only pending expires lazily (accepted/completed keep their status)', () => {
    expect(effectiveChallengeStatus('accepted', PAST, NOW)).toBe('accepted');
    expect(effectiveChallengeStatus('completed', PAST, NOW)).toBe('completed');
  });
});

describe('challengeChip', () => {
  test('pending / accepted / declined map to their chips', () => {
    expect(challengeChip(incomingChallenge({ expires_at: FUTURE }), MY_USERNAME, NOW)).toBe(
      'pending',
    );
    expect(
      challengeChip(incomingChallenge({ status: 'accepted' }), MY_USERNAME, NOW),
    ).toBe('inProgress');
    expect(
      challengeChip(incomingChallenge({ status: 'declined' }), MY_USERNAME, NOW),
    ).toBe('declined');
  });

  test('lazy-expired pending renders the expired chip', () => {
    expect(challengeChip(incomingChallenge({ expires_at: PAST }), MY_USERNAME, NOW)).toBe(
      'expired',
    );
  });

  test('completed resolves to won / lost / tie for me', () => {
    const base = { status: 'completed' as const, expires_at: FUTURE };
    expect(
      challengeChip({ ...base, winner_username: MY_USERNAME }, MY_USERNAME, NOW),
    ).toBe('won');
    expect(challengeChip({ ...base, winner_username: 'rita.k' }, MY_USERNAME, NOW)).toBe('lost');
    expect(challengeChip({ ...base, winner_username: null }, MY_USERNAME, NOW)).toBe('tie');
  });
});

describe('challengeAction', () => {
  test('incoming pending → accept/decline; after accept → play', () => {
    expect(challengeAction('incoming', incomingChallenge({ expires_at: FUTURE }), NOW)).toBe(
      'acceptDecline',
    );
    expect(
      challengeAction('incoming', incomingChallenge({ status: 'accepted' }), NOW),
    ).toBe('play');
  });

  test('lazy-expired incoming pending offers NO action', () => {
    expect(challengeAction('incoming', incomingChallenge({ expires_at: PAST }), NOW)).toBe('none');
  });

  test('outgoing pending/accepted are wait-states; completed opens the detail', () => {
    expect(challengeAction('outgoing', outgoingChallenge({ expires_at: FUTURE }), NOW)).toBe(
      'none',
    );
    expect(
      challengeAction('outgoing', outgoingChallenge({ status: 'accepted' }), NOW),
    ).toBe('none');
    expect(
      challengeAction('outgoing', outgoingChallenge({ status: 'completed' }), NOW),
    ).toBe('detail');
    expect(
      challengeAction('incoming', incomingChallenge({ status: 'completed' }), NOW),
    ).toBe('detail');
  });
});

describe('orientChallenge (other player vs me)', () => {
  test('incoming: other = challenger, my score = opponent_score', () => {
    const oriented = orientChallenge(
      incomingChallenge({ status: 'completed', challenger_score: 6, opponent_score: 8 }),
      'incoming',
    );
    expect(oriented.other.username).toBe('rita.k');
    expect(oriented.myScore).toBe(8);
    expect(oriented.otherScore).toBe(6);
  });

  test('outgoing: other = opponent, my score = challenger_score', () => {
    const oriented = orientChallenge(
      outgoingChallenge({ status: 'completed', challenger_score: 9, opponent_score: 5 }),
      'outgoing',
    );
    expect(oriented.other.username).toBe('karim');
    expect(oriented.myScore).toBe(9);
    expect(oriented.otherScore).toBe(5);
  });
});

describe('challengeOutcome (results-screen VS block)', () => {
  test('completed detail resolves winner, scores oriented mine-first, other name', () => {
    const outcome = challengeOutcome(challengeDetailCompleted(), MY_USERNAME);
    expect(outcome).toEqual({
      result: 'won',
      myScore: 8,
      otherScore: 6,
      otherName: 'Rita',
    });
  });

  test('loss and tie resolve from winner_username', () => {
    expect(
      challengeOutcome(challengeDetailCompleted({ winner_username: 'rita.k' }), MY_USERNAME)
        ?.result,
    ).toBe('lost');
    expect(
      challengeOutcome(challengeDetailCompleted({ winner_username: null }), MY_USERNAME)?.result,
    ).toBe('tie');
  });

  test('null until completed (server still resolving)', () => {
    expect(
      challengeOutcome(challengeDetailCompleted({ status: 'accepted' }), MY_USERNAME),
    ).toBeNull();
  });
});
