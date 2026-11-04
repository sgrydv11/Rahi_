import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

describe('API client', () => {
  it('joins the configured base URL and preserves request options', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'UP' }));
    const client = createApiClient('/api/v1/', fetcher);
    await expect(client('/health', { headers: { 'X-Request-ID': 'test' } })).resolves.toEqual({ status: 'UP' });
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/health');
    const options = fetcher.mock.calls[0][1];
    expect(new Headers(options?.headers).get('X-Request-ID')).toBe('test');
  });
  it('exposes structured server failures', async () => {
    const client = createApiClient('/api/v1', vi.fn<typeof fetch>().mockResolvedValue(Response.json({ title: 'Conflict' }, { status: 409 })));
    const request = client('/rides');
    await expect(request).rejects.toMatchObject({ status: 409, body: { title: 'Conflict' } });
    await expect(request).rejects.toBeInstanceOf(ApiError);
  });
  it('supports empty responses', async () => {
    const client = createApiClient('/api/v1', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(client('/example')).resolves.toBeUndefined();
  });
  it('rejects absolute URLs', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(createApiClient('/api/v1', fetcher)('//example.com')).rejects.toThrow('single slash');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
