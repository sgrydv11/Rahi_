import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BookingRating } from './BookingRating';
import type { Booking } from './api';

const booking: Booking = {
  id: 'booking', ride: { id: 'ride', driverId: 'driver', origin: 'A', destination: 'B',
    departureAt: '2026-11-05T10:00:00Z', timeZone: 'UTC', status: 'COMPLETED' },
  passenger: { id: 'passenger', displayName: 'Passenger' }, seats: 1, pricePerSeat: 125,
  totalPrice: 125, currency: 'INR', status: 'CONFIRMED', version: 1, canCancel: false,
  createdAt: '2026-11-04T10:00:00Z', updatedAt: '2026-11-05T11:00:00Z',
  cancelledAt: null, cancellationReason: null, rating: null,
};
const render = (value: Booking, viewerId = 'passenger') =>
  renderToStaticMarkup(<BookingRating booking={value} viewerId={viewerId} busy={false} onRate={vi.fn()} />);

describe('post-trip rating controls', () => {
  it('offers a required score from 1 to 5 to the confirmed passenger', () => {
    const html = render(booking);
    expect(html).toContain('Submit rating');
    expect(html).toContain('required');
    expect(html).toContain('1 out of 5');
    expect(html).toContain('5 out of 5');
  });

  it('hides submission for the driver, cancelled bookings, and unfinished trips', () => {
    expect(render(booking, 'driver')).toBe('');
    expect(render({ ...booking, status: 'CANCELLED_BY_PASSENGER' })).toBe('');
    expect(render({ ...booking, ride: { ...booking.ride, status: 'IN_PROGRESS' } })).toBe('');
  });

  it('shows a saved score to the passenger and driver without an edit form', () => {
    const rated = { ...booking, rating: { score: 4, ratedAt: '2026-11-05T11:00:00Z' } };
    for (const viewer of ['passenger', 'driver']) {
      const html = render(rated, viewer);
      expect(html).toContain('4 out of 5');
      expect(html).not.toContain('Submit rating');
    }
  });
});
