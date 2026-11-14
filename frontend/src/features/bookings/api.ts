import { authenticatedRequest } from '../auth/auth';
import type { RoutePins } from '../rides/api';
export interface Booking {
  id: string;
  ride: { id: string; driverId: string; origin: string; destination: string; departureAt: string; timeZone: string; status: string; route?: RoutePins | null };
  passenger: { id: string; displayName: string };
  seats: number; pricePerSeat: number; totalPrice: number; currency: string; status: string; version: number;
  canCancel: boolean; createdAt: string; updatedAt: string; cancelledAt: string | null; cancellationReason: string | null;
  rating: { score: number; ratedAt: string; review?: string } | null;
  details?: JourneyDetails;
  requestExpiresAt?: string | null;
}
export interface JourneyDetails {
  demoPaymentMethod?: 'DIRECT'|'QR'|'OTHER';
  boardingPoint: string; droppingPoint: string;
  passengers: { name: string; age: number; gender: 'FEMALE' | 'MALE' | 'OTHER' }[];
}
export interface BookingPage { content: Booking[]; page: number; size: number; totalElements: number; totalPages: number }
export const bookingsApi = {
  create: (ride: string, seats: number, key: string, rideVersion?: number, details?: JourneyDetails) => authenticatedRequest<Booking>(`/rides/${encodeURIComponent(ride)}/bookings`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ seats, rideVersion, details }),
  }),
  mine: (page = 0, signal?: AbortSignal) => authenticatedRequest<BookingPage>(`/bookings/me?page=${page}&size=10`, { signal }),
  manifest: (ride: string, page = 0, signal?: AbortSignal) => authenticatedRequest<BookingPage>(`/rides/${encodeURIComponent(ride)}/bookings?page=${page}&size=10`, { signal }),
  details: (id: string, signal?: AbortSignal) => authenticatedRequest<Booking>(`/bookings/${encodeURIComponent(id)}`, { signal }),
  decide: (id: string, decision: 'accept' | 'decline') => authenticatedRequest<Booking>(`/bookings/${encodeURIComponent(id)}/${decision}`, { method: 'POST' }),
  cancel: (id: string, reason: string) => authenticatedRequest<Booking>(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  rate: (id: string, score: number, review?: string) => authenticatedRequest<Booking>(`/bookings/${encodeURIComponent(id)}/rating`, {
    method: 'POST', body: JSON.stringify({ score, review }),
  }),
};
export function bookingStatus(status: string) { return status.replaceAll('_', ' ').toLowerCase(); }
