import i18n, { detectInitialLocale, i18nReady } from '@/i18n';

beforeAll(async () => {
  await i18nReady;
});

beforeEach(async () => {
  if (i18n.language !== 'fr') {
    await i18n.changeLanguage('fr');
  }
});

describe('i18n', () => {
  test('initializes in French (device locale fr, fallback fr)', () => {
    expect(i18n.language).toBe('fr');
    expect(i18n.t('common:cta.start')).toBe("C'est parti !");
  });

  test('detectInitialLocale prefers the persisted choice, then device, then fr', () => {
    expect(detectInitialLocale('en')).toBe('en');
    expect(detectInitialLocale(null)).toBe('fr'); // mocked device locale = fr
    expect(detectInitialLocale('de')).toBe('fr'); // unsupported persisted value
  });

  test('French plural rules: 0 and 1 are singular, 2+ plural', () => {
    expect(i18n.t('common:level', { count: 0 })).toBe('0 niveau');
    expect(i18n.t('common:level', { count: 1 })).toBe('1 niveau');
    expect(i18n.t('common:level', { count: 2 })).toBe('2 niveaux');
    expect(i18n.t('common:streak.days', { count: 1 })).toBe('1 jour');
    expect(i18n.t('common:streak.days', { count: 30 })).toBe('30 jours');
  });

  test('interpolation renders gamified values', () => {
    expect(i18n.t('common:xp.amount', { xp: 26 })).toBe('+26 XP');
    expect(i18n.t('common:trophy.unlocked', { name: 'Sans-faute' })).toBe(
      'Trophée débloqué : Sans-faute !',
    );
    expect(i18n.t('session:hearts.empty.body', { time: '3 h 12' })).toContain('3 h 12');
  });

  test('all 8 namespaces resolve in both locales', async () => {
    expect(i18n.t('errors:server')).toBe('Un problème est survenu de notre côté. Réessaie dans un instant.');
    expect(i18n.t('paywall:title')).toBe('Passe en Premium');
    expect(i18n.t('map:title')).toBe('Apprendre');
    expect(i18n.t('leagues:title')).toBe('Ligue');
    expect(i18n.t('profile:title')).toBe('Profil');
    expect(i18n.t('auth:welcome.start')).toBe('Commencer');
    expect(i18n.t('session:results.passed')).toBe('Niveau réussi !');

    await i18n.changeLanguage('en');
    expect(i18n.t('common:tabs.learn')).toBe('Learn');
    expect(i18n.t('errors:server')).toBe('Something went wrong on our end. Please try again in a moment.');
  });
});
