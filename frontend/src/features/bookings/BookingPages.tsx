import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { Pagination } from '../rides/RideComponents';
import { departureLabel } from '../rides/api';
import { bookingsApi, bookingStatus, type Booking, type BookingPage } from './api';
import { BookingRating } from './BookingRating';
import { RoutePreview } from '../rides/RoutePanel';
import { BookingPayment } from './BookingPayment';

function BookingCard({ booking }: { booking: Booking }) {
  return <article className="panel ride-card"><div><p className="eyebrow">{bookingStatus(booking.status)}</p>
    <h2><Link to={`/bookings/${booking.id}`}>{booking.ride.origin} → {booking.ride.destination}</Link></h2>
    <p>Trip status: {bookingStatus(booking.ride.status)}</p>
    <p>{departureLabel(booking.ride)}</p>
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
    {manifest && <p>Booking requests and passenger bookings for your ride. Passenger contact details remain private.</p>}
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
  useEffect(() => {
    if (!booking || booking.status !== 'CONFIRMED' || busy || confirm || loading ||
        !['SCHEDULED', 'IN_PROGRESS'].includes(booking.ride.status)) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (booking.ride.status === 'SCHEDULED' && Date.parse(booking.ride.departureAt) > Date.now()) return;
      void bookingsApi.details(id, controller.signal).then(value => {
        if (!controller.signal.aborted) setBooking(value);
      }).catch(() => { /* Preserve the current details during a temporary outage. */ });
    }, 30000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [id, booking, busy, confirm, loading]);
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
  async function decide(decision: 'accept' | 'decline') {
    setBusy(true); setError('');
    try { setBooking(await bookingsApi.decide(id, decision)); setMessage(decision === 'accept' ? 'Request accepted.' : 'Request declined.'); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  async function rate(score: number, review?: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setBooking(await bookingsApi.rate(id, score, review));
      setMessage('Rating saved.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return <section className="page"><Link to="/bookings/mine">← My bookings</Link><h1>Booking details.</h1>
    {loading ? <p role="status">Loading booking…</p> : booking ? <>
      {message && <p role="status">{message}</p>}<BookingCard booking={booking} />
      <div className="panel"><p>Booking reference: {booking.id}</p><p>Price agreed: {booking.currency} {Number(booking.pricePerSeat).toFixed(2)} per seat.</p>
        {booking.details && <><p>Demo payment choice: {booking.details.demoPaymentMethod || 'DIRECT'} · No payment collected by this choice.</p><p>Boarding: {booking.details.boardingPoint} · Dropping: {booking.details.droppingPoint}</p>
          {booking.details.passengers.map((person, index) => <p key={index}>{person.name} · {person.age} · {person.gender}</p>)}</>}
        {booking.cancelledAt && <p>Cancelled: {new Date(booking.cancelledAt).toLocaleString()}</p>}
        {booking.cancellationReason && <p>Reason: {booking.cancellationReason}</p>}
        {booking.ride.status !== 'IN_PROGRESS' && <Link to={`/rides/${booking.ride.id}`}>View ride</Link>}
      </div>
      {booking.status === 'PENDING' && <div className="panel">
        <p>Awaiting driver approval. Seats are reserved only after acceptance.</p>
        {booking.requestExpiresAt && <p>Request expires {new Date(booking.requestExpiresAt).toLocaleString()}.</p>}
        {user?.id === booking.ride.driverId && <div className="ride-actions">
          <button className="button" disabled={busy} onClick={() => void decide('accept')}>Accept request</button>
          <button className="button button-secondary" disabled={busy} onClick={() => void decide('decline')}>Decline request</button>
        </div>}
      </div>}
      <BookingRating booking={booking} viewerId={user?.id} busy={busy} onRate={rate} />
      {booking.ride.route && <RoutePreview pins={booking.ride.route} />}
      {user?.id === booking.passenger.id && booking.status !== 'PENDING' && <BookingPayment key={booking.id} booking={booking} />}
      {booking.canCancel && user?.id === booking.passenger.id && (!confirm ? <button className="button button-danger" onClick={() => setConfirm(true)}>Cancel booking</button> :
        <form className="panel auth-form" onSubmit={cancel} aria-busy={busy}><h2>Cancel this booking?</h2><p>{booking.status === 'PENDING' ? 'Your request will be withdrawn.' : `All ${booking.seats} seats in this booking will be released.`}</p>
          <label>Reason (optional)<textarea name="reason" maxLength={500} disabled={busy} /></label>
          <div className="ride-actions"><button className="button button-danger" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button>
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirm(false)}>Keep booking</button></div>
        </form>)}
      <button className="button button-secondary" disabled={busy} onClick={() => setRevision(value => value + 1)}>Reload booking</button>
    </> : null}{error && <p role="alert">{error}</p>}</section>;
}
