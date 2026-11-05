import { describe, expect, it } from 'vitest';
import { demoRideCount, findDemoRide, searchDemoRides } from './demoData';

describe('sample ride data', () => {
  it('provides future scheduled rides for a demo build', () => {
    const result = searchDemoRides(new URLSearchParams());
    expect(demoRideCount()).toBe(4);
    expect(result.totalElements).toBe(4);
    expect(result.content.every(ride => Date.parse(ride.departureAt) > Date.now())).toBe(true);
    expect(result.content.every(ride => ride.status === 'SCHEDULED')).toBe(true);
  });

  it('filters sample rides and paginates results', () => {
    const filtered = searchDemoRides(new URLSearchParams({ origin: 'mum', destination: 'pune' }));
    expect(filtered.content.map(ride => ride.id)).toEqual(['demo-mumbai-pune']);

    const page = searchDemoRides(new URLSearchParams({ size: '2', page: '1' }));
    expect(page.content).toHaveLength(2);
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(2);
  });

  it('looks up a sample ride and respects cancellation', () => {
    expect(findDemoRide('demo-delhi-jaipur')?.destination).toBe('Jaipur');
    expect(findDemoRide('unknown')).toBeNull();
    const controller = new AbortController();
    controller.abort();
    expect(() => searchDemoRides(new URLSearchParams(), controller.signal)).toThrow('aborted');
  });
});
