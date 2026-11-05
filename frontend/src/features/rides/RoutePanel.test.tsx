import { describe, expect, it } from 'vitest';
import { directionsUrl, routeDistance } from './RoutePanel';

describe('ride route preview', () => {
  it('estimates the short path across the antimeridian', () => {
    expect(routeDistance({
      pickup: { latitude: 0, longitude: 179 }, dropoff: { latitude: 0, longitude: -179 },
    })).toBeCloseTo(222.39, 1);
  });

  it('passes both pins to the fixed map origin without user or booking identifiers', () => {
    const url = new URL(directionsUrl({
      pickup: { latitude: 19.076, longitude: 72.8777 },
      dropoff: { latitude: 18.5204, longitude: 73.8567 },
    }));
    expect(url.origin).toBe('https://www.google.com');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api: '1', origin: '19.076,72.8777', destination: '18.5204,73.8567', travelmode: 'driving',
    });
  });
});
