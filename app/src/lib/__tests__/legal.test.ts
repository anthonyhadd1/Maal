/**
 * Legal links gate an App Store blocker, so the rules are worth pinning:
 * a link that goes nowhere is worse than no link (a reviewer taps it), and a
 * cleartext URL is blocked by App Transport Security on device — it would look
 * exactly like a broken link during review.
 */

function loadLegal(env: { privacy?: string; terms?: string }) {
  jest.resetModules();
  const prev = { ...process.env };
  if (env.privacy === undefined) delete process.env.EXPO_PUBLIC_PRIVACY_URL;
  else process.env.EXPO_PUBLIC_PRIVACY_URL = env.privacy;
  if (env.terms === undefined) delete process.env.EXPO_PUBLIC_TERMS_URL;
  else process.env.EXPO_PUBLIC_TERMS_URL = env.terms;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/lib/legal') as typeof import('@/lib/legal');
  process.env = prev;
  return mod;
}

describe('legal links', () => {
  test('both configured over https → links are shown', () => {
    const legal = loadLegal({
      privacy: 'https://ace.example/privacy',
      terms: 'https://ace.example/terms',
    });
    expect(legal.hasPrivacyLink()).toBe(true);
    expect(legal.hasLegalLinks()).toBe(true);
  });

  test('nothing configured → every legal affordance hides itself', () => {
    const legal = loadLegal({});
    expect(legal.hasPrivacyLink()).toBe(false);
    expect(legal.hasLegalLinks()).toBe(false);
  });

  test('privacy only → the privacy row shows, the paired links do not', () => {
    const legal = loadLegal({ privacy: 'https://ace.example/privacy' });
    expect(legal.hasPrivacyLink()).toBe(true);
    // The point-of-purchase pair needs BOTH (guideline 3.1.2).
    expect(legal.hasLegalLinks()).toBe(false);
  });

  test('cleartext http is rejected — ATS blocks it on device', () => {
    const legal = loadLegal({
      privacy: 'http://ace.example/privacy',
      terms: 'http://ace.example/terms',
    });
    expect(legal.hasPrivacyLink()).toBe(false);
    expect(legal.hasLegalLinks()).toBe(false);
  });

  test('a blank or whitespace value counts as unset, not as a link', () => {
    expect(loadLegal({ privacy: '', terms: '' }).hasLegalLinks()).toBe(false);
    expect(loadLegal({ privacy: '   ', terms: '   ' }).hasPrivacyLink()).toBe(false);
  });

  test('opening an unusable URL is a no-op rather than a crash', async () => {
    const legal = loadLegal({});
    await expect(legal.openLegal('')).resolves.toBeUndefined();
    await expect(legal.openLegal('http://nope.example')).resolves.toBeUndefined();
  });
});
