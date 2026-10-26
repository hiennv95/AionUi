/**
 * Unit tests for first-run setup calls (pages/login/setupApi.ts).
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNeedsSetup, submitSetup } from '@/renderer/pages/login/setupApi';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('setupApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('document', { cookie: 'aionui-csrf-token=tok123' });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('reports needs_setup from the auth status', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, needs_setup: true }));
    await expect(fetchNeedsSetup()).resolves.toBe(true);
    fetchMock.mockResolvedValueOnce(json(200, { success: true, needs_setup: false }));
    await expect(fetchNeedsSetup()).resolves.toBe(false);
  });

  it('assumes sign-in when the status call fails', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(fetchNeedsSetup()).resolves.toBe(false);
  });

  it('posts credentials with the CSRF header', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true }));
    await expect(submitSetup('owner', 'correct-horse-9')).resolves.toEqual({ code: 'ok' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/setup');
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('tok123');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'owner', password: 'correct-horse-9' });
  });

  it('maps 409 to alreadyDone, 400 to the backend message, 5xx and network failures', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { code: 'SETUP_ALREADY_DONE', error: 'done' }));
    await expect(submitSetup('owner', 'correct-horse-9')).resolves.toEqual({ code: 'alreadyDone' });

    fetchMock.mockResolvedValueOnce(json(400, { error: 'Password must be at least 8 characters' }));
    await expect(submitSetup('owner', 'short')).resolves.toEqual({
      code: 'invalid',
      message: 'Password must be at least 8 characters',
    });

    fetchMock.mockResolvedValueOnce(json(500, { error: 'db' }));
    await expect(submitSetup('owner', 'correct-horse-9')).resolves.toEqual({ code: 'serverError' });

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(submitSetup('owner', 'correct-horse-9')).resolves.toEqual({ code: 'networkError' });
  });
});
