import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('auth session client', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });
  const user = { id: 'test-user', email: 'a@example.test', fullName: 'Alice', role: 'USER', travelPreference: 'BOTH' };
  const csrf = () => Response.json({ token: 'csrf-value', headerName: 'X-XSRF-TOKEN' });
  const session = () => Response.json({ accessToken: 'access-value', expiresIn: 900, user });
  it('validates email, length and BCrypt byte boundaries', async () => {
    const { validateCredentials } = await import('./auth');
    expect(validateCredentials('bad', 'long-password', true)).toContain('email');
    expect(validateCredentials('a@example.test', 'short', true)).toContain('12');
    expect(validateCredentials('a@example.test', 'é'.repeat(37), true)).toContain('72');
    expect(validateCredentials('a@example.test', 'long-password', true)).toBeNull();
  });
  it('logs in with CSRF and cookie credentials then sends bearer requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(session())
      .mockResolvedValueOnce(Response.json(user));
    vi.stubGlobal('fetch', fetcher);
    const auth = await import('./auth');
    await auth.login('a@example.test', 'long-password');
    expect(auth.authStore.snapshot()).toEqual(user);
    expect(fetcher.mock.calls[1][1]?.credentials).toBe('include');
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('X-XSRF-TOKEN')).toBe('csrf-value');
    await auth.authenticatedRequest('/users/me');
    expect(new Headers(fetcher.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer access-value');
    expect(fetcher.mock.calls[2][1]?.credentials).toBe('omit');
  });
  it.each(['DRIVER', 'PASSENGER', 'BOTH'] as const)('submits the %s registration preference', async preference => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf())
      .mockResolvedValueOnce(Response.json({ ...user, travelPreference: preference }, { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const auth = await import('./auth');
    await auth.register('a@example.test', 'long-password', 'Alice', preference);
    const body = JSON.parse(fetcher.mock.calls[1][1]?.body as string);
    expect(body.travelPreference).toBe(preference);
    expect(body).not.toHaveProperty('role');
  });
  it('shares concurrent refresh and retries a failed request only once', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(session())
      .mockResolvedValueOnce(Response.json({}, { status: 401 })).mockResolvedValueOnce(session())
      .mockResolvedValueOnce(Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    const auth = await import('./auth');
    await Promise.all([auth.refreshSession(), auth.refreshSession()]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(auth.authenticatedRequest('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(2);
  });
  it('serializes cookie refresh across separate tabs and fetches CSRF inside the lock', async () => {
    let tail = Promise.resolve();
    const locks = { request: vi.fn((_name: string, run: () => Promise<unknown>) => {
      const next = tail.then(run); tail = next.then(() => undefined, () => undefined); return next;
    }) };
    vi.stubGlobal('navigator', { locks });
    const calls: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async url => {
      calls.push(String(url));
      await new Promise(resolve => setTimeout(resolve, 5));
      return String(url).endsWith('/csrf') ? csrf() : session();
    });
    vi.stubGlobal('fetch', fetcher);
    const firstTab = await import('./auth');
    vi.resetModules();
    const secondTab = await import('./auth');
    await Promise.all([firstTab.refreshSession(), secondTab.refreshSession()]);
    expect(locks.request).toHaveBeenCalledTimes(2);
    expect(calls.map(url => url.split('/').at(-1))).toEqual(['csrf', 'refresh', 'csrf', 'refresh']);
    expect(firstTab.authStore.snapshot()).toEqual(user);
    expect(secondTab.authStore.snapshot()).toEqual(user);
  });
  it('does not retry failed refresh and clears memory', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(Response.json({}, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    const auth = await import('./auth');
    await expect(auth.authenticatedRequest('/users/me')).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(auth.authStore.snapshot()).toBeNull();
  });
  it('keeps state on failed logout so revocation can be retried', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(csrf()).mockResolvedValueOnce(session())
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const auth = await import('./auth'); await auth.login('a@example.test', 'long-password');
    await expect(auth.logout()).rejects.toThrow('offline'); expect(auth.authStore.snapshot()).toEqual(user);
    await auth.logout(); expect(auth.authStore.snapshot()).toBeNull();
  });
});
