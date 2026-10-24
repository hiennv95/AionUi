import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest } from '@/common/adapter/httpBridge';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('transport diagnostic privacy', () => {
  it('keeps prompt bodies and query values out of request breadcrumbs', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"data":true}', { headers: { 'Content-Type': 'application/json' } }))
    );
    await httpRequest('POST', '/api/teams?t=private-test-value', { input: 'private-test-value' });
    expect(JSON.stringify(debug.mock.calls)).not.toContain('private-test-value');
    expect(JSON.stringify(debug.mock.calls)).toContain('/api/teams');
  });

  it('preserves structured error details for callers without logging or embedding their payload in the message', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'private-test-value', code: 'DENIED' }), { status: 403 })
        )
    );
    const request = httpRequest('POST', '/api/teams', { input: 'private-test-value' });
    await expect(request).rejects.toMatchObject({ status: 403, backendMessage: 'private-test-value' });
    await request.catch((failure: Error) => expect(failure.message).not.toContain('private-test-value'));
    expect(JSON.stringify([...debug.mock.calls, ...error.mock.calls])).not.toContain('private-test-value');
  });
});
