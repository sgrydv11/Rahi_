import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { ApiError } from '../../lib/api/client';
import { canManage, demoMode, type Ride } from '../rides/api';
import { bookingsApi } from './api';

export function BookSeats({ ride }: { ride: Ride }) {
  const { user } = useAuth(); const navigate = useNavigate();
  const [seats, setSeats] = useState(1); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  // Keep the same request after an uncertain network/server failure, until a definitive response.
  const request = useRef<{ key: string; seats: number; version: number } | null>(null);
  if (user?.id === ride.driver.id || !canManage(ride)) return null;
  if (!ride.availableSeats) return <p className="notice">This ride is fully booked.</p>;
  if (demoMode) return <p className="notice">Seat booking is not available in this sample app.</p>;
  if (!user) return <p><Link className="button" to="/login" state={{ from: `/rides/${ride.id}` }}>Log in to book seats</Link></p>;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!Number.isInteger(seats) || seats < 1 || seats > ride.availableSeats) { setError('Choose a valid number of available seats.'); return; }
    if (!confirm) { setConfirm(true); return; }
    const pending = request.current ?? { key: crypto.randomUUID(), seats, version: ride.version }; request.current = pending;
    setBusy(true); setError('');
    try { const booking = await bookingsApi.create(ride.id, pending.seats, pending.key, pending.version); navigate(`/bookings/${booking.id}`, { state: { message: booking.status === 'CONFIRMED' ? 'Your seats are confirmed.' : 'This request was already recorded. Check its current booking status below.' } }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) { request.current = null; setConfirm(false); }
      setError(errorMessage(failure));
    } finally { setBusy(false); }
  }
  return <form className="panel auth-form" onSubmit={submit} aria-busy={busy}>
    <h2>Book your seats</h2><label>Seats<select value={seats} disabled={busy || confirm} onChange={event => setSeats(Number(event.target.value))}>
      {Array.from({ length: ride.availableSeats }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <p>Total: <strong>{ride.currency} {(Number(ride.pricePerSeat) * seats).toFixed(2)}</strong>. No payment is collected here.</p>
    {confirm && <p role="status">Confirm {seats} seat{seats > 1 ? 's' : ''} on this ride. Availability is checked when you confirm.</p>}
    {error && <p role="alert">{error} Reload the ride if availability has changed.</p>}
    <div className="ride-actions"><button className="button" disabled={busy}>{busy ? 'Booking…' : confirm ? 'Confirm booking' : 'Review booking'}</button>
      {confirm && !request.current && <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirm(false)}>Change seats</button>}
    </div>
    <Link to="/bookings/mine">View My Bookings before starting another request</Link>
  </form>;
}
