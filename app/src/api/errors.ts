import { isAxiosError } from 'axios';

import type { CodedErrorBody } from '@/api/types';

export interface ApiErrorInfo {
  /** HTTP status, or null for network/unknown errors. */
  status: number | null;
  /** Business-rule code (`premium_required`, `out_of_hearts`, `attempt_in_progress`…). */
  code: string | null;
  /** `extra.attempt_id` on 409 `attempt_in_progress`. */
  attemptId: number | null;
  detail: string | null;
}

/**
 * Defensive parse of a mutation error into the coded shape used by the
 * attempt endpoints (PLAN reconciled decision 1). Never throws.
 */
export function parseApiError(error: unknown): ApiErrorInfo {
  if (!isAxiosError(error)) {
    return { status: null, code: null, attemptId: null, detail: null };
  }
  const status = error.response?.status ?? null;
  const body = (error.response?.data ?? {}) as CodedErrorBody;
  const attemptId = typeof body.extra?.attempt_id === 'number' ? body.extra.attempt_id : null;
  return {
    status,
    code: typeof body.code === 'string' ? body.code : null,
    attemptId,
    detail: typeof body.detail === 'string' ? body.detail : null,
  };
}
