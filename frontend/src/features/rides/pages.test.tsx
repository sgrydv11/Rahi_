import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RideForm } from './RideForm';
import { RideCard } from './RideComponents';
import { CancelRideDialog } from './CancelRideDialog';
import type { Ride } from './api';

const ride: Ride = {
  id: 'test-ride', driver: { id: 'driver', displayName: 'Alice' }, origin: 'Mumbai', destination: 'Pune',
  pickupDescription: null, dropoffDescription: null, departureAt: '2090-01-01T10:00:00Z', timeZone: 'Asia/Kolkata',
  totalSeats: 3, availableSeats: 3, pricePerSeat: 250, currency: 'INR', vehicleDetails: null, notes: null,
  status: 'SCHEDULED', version: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  cancelledAt: null, cancellationReason: null,
};
describe('ride UI', () => {
  it('renders a labelled creation form with seat and money limits and no owner input', () => {
    const html = renderToString(<RideForm save={async () => {}} />);
    expect(html).toContain('Leaving from'); expect(html).toContain('Going to'); expect(html).toContain('Departure');
    expect(html).toContain('Do you have a car?'); expect(html).toContain('Boarding points');
    expect(html).toContain('Car has AC'); expect(html).toContain('Home to Office');
    expect(html).toContain('min="1"'); expect(html).toContain('max="6"'); expect(html).toContain('step="0.01"');
    expect(html).toContain('Offer this ride'); expect(html).not.toContain('name="driverId"');
  });
  it('renders real ride details and safe driver data on a card', () => {
    const html = renderToString(<MemoryRouter><RideCard ride={ride} /></MemoryRouter>);
    expect(html).toContain('Mumbai'); expect(html).toContain('Pune'); expect(html).toContain('INR 250.00');
    expect(html).toContain('Alice'); expect(html).toContain('/rides/test-ride'); expect(html).not.toContain('Book now');
  });
  it.each(['UTC+05:30', 'GMT+05:30', 'Z'])('keeps legacy zone %s from crashing a card', timeZone => {
    const html = renderToString(<MemoryRouter><RideCard ride={{ ...ride, timeZone }} /></MemoryRouter>);
    expect(html).toContain('UTC'); expect(html).toContain('Mumbai');
  });
  it('keeps a legacy out-of-range departure from crashing a card', () => {
    const html = renderToString(<MemoryRouter><RideCard ride={{ ...ride, departureAt: '+280000-01-01T00:00:00Z' }} /></MemoryRouter>);
    expect(html).toContain('Departure time unavailable');
  });
  it('renders an accessible cancellation dialog with a separate confirmation action', () => {
    const html = renderToString(<CancelRideDialog ride={ride} cancelled={() => {}} />);
    expect(html).toContain('aria-labelledby="cancel-ride-title"'); expect(html).toContain('Keep ride');
    expect(html).toContain('Confirm cancellation'); expect(html).toContain('Reason (optional)');
  });
});
