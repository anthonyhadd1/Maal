import i18n from '@/i18n';

/**
 * Locale-aware formatting through Intl (Hermes ships full Intl).
 * Always uses the active i18n locale unless one is passed explicitly.
 */

function activeLocale(locale?: string): string {
  return locale ?? i18n.language ?? 'fr';
}

/** "1 234" in fr (narrow no-break grouping), "1,234" in en. */
export function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(activeLocale(locale)).format(value);
}

/** XP display: "+1 234 XP" style amounts are built in i18n; this formats the raw number. */
export function formatXp(xp: number, locale?: string): string {
  return formatNumber(xp, locale);
}

/** "70 %" in fr, "70%" in en. */
export function formatPercent(pct: number, locale?: string): string {
  return new Intl.NumberFormat(activeLocale(locale), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(pct / 100);
}

/** Medium date: "1 juillet 2026" / "July 1, 2026". */
export function formatDate(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(activeLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/** "18:40" style time (heart regen countdown target, etc.). */
export function formatTime(date: Date | string, locale?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(activeLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
}

/** Split a duration into calendar-ish parts (league week countdown). */
export function msToParts(ms: number): DurationParts {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return {
    days: Math.floor(totalMinutes / (24 * 60)),
    hours: Math.floor((totalMinutes % (24 * 60)) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Clock-style elapsed time: "4:37" (session results). */
export function formatElapsedMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
