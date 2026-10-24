/**
 * Contract test: validates openapi.yaml against a live, pinned aioncore.
 *
 *   AIONX_BASE_URL       default http://127.0.0.1:25818
 *   AIONX_USERNAME       default admin
 *   AIONX_PASSWORD_FILE  default ~/.aionx-host/admin-password
 *
 * Read-only against server state apart from issuing and rotating this test's own tokens.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const BASE_URL = process.env.AIONX_BASE_URL ?? 'http://127.0.0.1:25818';
const USERNAME = process.env.AIONX_USERNAME ?? 'admin';
const PASSWORD = readFileSync(
  process.env.AIONX_PASSWORD_FILE ?? join(homedir(), '.aionx-host', 'admin-password'),
  'utf8'
).trim();

const spec = parse(readFileSync(join(import.meta.dir, 'openapi.yaml'), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema({ $id: 'spec', components: spec.components });

/** Validate `body` against the response schema the spec declares for `path`/`method`/`status`. */
function expectMatchesSpec(path: string, method: string, status: number, body: unknown) {
  const responses = spec.paths[path][method].responses;
  const declared = responses[String(status)];
  expect(declared, `spec declares no ${status} for ${method.toUpperCase()} ${path}`).toBeDefined();
  const response = declared.$ref ? spec.components.responses[declared.$ref.split('/').pop()] : declared;
  const schema = JSON.parse(
    JSON.stringify(response.content['application/json'].schema).replaceAll('"#/components', '"spec#/components')
  );
  const validate = ajv.compile(schema);
  const ok = validate(body);
  expect(ok ? [] : validate.errors).toEqual([]);
}

/**
 * Native clients have no cookie jar, yet AionCore enforces double-submit CSRF on every
 * mutating request, Bearer or not. They must send a matching cookie/header pair.
 */
const NATIVE_CSRF = crypto.randomUUID();

async function call(method: string, path: string, init: { token?: string; body?: unknown; nativeCsrf?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.nativeCsrf) {
    headers.Cookie = `aionui-csrf-token=${NATIVE_CSRF}`;
    headers['x-csrf-token'] = NATIVE_CSRF;
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  return { res, status: res.status, body: text ? JSON.parse(text) : undefined };
}

/** Value of a Set-Cookie entry, or undefined. */
function cookieValue(res: Response, name: string): string | undefined {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

let accessToken = '';
let refreshCookie: string | undefined;

beforeAll(async () => {
  const { res, status, body } = await call('POST', '/login', { body: { username: USERNAME, password: PASSWORD } });
  expect(status).toBe(200);
  expectMatchesSpec('/login', 'post', status, body);
  accessToken = body.token;
  refreshCookie = cookieValue(res, 'aionui-refresh');
});

describe('auth', () => {
  test('GET /api/auth/status', async () => {
    const { status, body } = await call('GET', '/api/auth/status');
    expectMatchesSpec('/api/auth/status', 'get', status, body);
  });

  test('POST /login rejects a wrong password with the error envelope', async () => {
    const { status, body } = await call('POST', '/login', { body: { username: USERNAME, password: 'wrong-password' } });
    expect(status).toBe(401);
    expectMatchesSpec('/login', 'post', status, body);
  });

  test('login sets session, refresh and CSRF cookies', async () => {
    const { res } = await call('POST', '/login', { body: { username: USERNAME, password: PASSWORD } });
    for (const name of ['aionui-session', 'aionui-refresh', 'aionui-csrf-token']) {
      expect(cookieValue(res, name), name).toBeTruthy();
    }
  });

  test('GET /api/auth/user with bearer token', async () => {
    const { status, body } = await call('GET', '/api/auth/user', { token: accessToken });
    expect(status).toBe(200);
    expectMatchesSpec('/api/auth/user', 'get', status, body);
  });

  test('GET /api/auth/user without credentials is 401', async () => {
    const { status, body } = await call('GET', '/api/auth/user');
    expect(status).toBe(401);
    expectMatchesSpec('/api/auth/user', 'get', status, body);
  });

  test('POST /api/auth/refresh with the refresh token in the body (native client path)', async () => {
    expect(refreshCookie, 'login must issue aionui-refresh').toBeTruthy();
    const { status, body } = await call('POST', '/api/auth/refresh', {
      body: { token: refreshCookie },
      nativeCsrf: true,
    });
    expect(status).toBe(200);
    expectMatchesSpec('/api/auth/refresh', 'post', status, body);
  });

  // AionCore routes.rs refresh_tokens(): the body path uses lenient `verify` for legacy
  // clients, so a stolen access token can be exchanged for a fresh pair indefinitely.
  test('KNOWN RISK: body refresh accepts an access token (legacy lenient path)', async () => {
    const { status, body } = await call('POST', '/api/auth/refresh', {
      body: { token: accessToken },
      nativeCsrf: true,
    });
    expect(status).toBe(200);
    expectMatchesSpec('/api/auth/refresh', 'post', status, body);
  });
  test.todo('POST /api/auth/refresh rejects an access token (needs AionCore fix)');

  test('mutating request without the CSRF pair is rejected even with a valid refresh token', async () => {
    const { status, body } = await call('POST', '/api/auth/refresh', { body: { token: refreshCookie } });
    expect(status).toBe(403);
    expect(body.code).toBe('CSRF_INVALID');
  });

  test('GET /api/ws-token', async () => {
    const { status, body } = await call('GET', '/api/ws-token', { token: accessToken });
    expect(status).toBe(200);
    expectMatchesSpec('/api/ws-token', 'get', status, body);
  });
});

describe('conversations', () => {
  test('GET /api/conversations', async () => {
    const { status, body } = await call('GET', '/api/conversations?limit=20', { token: accessToken });
    expect(status).toBe(200);
    expectMatchesSpec('/api/conversations', 'get', status, body);
  });

  test('GET /api/conversations without credentials is 401', async () => {
    const { status, body } = await call('GET', '/api/conversations');
    expect(status).toBe(401);
    expectMatchesSpec('/api/conversations', 'get', status, body);
  });
});
