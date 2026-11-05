import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ride } from '../rides/api';

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: state.user, loading: false }) }));
import { BookSeats } from './BookSeats';
const ride = { id: 'ride', driver: { id: 'driver' }, status: 'SCHEDULED', departureAt: '2090-01-01T10:00:00Z', availableSeats: 2, pricePerSeat: 125.50, currency: 'INR' } as Ride;
describe('booking controls', () => {
  beforeEach(() => { state.user = null; });
  const render = (value = ride) => renderToString(<MemoryRouter><BookSeats ride={value} /></MemoryRouter>);
  it('asks visitors to log in and hides booking on cancelled rides', () => {
    expect(render()).toContain('Log in to book seats'); expect(render({ ...ride, status: 'CANCELLED' })).toBe('');
  });
  it('never offers self-booking or seats on a full ride', () => {
    state.user = { id: 'driver' }; expect(render()).toBe('');
    state.user = { id: 'passenger' }; expect(render({ ...ride, availableSeats: 0 })).toContain('fully booked');
  });
  it.each(['IN_PROGRESS', 'COMPLETED'])('hides booking controls for a trip in state %s', status => {
    state.user = { id: 'passenger' };
    expect(render({ ...ride, status })).toBe('');
  });
  it('hides booking controls after the scheduled departure', () => {
    state.user = { id: 'passenger' };
    expect(render({ ...ride, departureAt: '2000-01-01T10:00:00Z' })).toBe('');
  });
  it('shows available seat choices, the total, and review before confirmation', () => {
    state.user = { id: 'passenger' }; const html = render();
    expect(html).toContain('Review booking'); expect(html).toContain('INR'); expect(html).toContain('125.50');
    expect(html).toContain('value="2"'); expect(html).not.toContain('value="3"'); expect(html).toContain('No payment is collected');
  });
});

describe('booking retry contract', () => {
  it('keeps the caller key and seat count unchanged on a retry and never sends a price or passenger ID', async () => {
    const authenticatedRequest = vi.fn().mockRejectedValueOnce(new TypeError('Network unavailable')).mockResolvedValue({ id: 'booking' });
    vi.doMock('../auth/auth', () => ({ authenticatedRequest })); vi.resetModules();
    const { bookingsApi } = await import('./api');
    await expect(bookingsApi.create('ride', 2, 'same-request', 3)).rejects.toThrow('Network unavailable');
    await bookingsApi.create('ride', 2, 'same-request', 3);
    expect(authenticatedRequest.mock.calls[0]).toEqual(authenticatedRequest.mock.calls[1]);
    expect(authenticatedRequest.mock.calls[1][1]).toMatchObject({ headers: { 'Idempotency-Key': 'same-request' }, body: '{"seats":2,"rideVersion":3}' });
    vi.doUnmock('../auth/auth');
  });
});
