import { afterEach, describe, expect, it, vi } from 'vitest';
import { withCoreCsrfHeader } from '@/common/adapter/httpBridge';
import { configService } from '@/common/config/configService';
import { transcribeAudioBlob } from '@/renderer/services/SpeechToTextService';

afterEach(() => {
  document.cookie = 'aionui-csrf-token=; Max-Age=0; Path=/';
  vi.unstubAllGlobals();
});

describe('withCoreCsrfHeader', () => {
  it('adds the cookie token to state-changing methods and keeps existing headers', () => {
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    expect(withCoreCsrfHeader('put', { 'Content-Type': 'application/json' })).toEqual({
      'Content-Type': 'application/json',
      'x-csrf-token': 'test-csrf',
    });
  });

  it('leaves read-only requests and missing cookies untouched', () => {
    expect(withCoreCsrfHeader('POST')).toEqual({});
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    expect(withCoreCsrfHeader('GET', { Accept: 'application/json' })).toEqual({ Accept: 'application/json' });
  });
});

describe('transports outside httpRequest', () => {
  it('configService writes echo the CSRF token', async () => {
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await configService.set('theme.activeId', 'dark');
    expect(fetch).toHaveBeenCalledWith(
      '/api/settings/client',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'test-csrf' },
      })
    );
  });

  it('speech-to-text XHR upload echoes the CSRF token', async () => {
    document.cookie = 'aionui-csrf-token=test-csrf; Path=/';
    const setRequestHeader = vi.fn();
    class FakeXhr {
      status = 0;
      responseText = '';
      private listeners: Record<string, () => void> = {};
      open = vi.fn();
      setRequestHeader = setRequestHeader;
      addEventListener(event: string, listener: () => void) {
        this.listeners[event] = listener;
      }
      send() {
        this.status = 500;
        this.responseText = '{}';
        this.listeners.load?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    await transcribeAudioBlob(new Blob(['audio'], { type: 'audio/webm' })).catch(() => undefined);
    expect(setRequestHeader).toHaveBeenCalledWith('x-csrf-token', 'test-csrf');
  });
});
