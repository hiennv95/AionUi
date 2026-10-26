import { withCoreCsrfHeader } from '@/common/adapter/httpBridge';

export type SetupResult = {
  code: 'ok' | 'alreadyDone' | 'invalid' | 'networkError' | 'serverError';
  /** Backend validation message, for `invalid`. */
  message?: string;
};

/**
 * Whether this host still has no owner account. `GET /api/auth/status` also
 * issues the CSRF cookie that the setup POST must echo back.
 */
export async function fetchNeedsSetup(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/status', { credentials: 'include' });
    if (!response.ok) return false;
    const data = (await response.json()) as { needs_setup?: boolean };
    return data.needs_setup === true;
  } catch {
    return false;
  }
}

/** Create the host owner account (`POST /api/auth/setup`); on success the session cookies are set. */
export async function submitSetup(username: string, password: string): Promise<SetupResult> {
  let response: Response;
  try {
    response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: withCoreCsrfHeader('POST', { 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { code: 'networkError' };
  }
  if (response.ok) return { code: 'ok' };

  const body = (await response.json().catch((): null => null)) as { error?: string; message?: string } | null;
  const message = body?.error ?? body?.message;
  if (response.status === 409) return { code: 'alreadyDone' };
  if (response.status >= 500) return { code: 'serverError' };
  return { code: 'invalid', message };
}
