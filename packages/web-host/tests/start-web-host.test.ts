/**
 * Tests for startWebHost (M6)
 *
 * After the M6 auth cleanup, startWebHost is a thin orchestrator: start backend,
 * start static-server, return the combined handle. No credentials, no config
 * file reads — the caller (Electron main process, aionui-web CLI) resolves
 * port / allowRemote from its own source of truth.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('startWebHost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('Returns handle without initialPassword', async () => {
    // Mock backend-launcher
    vi.doMock('../src/backend-launcher.js', () => ({
      startBackend: vi.fn().mockResolvedValue({
        port: 55555,
        stop: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    // Mock static-server
    vi.doMock('../src/static-server.js', () => ({
      startStaticServer: vi.fn().mockResolvedValue({
        port: 33000,
        url: 'http://127.0.0.1:33000',
        localUrl: 'http://127.0.0.1:33000',
        stop: vi.fn().mockResolvedValue(undefined),
      }),
    }));

    const { startWebHost } = await import('../src/index.js');

    const handle = await startWebHost({
      app: {
        version: '1.0.0',
        isPackaged: false,
        resourcesPath: '/app',
        userDataPath: '/tmp/test-data',
      },
      staticDir: '/tmp/static',
      backend: {
        kind: 'ownBackend',
        resolveBackend: () => '/bin/backend',
      },
    });

    // No initialPassword field on the handle — admin credentials flow through
    // backend's /api/webui/reset-password, not through startWebHost.
    expect('initialPassword' in handle).toBe(false);
    expect(handle.port).toBe(33000);
    expect(handle.backendPort).toBe(55555);

    await handle.stop();

    vi.doUnmock('../src/backend-launcher.js');
    vi.doUnmock('../src/static-server.js');
  });

  test.todo('Backend port conflict: throws and does not leak resources');
  test.todo('Static-server port conflict: cleans up backend before throwing');
  test.todo('Stop cleanup: stops static-server then backend in sequence');

  async function remoteSetup() {
    const stop = vi.fn().mockResolvedValue(undefined);
    const startBackend = vi.fn().mockResolvedValue({ port: 55555, stop });
    const startStaticServer = vi.fn().mockResolvedValue({ port: 33000, stop: vi.fn() });
    vi.doMock('../src/backend-launcher.js', () => ({ startBackend }));
    vi.doMock('../src/static-server.js', () => ({ startStaticServer }));
    const { startWebHost } = await import('../src/index.js');
    const options = {
      app: { version: '1.0.0', isPackaged: false, resourcesPath: '/app', userDataPath: '/tmp/test' },
      staticDir: '/tmp/static',
      allowRemote: true,
      backend: { kind: 'ownBackend' as const, resolveBackend: () => '/bin/backend' },
    };
    return { stop, startBackend, startStaticServer, startWebHost, options };
  }

  test('standalone hosts launch with auth and probe before remote exposure', async () => {
    const setup = await remoteSetup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
    const handle = await setup.startWebHost(setup.options);
    expect(setup.startBackend).toHaveBeenCalledWith(expect.objectContaining({ local: false }));
    expect(setup.startStaticServer).toHaveBeenCalledTimes(1);
    await handle.stop();
  });

  test('refuses an auth-bypassing backend without opening a listener', async () => {
    const setup = await remoteSetup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    await expect(setup.startWebHost(setup.options)).rejects.toThrow('WEB_HOST_AUTH_REQUIRED');
    expect(setup.startStaticServer).not.toHaveBeenCalled();
    expect(setup.stop).toHaveBeenCalledTimes(1);
  });

  test('fails closed on an unavailable auth probe and cleans up owned backend', async () => {
    const setup = await remoteSetup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('probe unavailable')));
    await expect(setup.startWebHost(setup.options)).rejects.toThrow('probe unavailable');
    expect(setup.startStaticServer).not.toHaveBeenCalled();
    expect(setup.stop).toHaveBeenCalledTimes(1);
  });

  test('does not expose an existing local desktop backend or take ownership of it', async () => {
    const setup = await remoteSetup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));
    await expect(
      setup.startWebHost({
        ...setup.options,
        backend: { kind: 'useExistingBackend', port: 55555 },
      })
    ).rejects.toThrow('WEB_HOST_AUTH_REQUIRED');
    expect(setup.startBackend).not.toHaveBeenCalled();
    expect(setup.startStaticServer).not.toHaveBeenCalled();
  });
});
