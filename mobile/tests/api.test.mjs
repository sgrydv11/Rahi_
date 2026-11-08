import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the mobile client without loading native SecureStore in Node.
const source = ts.transpileModule(readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(fetcher, storedToken) {
  const timers = new Map();
  const calls = [];
  let token = storedToken;
  let nextTimer = 0;
  const context = {
    exports: {}, AbortController,
    process: { env: { EXPO_PUBLIC_API_BASE_URL: 'https://example.test/api/v1/' } },
    require: name => name === 'expo-secure-store' ? {
      getItemAsync: async () => token,
      setItemAsync: async (_, value) => { token = value; },
      deleteItemAsync: async () => { token = undefined; },
    } : { createGroupWalletClient: () => ({}) },
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { calls.push({ url, options }); return fetcher(url, options); },
    TypeError,
  };
  vm.runInNewContext(source, context);
  return { client: context.exports, timers, calls, token: () => token };
}

const session = {
  accessToken: 'access', refreshToken: 'rotated', expiresIn: 3600,
  user: { id: 'test-user', fullName: 'Test Rider' },
};

test('email OTP signs in without a password and persists the issued session', async () => {
  const f = fixture(async url => url.endsWith('/request')
    ? Response.json({ challengeId: 'challenge', expiresIn: 300, delivery: 'EMAIL' })
    : Response.json(session));
  await f.client.requestEmailOtp('rider@example.test', '+919876543210', 'PASSENGER');
  assert.deepEqual(JSON.parse(f.calls[0].options.body), {
    identifier: 'rider@example.test', mobileNumber: '+919876543210', travelPreference: 'PASSENGER',
  });
  assert.equal(f.calls[0].options.headers.Authorization, undefined);
  await f.client.verifyEmailOtp('challenge', '123456');
  assert.equal(f.calls[1].url, 'https://example.test/api/v1/mobile/auth/otp/verify');
  assert.deepEqual(JSON.parse(f.calls[1].options.body), { challengeId: 'challenge', code: '123456' });
  assert.equal(f.token(), 'rotated');
});

test('rejected email OTP does not establish a session', async () => {
  const f = fixture(async () => Response.json({ message: 'The code is invalid or expired.' }, { status: 401 }));
  await assert.rejects(f.client.verifyEmailOtp('challenge', '123456'));
  assert.equal(f.token(), undefined);
});

test('public requests skip token refresh and normalize the base URL', async () => {
  const f = fixture(async () => Response.json({ status: 'UP' }));
  assert.equal((await f.client.api('/health', { auth: false })).status, 'UP');
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, 'https://example.test/api/v1/health');
  assert.equal(f.calls[0].options.headers.Authorization, undefined);
  assert.equal(f.timers.size, 0);
});

test('request timeout aborts transport and clears the timer', async () => {
  const f = fixture((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const request = f.client.api('/rides', { auth: false });
  [...f.timers.values()][0]();
  await assert.rejects(request, /server is taking too long/);
  assert.equal(f.timers.size, 0);
});

test('malformed successful responses produce a recovery error', async () => {
  const f = fixture(async () => new Response('<html>Unavailable</html>'));
  await assert.rejects(f.client.api('/rides', { auth: false }), /unexpected response/);
  assert.equal(f.timers.size, 0);
});

test('non-JSON HTTP errors retain the HTTP status', async () => {
  const f = fixture(async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(f.client.api('/rides', { auth: false }), error => error.status === 503);
});

test('offline errors show a connection message', async () => {
  const f = fixture(async () => { throw new TypeError('Network request failed'); });
  await assert.rejects(f.client.api('/rides', { auth: false }), /Check your internet connection/);
});

test('concurrent authenticated requests share a refresh and save rotated credentials', async () => {
  const f = fixture(async url => Response.json(url.endsWith('/refresh') ? session : { ok: true }), 'stored');
  await Promise.all([f.client.api('/profile'), f.client.api('/rides/me')]);
  assert.equal(f.calls.filter(call => call.url.endsWith('/refresh')).length, 1);
  assert.equal(f.token(), 'rotated');
  assert.equal(f.calls[1].options.headers.Authorization, 'Bearer access');
});

test('expired refresh invalidates the session and deletes stored credentials', async () => {
  const f = fixture(async () => Response.json({ detail: 'Expired' }, { status: 401 }), 'stored');
  let invalidated = false;
  f.client.onSessionInvalidated(() => { invalidated = true; });
  await assert.rejects(f.client.restore(), /Expired/);
  assert.equal(f.token(), undefined);
  assert.equal(invalidated, true);
});

test('transient refresh failure preserves credentials for reconnect', async () => {
  const f = fixture(async () => Response.json({ detail: 'Unavailable' }, { status: 503 }), 'stored');
  await assert.rejects(f.client.restore(), /Unavailable/);
  assert.equal(f.token(), 'stored');
});

test('leaving a screen cancels its request without reporting a server timeout', async () => {
  const f = fixture((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('screen request cancelled')));
  }));
  const controller = new AbortController();
  const request = f.client.api('/rides', { auth: false, signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /screen request cancelled/);
  assert.equal(f.timers.size, 0);
});

test('the timeout covers a response body that never finishes', async () => {
  const f = fixture(async (_, { signal }) => ({
    status: 200, ok: true,
    json: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('body aborted')));
    }),
  }));
  const request = f.client.api('/rides', { auth: false });
  // Let fetch resolve and JSON consumption start before timing out.
  await new Promise(resolve => setImmediate(resolve));
  [...f.timers.values()][0]();
  await assert.rejects(request, /server is taking too long/);
  assert.equal(f.timers.size, 0);
});
