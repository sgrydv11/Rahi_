import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRide, localDateTime, canManage, type RideInput, type Ride } from './api';

const valid = (): RideInput => ({ origin: 'Mumbai', destination: 'Pune', departureAt: '2090-01-01T00:00:00Z', timeZone: 'Asia/Kolkata',
  totalSeats: 3, pricePerSeat: '250.00', currency: 'INR', pickupDescription: '', dropoffDescription: '', vehicleDetails: '', notes: '' });
describe('ride validation and display', () => {
  it('accepts a future valid ride', () => { expect(validateRide(valid())).toBeNull(); });
  it.each([0, 7, 1.5])('rejects invalid seats %s', totalSeats => { expect(validateRide({ ...valid(), totalSeats })).toContain('seats'); });
  it.each(['-1', '1.001', 'abc', '10000000000'])('rejects invalid price %s', pricePerSeat => {
    expect(validateRide({ ...valid(), pricePerSeat })).toContain('price');
  });
  it('rejects past departure and same locations', () => {
    expect(validateRide({ ...valid(), departureAt: '2000-01-01T00:00:00Z' })).toContain('future');
    expect(validateRide({ ...valid(), destination: ' MUMBAI ' })).toContain('differ');
  });
  it('formats an instant as a local form value without changing minutes', () => {
    expect(localDateTime('2090-01-01T00:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it('only future scheduled rides are manageable', () => {
    const ride = { status: 'SCHEDULED', departureAt: '2090-01-01T00:00:00Z' } as Ride;
    expect(canManage(ride)).toBe(true); expect(canManage({ ...ride, status: 'CANCELLED' })).toBe(false);
    expect(canManage({ ...ride, departureAt: '2000-01-01T00:00:00Z' })).toBe(false);
  });
});

describe('ride API authentication', () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });
  it('uses the raw centralized client for public search', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ content: [], page: 0, totalPages: 0 }));
    vi.stubGlobal('fetch', fetcher);
    const { ridesApi } = await import('./api');
    await ridesApi.search(new URLSearchParams({ origin: 'Mumbai', minimumSeats: '2' }));
    expect(fetcher.mock.calls[0][0]).toContain('/rides?origin=Mumbai&minimumSeats=2');
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });
  it('uses bearer authentication and version for ride updates', async () => {
    const authenticatedRequest = vi.fn().mockResolvedValue({ id: 'ride' });
    vi.doMock('../auth/auth', () => ({ authenticatedRequest }));
    const { ridesApi } = await import('./api');
    await ridesApi.update('ride', valid(), 4);
    expect(authenticatedRequest).toHaveBeenCalledWith('/rides/ride', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse(authenticatedRequest.mock.calls[0][1].body).version).toBe(4);
    vi.doUnmock('../auth/auth');
  });
});
