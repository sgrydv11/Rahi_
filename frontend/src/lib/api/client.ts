export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Request failed (${status})`);
    this.name = 'ApiError';
  }
}

export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch) {
  return async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API path must start with a single slash');
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, { ...options, headers });
    if (response.status === 204) return undefined as T;
    const body: unknown = response.headers.get('content-type')?.includes('json')
      ? await response.json() : await response.text();
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  };
}

export const api = createApiClient(import.meta.env.VITE_API_BASE_URL || '/api/v1');
