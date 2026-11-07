import * as SecureStore from 'expo-secure-store';
import { createGroupWalletClient } from './groupWallet';

export type Preference = 'DRIVER' | 'PASSENGER' | 'BOTH';
export interface User { id: string; fullName: string; email: string; role: string; travelPreference: Preference }
export interface Page<T> { content: T[]; page: number; totalPages: number }
export interface Point { latitude: number; longitude: number }
export interface Pins { pickup: Point; dropoff: Point }
export interface Ride {
  id: string; origin: string; destination: string; driver: { id: string; displayName: string };
  departureAt: string; timeZone: string; status: string; totalSeats: number; availableSeats: number;
  pricePerSeat: number; currency: string; version: number; canStart: boolean;
  pickupDescription?: string; dropoffDescription?: string; vehicleDetails?: string; notes?: string;
  cancellationReason?: string; route?: Pins; startedAt?: string; completedAt?: string;
}
export interface Booking {
  id: string; status: string; seats: number; totalPrice: number; currency: string; canCancel: boolean;
  passenger: { id: string; displayName: string }; rating?: { score: number }; cancellationReason?: string;
  ride: { id: string; driverId: string; origin: string; destination: string; departureAt: string; status: string; route?: Pins };
}
export interface Vehicle {
  id: string; make: string; model: string; color?: string; registrationNumber: string; passengerCapacity: number; active: boolean;
}
export interface Payment {
  enabled: boolean; canPay: boolean; canRefund: boolean; amount: number; currency: string;
  provider: 'stripe' | 'razorpay' | 'wallet'; checkoutUrl?: string; keyId?: string; orderId?: string;
  paymentId?: string; paidAt?: string; refundId?: string; refundStatus?: string;
}
export interface Notice { id: string; kind: string; origin: string; destination: string; time: string; link: string }
interface Session { accessToken: string; expiresIn: number; refreshToken: string; user: User }
type Options = { method?: 'POST' | 'PATCH'; body?: unknown; key?: string; auth?: boolean; signal?: AbortSignal };
class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, '');
const sessionKey = 'hoopr.refresh';
let session: Session | undefined;
let expiresAt = 0;
let pending: Promise<Session> | undefined;
let sessionInvalidated = () => {};
export function onSessionInvalidated(listener: () => void) { sessionInvalidated = listener; }

async function request<T>(path: string, options: Options = {}, token?: string): Promise<T> {
  if (!baseUrl || !/^https:\/\//i.test(baseUrl)) throw new Error('Set EXPO_PUBLIC_API_BASE_URL to the HTTPS FlexirRides API address.');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.key) headers['Idempotency-Key'] = options.key;
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(baseUrl + path, {
      method: options.method ?? 'GET', headers, credentials: 'omit', signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(error => {
      if (controller.signal.aborted) throw error;
      if (response.ok) throw new Error('The server returned an unexpected response. Please refresh and try again.');
      return null;
    });
    if (!response.ok) throw new ApiError(response.status, body?.detail || `Request failed (${response.status}).`);
    return body as T;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) {
      throw new Error('The server is taking too long to respond. Check your connection and refresh the latest status before trying again.');
    }
    if (error instanceof TypeError) throw new Error('Unable to connect. Check your internet connection and try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', cancel);
  }
}

async function save(next: Session) {
  await SecureStore.setItemAsync(sessionKey, next.refreshToken, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  session = next;
  expiresAt = Date.now() + next.expiresIn * 1000;
  return next;
}

function refresh() {
  pending ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync(sessionKey);
    if (!refreshToken) throw new ApiError(401, 'Sign in to continue.');
    return save(await request<Session>('/mobile/auth/refresh', { method: 'POST', body: { refreshToken } }));
  })().catch(async error => {
    if (error instanceof ApiError && error.status === 401) {
      session = undefined;
      await SecureStore.deleteItemAsync(sessionKey);
      sessionInvalidated();
    }
    throw error;
  }).finally(() => { pending = undefined; });
  return pending;
}

export async function restore() {
  if (!await SecureStore.getItemAsync(sessionKey)) return null;
  return (await refresh()).user;
}
export async function login(email: string, password: string) {
  return (await save(await request<Session>('/mobile/auth/login', { method: 'POST', body: { email, password } }))).user;
}
export async function register(email: string, password: string, fullName: string, travelPreference: Preference) {
  await request<User>('/mobile/auth/register', { method: 'POST', body: { email, password, fullName, travelPreference } });
  return login(email, password);
}
export async function logout() {
  if (pending) await pending.catch(() => {});
  const refreshToken = await SecureStore.getItemAsync(sessionKey);
  if (refreshToken) await request('/mobile/auth/logout', { method: 'POST', body: { refreshToken } });
  await SecureStore.deleteItemAsync(sessionKey);
  session = undefined;
}
export async function api<T>(path: string, options: Options = {}): Promise<T> {
  if (options.auth === false) return request<T>(path, options);
  const current = !session || expiresAt - Date.now() < 30_000 ? await refresh() : session;
  try { return await request<T>(path, options, current.accessToken); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const next = session && session !== current ? session : await refresh();
    return request<T>(path, options, next.accessToken);
  }
}

export const groupWalletApi = createGroupWalletClient(api);
