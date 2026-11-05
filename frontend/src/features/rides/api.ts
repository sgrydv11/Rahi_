import { api } from '../../lib/api/client';
import { authenticatedRequest } from '../auth/auth';

export interface Point { latitude: number; longitude: number }
export interface RoutePins { pickup: Point; dropoff: Point }

export interface Ride {
  id: string; driver: { id: string; displayName: string }; origin: string; destination: string;
  pickupDescription: string | null; dropoffDescription: string | null; departureAt: string; timeZone: string;
  totalSeats: number; availableSeats: number; pricePerSeat: number; currency: string;
  vehicleDetails: string | null; notes: string | null; status: string; version: number;
  createdAt: string; updatedAt: string; cancelledAt: string | null; cancellationReason: string | null;
  startedAt?: string | null; completedAt?: string | null; canStart?: boolean;
  route?: RoutePins | null;
}
export interface RidePage { content: Ride[]; page: number; size: number; totalElements: number; totalPages: number }
export interface RideInput {
  origin: string; destination: string; pickupDescription: string; dropoffDescription: string;
  departureAt: string; timeZone: string; totalSeats: number; pricePerSeat: string; currency: string;
  vehicleDetails: string; notes: string;
  vehicleId?: string;
}
export const ridesApi = {
  search: (query: URLSearchParams, signal?: AbortSignal) => api<RidePage>(`/rides?${query}`, { signal }),
  details: (id: string, authenticated = false, signal?: AbortSignal) => (authenticated ? authenticatedRequest : api)<Ride>(`/rides/${encodeURIComponent(id)}`, { signal }),
  mine: (page = 0, signal?: AbortSignal) => authenticatedRequest<RidePage>(`/rides/me?page=${page}&size=10`, { signal }),
  create: (body: RideInput) => authenticatedRequest<Ride>('/rides', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: RideInput, version: number) => authenticatedRequest<Ride>(`/rides/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ ...body, version }) }),
  updateRoute: (id: string, version: number, pins: RoutePins | null) =>
    authenticatedRequest<Ride>(`/rides/${encodeURIComponent(id)}/route`, {
      method: 'PATCH', body: JSON.stringify({ version, pickup: pins?.pickup ?? null, dropoff: pins?.dropoff ?? null }),
    }),
  cancel: (id: string, version: number, reason: string) => authenticatedRequest<Ride>(`/rides/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ version, reason }) }),
  transition: (id: string, version: number, action: 'start' | 'complete') =>
    authenticatedRequest<Ride>(`/rides/${encodeURIComponent(id)}/${action}`, {
      method: 'POST', body: JSON.stringify({ version }),
    }),
};
export function localDateTime(instant: string) {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function validateRide(input: RideInput): string | null {
  if (!input.origin.trim() || !input.destination.trim()) return 'Enter an origin and destination.';
  if (input.origin.trim().toLowerCase() === input.destination.trim().toLowerCase()) return 'Origin and destination must differ.';
  if (input.origin.trim().length > 200 || input.destination.trim().length > 200) return 'Locations must be at most 200 characters.';
  if (!Number.isInteger(input.totalSeats) || input.totalSeats < 1 || input.totalSeats > 6) return 'Choose between 1 and 6 seats.';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.pricePerSeat)) return 'Enter a nonnegative price with up to 2 decimal places.';
  if (!/^[A-Z]{3}$/.test(input.currency)) return 'Enter a three-letter currency code, for example INR.';
  if (!Number.isFinite(Date.parse(input.departureAt)) || Date.parse(input.departureAt) <= Date.now()) return 'Departure must be in the future.';
  if (input.pickupDescription.length > 500 || input.dropoffDescription.length > 500) return 'Pickup and drop-off descriptions must be at most 500 characters.';
  if (input.vehicleDetails.length > 300 || input.notes.length > 2000) return 'Vehicle details or notes are too long.';
  return null;
}
export function departureLabel(ride: Ride) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: ride.timeZone }).format(new Date(ride.departureAt)) + ` (${ride.timeZone})`;
}
export function money(ride: Ride) { return `${ride.currency} ${Number(ride.pricePerSeat).toFixed(2)}`; }
export function canManage(ride: Ride) { return ride.status === 'SCHEDULED' && Date.parse(ride.departureAt) > Date.now(); }
