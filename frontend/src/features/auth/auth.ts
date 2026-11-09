import { api as request, ApiError } from '../../lib/api/client';

export type TravelPreference = 'DRIVER' | 'PASSENGER' | 'BOTH';
export const travelPreferenceLabels: Record<TravelPreference, string> = {
  DRIVER: 'Offer a seat (Driver)',
  PASSENGER: 'Find a seat (Passenger)',
  BOTH: 'Both — offer and find seats',
};
export interface User { id: string; email: string; fullName: string; role: 'USER' | 'ADMIN'; travelPreference: TravelPreference }
interface Session { accessToken: string; expiresIn: number; user: User }
let session: Session | null = null;
let expiresAt = 0;
let refreshPending: Promise<Session> | null = null;
let csrfPending: Promise<{ token: string; headerName: string }> | null = null;
let generation = 0;
const listeners = new Set<() => void>();
const publish = (next: Session | null) => {
  session = next; expiresAt = next ? Date.now() + next.expiresIn * 1000 : 0;
  listeners.forEach(listener => listener());
};
export const authStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  snapshot: () => session?.user ?? null,
  updateProfile(user: User) {
    if (session?.user.id !== user.id) return;
    session = { ...session, user };
    listeners.forEach(listener => listener());
  },
};
async function mutate<T>(path: string, body?: unknown): Promise<T> {
  const perform = async (freshCsrf: boolean) => {
    if (freshCsrf) csrfPending = null;
    csrfPending ??= request<{ token: string; headerName: string }>('/auth/csrf', { credentials: 'include', signal: AbortSignal.timeout(15000) })
      .catch(error => { csrfPending = null; throw error; });
    const csrf = await csrfPending;
    try {
      return await request<T>(path, { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(15000),
        headers: { [csrf.headerName]: csrf.token }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) csrfPending = null;
      throw error;
    }
  };
  // Cookies are shared across tabs: lock CSRF acquisition and rotation together.
  // Tokens stay in memory/cookies and are never broadcast or saved in localStorage.
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('hoopr-cookie-auth', () => perform(true));
  return perform(false);
}
export function refreshSession(): Promise<Session> {
  if (!refreshPending) {
    const epoch = generation;
    refreshPending = mutate<Session>('/auth/refresh').then(next => {
      if (epoch === generation) publish(next);
      return next;
    }).catch(error => { if (epoch === generation) publish(null); throw error; })
      .finally(() => { refreshPending = null; });
  }
  return refreshPending;
}
export async function login(email: string, password: string) {
  // Finish bootstrap refresh before login sets a new cookie.
  if (refreshPending) await refreshPending.catch(() => {});
  generation++;
  const next = await mutate<Session>('/auth/login', { email, password }); publish(next);
}
export async function register(email: string, password: string, fullName: string, travelPreference: TravelPreference = 'BOTH', mobileNumber?: string) {
  return mutate<User>('/auth/register', { email, password, fullName, travelPreference, mobileNumber });
}
export async function loginWithGoogle(credential: string, travelPreference: TravelPreference = 'PASSENGER') {
  if (refreshPending) await refreshPending.catch(() => {});
  generation++;
  const next = await mutate<Session>('/auth/google', { credential, travelPreference });
  publish(next);
}
export function requestEmailOtp(identifier: string, mobileNumber?: string, travelPreference: TravelPreference = 'PASSENGER') {
  return mutate<{ challengeId: string; expiresIn: number; delivery: string }>('/auth/otp/request', { identifier, mobileNumber, travelPreference });
}
export async function verifyEmailOtp(challengeId: string, code: string) {
  if (refreshPending) await refreshPending.catch(() => {});
  generation++;
  const next = await mutate<Session>('/auth/otp/verify', { challengeId, code }); publish(next);
}
export async function logout() {
  generation++;
  if (refreshPending) await refreshPending.catch(() => {});
  // Keep the signed-in state on a network failure so the user can retry revocation.
  await mutate<void>('/auth/logout'); publish(null);
}
export async function authenticatedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!session || Date.now() >= expiresAt - 30000) await refreshSession();
  const send = () => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${session!.accessToken}`);
    return request<T>(path, { ...options, credentials: 'omit', headers });
  };
  try { return await send(); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refreshSession();
    return send(); // Exactly one retry; auth endpoints use the raw client.
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.body && typeof error.body === 'object' && 'detail' in error.body
      && typeof error.body.detail === 'string') return error.body.detail;
  return 'Unable to connect. Please try again.';
}
export function validateCredentials(email: string, password: string, registering = false): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) return 'Enter a valid email address.';
  if (!password.trim()) return 'Enter your password.';
  if (registering && password.length < 12) return 'Use at least 12 characters for your password.';
  if (new TextEncoder().encode(password).length > 72) return 'Password must be at most 72 UTF-8 bytes.';
  return null;
}
