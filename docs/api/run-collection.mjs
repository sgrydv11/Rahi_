// Dependency-free local runner for the Postman scripts used by this collection.
// This checks the requests/scripts against HTTP; it does not emulate the entire Postman SDK.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const collection = JSON.parse(readFileSync(process.argv[3] || new URL('./Hoopr-Phase-2.postman_collection.json', import.meta.url), 'utf8'));
const values = new Map(collection.variable.map(v => [v.key, v.value]));
if (process.argv[2]) values.set('serverUrl', process.argv[2].replace(/\/$/, ''));
let requests = 0;
let assertions = 0;
const interpolate = text => text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
  if (key === '$guid') return randomUUID();
  if (!values.has(key)) throw new Error(`Undefined collection variable: ${key}`);
  return values.get(key);
});
const variables = { get: key => values.get(key), set: (key, value) => values.set(key, value), replaceIn: interpolate };

async function run(items) {
  for (const item of items) {
    if (item.item) { await run(item.item); continue; }
    const pm = {
      variables, collectionVariables: variables,
      expect(actual) { return { to: { eql(expected) { assert.deepStrictEqual(actual, expected); } } }; },
      test(name, fn) {
        try { fn(); assertions++; }
        catch { throw new Error(`${item.name}: assertion failed: ${name}`); }
      },
    };
    const context = vm.createContext({ pm });
    const execute = phase => {
      for (const event of item.event ?? []) if (event.listen === phase) {
        new vm.Script(event.script.exec.join('\n'), { filename: item.name }).runInContext(context, { timeout: 2000 });
      }
    };
    execute('prerequest');
    const request = item.request;
    const response = await fetch(interpolate(request.url), {
      method: request.method,
      headers: Object.fromEntries(request.header.filter(h => !h.disabled).map(h => [h.key, interpolate(h.value)])),
      body: request.body ? interpolate(request.body.raw) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const body = await response.text();
    const headers = [];
    response.headers.forEach((value, key) => { if (key !== 'set-cookie') headers.push({ key, value }); });
    for (const value of response.headers.getSetCookie()) headers.push({ key: 'Set-Cookie', value });
    pm.response = {
      code: response.status,
      json: () => JSON.parse(body),
      headers: { all: () => headers, get: key => response.headers.get(key) },
      to: { have: { status: expected => assert.equal(response.status, expected) } },
    };
    execute('test');
    requests++;
    console.log(`${response.status} ${item.name}`);
  }
}

try {
  await run(collection.item);
  console.log(`PASS: ${requests} requests, ${assertions} assertions. Generated token/password variables cleared.`);
} catch (error) {
  // Report the assertion/request name, never HTTP bodies, tokens, or passwords.
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const key of ['csrfToken', 'testPassword', 'accessToken', 'refreshToken', 'beforeRotationToken', 'loggedOutRefreshToken']) values.delete(key);
}
