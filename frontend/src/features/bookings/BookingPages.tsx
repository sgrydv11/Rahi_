import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { Pagination } from '../rides/RideComponents';
import { bookingsApi, bookingStatus, type Booking, type BookingPage } from './api';

function BookingCard({ booking }: { booking: Booking }) {
  return <article className="panel ride-card"><div><p className="eyebrow">{bookingStatus(booking.status)}</p>
    <h2><Link to={`/bookings/${booking.id}`}>{booking.ride.origin} → {booking.ride.destination}</Link></h2>
    <p>Trip status: {bookingStatus(booking.ride.status)}</p>
    <p>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: booking.ride.timeZone }).format(new Date(booking.ride.departureAt))} ({booking.ride.timeZone})</p>
    <p>Passenger: {booking.passenger.displayName} · {booking.seats} seat{booking.seats > 1 ? 's' : ''}</p></div>
    <div><p>{booking.currency} {Number(booking.totalPrice).toFixed(2)} total</p><Link className="button button-small" to={`/bookings/${booking.id}`}>View booking</Link></div>
  </article>;
}
export function BookingListPage({ manifest = false }: { manifest?: boolean }) {
  const { id = '' } = useParams(); const [params, setParams] = useSearchParams();
  const parsed = Number(params.get('page') || 0); const page = Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000 ? parsed : 0;
  const [result, setResult] = useState<BookingPage | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const call = manifest ? bookingsApi.manifest(id, page, controller.signal) : bookingsApi.mine(page, controller.signal);
    call.then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, manifest, page]);
  return <section className="page"><h1>{manifest ? 'Ride bookings.' : 'My bookings.'}</h1>
    <Link to={manifest ? `/rides/${id}` : '/rides'}>{manifest ? '← Back to ride' : 'Find a ride'}</Link>
    {manifest && <p>Confirmed and cancelled bookings for your ride. Passenger contact details remain private.</p>}
    <div className="ride-results" aria-busy={loading}>{loading ? <p role="status">Loading bookings…</p> : error ? <p role="alert">{error}</p> : result && <>
      {!result.content.length && <p role="status">No bookings on this page.</p>}
      {result.content.map(booking => <BookingCard key={booking.id} booking={booking} />)}
      <Pagination page={page} totalPages={result.totalPages} onChange={number => setParams({ page: String(number) })} loading={loading} />
    </>}</div></section>;
}
export function BookingDetailsPage() {
  const { id = '' } = useParams(); const { user } = useAuth(); const location = useLocation();
  const [booking, setBooking] = useState<Booking | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(typeof location.state?.message === 'string' ? location.state.message : '');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    bookingsApi.details(id, controller.signal).then(value => { if (!controller.signal.aborted) setBooking(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const reason = String(new FormData(event.currentTarget).get('reason') || '');
    try { setBooking(await bookingsApi.cancel(id, reason)); setConfirm(false); setMessage('Cancellation recorded. Your seats have been released.'); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <section className="page"><Link to="/bookings/mine">← My bookings</Link><h1>Booking details.</h1>
    {loading ? <p role="status">Loading booking…</p> : booking ? <>
      {message && <p role="status">{message}</p>}<BookingCard booking={booking} />
      <div className="panel"><p>Booking reference: {booking.id}</p><p>Price agreed: {booking.currency} {Number(booking.pricePerSeat).toFixed(2)} per seat.</p>
        <p>No payment is collected by Hoopr in this phase.</p>
        {booking.cancelledAt && <p>Cancelled: {new Date(booking.cancelledAt).toLocaleString()}</p>}
        {booking.cancellationReason && <p>Reason: {booking.cancellationReason}</p>}
        {booking.ride.status !== 'IN_PROGRESS' && <Link to={`/rides/${booking.ride.id}`}>View ride</Link>}
      </div>
      {booking.canCancel && user?.id === booking.passenger.id && (!confirm ? <button className="button button-danger" onClick={() => setConfirm(true)}>Cancel booking</button> :
        <form className="panel auth-form" onSubmit={cancel} aria-busy={busy}><h2>Cancel this booking?</h2><p>All {booking.seats} seats in this booking will be released.</p>
          <label>Reason (optional)<textarea name="reason" maxLength={500} disabled={busy} /></label>
          <div className="ride-actions"><button className="button button-danger" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirm(false)}>Keep booking</button></div>
        </form>)}
      <button className="button button-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Reload booking</button>
    </> : null}{error && <p role="alert">{error}</p>}</section>;
}
