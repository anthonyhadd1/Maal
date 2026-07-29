import i18n from '@/i18n';

/**
 * Client-side mirrors of the backend rules (accounts.RegisterSerializer):
 * username `^[a-zA-Z0-9_.]{3,30}$`, Django password validators (min 8,
 * not all-numeric), REQUIRED + unique email, display_name <= 40 chars.
 * Server remains the source of truth — these just catch mistakes on blur.
 */

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

export function validateUsername(value: string): string | null {
  if (!value.trim()) return i18n.t('auth:validation.usernameRequired');
  if (!USERNAME_RE.test(value.trim())) return i18n.t('auth:validation.usernameInvalid');
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return i18n.t('auth:validation.passwordRequired');
  if (value.length < 8) return i18n.t('auth:validation.passwordTooShort');
  if (/^\d+$/.test(value)) return i18n.t('auth:validation.passwordNumeric');
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return i18n.t('auth:validation.emailRequired');
  if (!EMAIL_RE.test(value.trim())) return i18n.t('auth:validation.emailInvalid');
  return null;
}

export function validateResetCode(value: string): string | null {
  if (!value.trim()) return i18n.t('auth:validation.codeRequired');
  if (!CODE_RE.test(value.trim())) return i18n.t('auth:validation.codeInvalid');
  return null;
}

export function validateDisplayName(value: string): string | null {
  if (value.trim().length > 40) return i18n.t('auth:validation.displayNameTooLong');
  return null;
}

/** Extract DRF field errors ({field: ["msg"]}) into a flat map. */
export function extractFieldErrors(data: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) {
        result[key] = String(value[0]);
      } else if (typeof value === 'string') {
        result[key] = value;
      }
    }
  }
  return result;
}
