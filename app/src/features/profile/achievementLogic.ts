/**
 * Pure achievement text-localization logic. The backend catalog
 * (gamification/services/achievements.py) generates `title`/`description`
 * as pre-formatted French strings — fine as a fallback for a `code` this
 * build doesn't recognize yet, but the 20 static trophies and the
 * per-subject "Expert·e {matière}" family both have stable, parseable
 * codes, so the client localizes them instead of trusting the raw payload
 * (mirrors questLogic.ts's code-based approach for daily quests).
 */

const STATIC_ACHIEVEMENT_CODES = [
  'premiere-victoire',
  'sans-faute',
  'sur-ta-lancee',
  'inarretable',
  'centurion',
  'une-annee-de-feu',
  'semaine-parfaite',
  'noctambule',
  'leve-tot',
  'marathonien',
  'touche-a-tout',
  'grimpeur',
  'podium',
  'cedre-eternel',
  'defi-releve',
  'rival-redoutable',
  'papillon-social',
  'perfectionniste',
  'memoire-d-elephant',
  'collectionneur-d-or',
];

/** i18n key pair for a known static trophy, or null (unknown / expert-family code). */
export function achievementTextKeys(
  code: string,
): { titleKey: string; descriptionKey: string } | null {
  if (!STATIC_ACHIEVEMENT_CODES.includes(code)) return null;
  return {
    titleKey: `achievementsScreen.catalog.${code}.title`,
    descriptionKey: `achievementsScreen.catalog.${code}.description`,
  };
}

/** The per-subject "Expert·e {matière}" family — code is `expert-{subject-slug}`. */
export function isExpertAchievement(code: string): boolean {
  return code.startsWith('expert-');
}

/**
 * Subject name for an expert-family trophy, parsed out of the server's raw
 * title (fixed "Expert·e {name}" format). Subject names are real French
 * curriculum content and are never translated (same as everywhere else in
 * the app), so extracting from the untranslated raw string is safe and
 * avoids needing a separate subject-name field on the achievement payload.
 */
export function expertSubjectName(rawTitle: string): string {
  return rawTitle.replace(/^Expert·e\s+/, '');
}
