import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest, resolveCoreCsrfToken } from '@/common/adapter/httpBridge';

afterEach(() => {
  document.cookie = 'aionui-csrf-token=; Max-Age=0; Path=/';
  vi.unstubAllGlobals();
});

function response(status = 200) {
  return new Response(JSON.stringify(status === 200 ? { data: true } : { code: 'CSRF_INVALID', error: 'invalid' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AionCore CSRF transport', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('echoes the cookie for %s', async (method) => {
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetch);
    await httpRequest(method, '/api/teams');
    expect(fetch).toHaveBeenCalledWith(
      '/api/teams',
      expect.objectContaining({ headers: { 'x-csrf-token': 'test-csrf' } })
    );
  });

  it('does not send a token on read-only requests', async () => {
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetch);
    await httpRequest('GET', '/api/teams');
    expect(fetch).toHaveBeenCalledWith('/api/teams', expect.objectContaining({ headers: {} }));
  });

  it('preserves server rejection without retrying around CSRF', async () => {
    const fetch = vi.fn().mockResolvedValue(response(403));
    vi.stubGlobal('fetch', fetch);
    await expect(httpRequest('POST', '/api/teams')).rejects.toMatchObject({ status: 403, code: 'CSRF_INVALID' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns no token when the cookie is missing or malformed', () => {
    expect(resolveCoreCsrfToken()).toBe('');
    document.cookie = 'aionui-csrf-token=%invalid; Path=/';
    expect(resolveCoreCsrfToken()).toBe('');
  });
});
