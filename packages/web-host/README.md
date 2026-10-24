# @aionui/web-host

WebUI host package for AionUi - zero Electron dependency.

## Responsibilities

- **backend-launcher**: spawn or reuse existing aioncore process
- **static-server**: serve out/renderer SPA + reverse proxy /api and /ws to backend
- **auth**: password reset, change, verify, config I/O (bcrypt + session)

## Usage

```ts
import { startWebHost } from '@aionui/web-host';

const handle = await startWebHost({
  app: {
    version: '1.0.0',
    isPackaged: false,
    resourcesPath: '/path/to/resources',
    userDataPath: '/path/to/userData',
  },
  staticDir: '/path/to/out/renderer',
  backend: {
    kind: 'ownBackend',
    resolveBackend: () => '/path/to/aioncore',
  },
});

console.log(`WebUI running at ${handle.url}`);

await handle.stop();
```

## Runtime and security

The package implements backend lifecycle, static assets, API proxying and WebSocket forwarding. Standalone `startWebHost` launches an authenticated backend; Electron's embedded lifecycle retains local mode.

Before opening remote access, `startWebHost` verifies that unauthenticated `/api/auth/user` is rejected with 401. Auth-bypassing existing desktop backends are refused. A failed probe prevents the listener and cleans up owned backend resources. Direct low-level server helpers are trusted internal APIs; use `startWebHost` for application hosting policy.

Provision standalone credentials through the existing `resetpass` CLI with the same dedicated data directory while the host is stopped. Remote local-only reset endpoints are not used for initial setup. See `docs/master-aionui-x/verification.md` for tested scope and remaining security work.
