/**
 * Unit tests for the private-LAN owner API client (pages/network/networkApi.ts).
 *
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendHttpError } from '@/common/adapter/httpBridge';
import { isTerminal, networkApi, networkErrorText } from '@/renderer/pages/network/networkApi';

const t = (key: string, options?: Record<string, unknown>) =>
  key === 'settings.network.errors.PEER_UNTRUSTED' ? 'translated untrusted' : String(options?.defaultValue ?? key);

const backendError = (status: number, body: unknown) =>
  new BackendHttpError({ method: 'POST', path: '/api/network/peers', status, body });

describe('networkErrorText', () => {
  it('uses the translation for a known backend code', () => {
    expect(networkErrorText(backendError(403, { code: 'PEER_UNTRUSTED', error: 'peer not trusted' }), t)).toBe(
      'translated untrusted'
    );
  });

  it('falls back to the backend message for an unknown code', () => {
    expect(networkErrorText(backendError(400, { code: 'NEW_CODE', error: 'something new' }), t)).toBe('something new');
  });

  it('shows the generic text for non-backend failures', () => {
    expect(networkErrorText(new TypeError('fetch failed'), t)).toBe('settings.network.errors.generic');
  });
});

describe('isTerminal', () => {
  it('treats only finished states as terminal', () => {
    expect(['succeeded', 'failed', 'cancelled', 'expired'].every((s) => isTerminal(s as never))).toBe(true);
    expect(['pending_delivery', 'queued', 'running', 'waiting_for_owner'].some((s) => isTerminal(s as never))).toBe(
      false
    );
  });
});

describe('networkApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', { cookie: 'aionui-csrf-token=tok123' });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 'p1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('unwraps the ApiResponse data and sends the CSRF header on mutations', async () => {
    await expect(networkApi.approvePeer('p1')).resolves.toEqual({ id: 'p1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/network/peers/p1/approve');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('tok123');
  });

  it('encodes ids in the path', async () => {
    await networkApi.unshare('a/b');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/network/shares/a%2Fb');
  });

  it('surfaces the backend error code', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, code: 'PEER_UNREACHABLE', error: 'unreachable' }), { status: 502 })
    );
    await expect(networkApi.addPeer('https://10.0.0.2:25820')).rejects.toMatchObject({ code: 'PEER_UNREACHABLE' });
  });
});
