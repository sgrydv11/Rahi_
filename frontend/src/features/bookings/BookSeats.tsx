import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { ApiError } from '../../lib/api/client';
import { canManage, demoMode, type Ride } from '../rides/api';
import { bookingsApi, type JourneyDetails } from './api';

export function BookSeats({ ride, requestedSeats = 1 }: { ride: Ride; requestedSeats?: number }) {
  const returnPath = `/rides/${ride.id}${requestedSeats > 1 ? `?seats=${requestedSeats}` : ''}`;
  const { user } = useAuth(); const navigate = useNavigate();
  const [seats, setSeats] = useState(() => Math.max(1, Math.min(requestedSeats, ride.availableSeats))); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [recent, setRecent] = useState<JourneyDetails['passengers']>([]);
  // Keep the same request after an uncertain network/server failure, until a definitive response.
  const request = useRef<{ key: string; seats: number; version: number; details: JourneyDetails } | null>(null);
  const review = useRef<JourneyDetails | null>(null);
  useEffect(() => {
    if (!user || !started) return;
    const controller = new AbortController();
    bookingsApi.mine(0, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      const unique = new Map<string, JourneyDetails['passengers'][number]>();
      page.content.flatMap(booking => booking.details?.passengers || []).forEach(person => unique.set(JSON.stringify(person), person));
      setRecent([...unique.values()]);
    }).catch(() => { /* Manual passenger entry remains available. */ });
    return () => controller.abort();
  }, [user?.id, started]);
  function selectRecent(event: ChangeEvent<HTMLSelectElement>, index: number) {
    const person = recent[Number(event.target.value)]; const form = event.currentTarget.form;
    if (!person || !form || event.target.value === '') return;
    for (const key of ['name', 'age', 'gender'] as const) {
      const input = form.elements.namedItem(key + index) as HTMLInputElement | HTMLSelectElement | null;
      if (input) input.value = String(person[key]);
    }
  }
  if (user?.id === ride.driver.id || !canManage(ride)) return null;
  if (!ride.availableSeats) return <p className="notice">This ride is fully booked.</p>;
  if (demoMode) return <p className="notice">Seat booking is not available in this sample app.</p>;
  if (!started) return <>
    {requestedSeats > ride.availableSeats && <p className="notice">Only {ride.availableSeats} seats remain. You can choose a smaller group.</p>}
    <button className="button" onClick={() => setStarted(true)}>{ride.preferences?.requiresApproval ? 'Request seats' : 'Book Seat'}</button>
  </>;
  if (!user) return <section className="panel"><h2>Sign in to book</h2><div className="ride-actions">
    <Link to="/login" state={{ from: returnPath }}>Log in</Link>
    <Link to="/register" state={{ from: returnPath }}>Create account</Link>
  </div></section>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(seats) || seats < 1 || seats > ride.availableSeats) { setError('Choose a valid number of available seats.'); return; }
    const data = new FormData(event.currentTarget);
    const details: JourneyDetails = confirm && review.current ? review.current : {
      boardingPoint: String(data.get('boardingPoint') || ''), droppingPoint: String(data.get('droppingPoint') || ''),
      passengers: Array.from({ length: seats }, (_, index) => ({ name: String(data.get(`name${index}`) || '').trim(),
        age: Number(data.get(`age${index}`)), gender: String(data.get(`gender${index}`)) as 'FEMALE' | 'MALE' | 'OTHER' })),
    };
    if (!confirm && (!details.boardingPoint || !details.droppingPoint || details.passengers.some((person, index) =>
      !/^\p{L}[\p{L}\p{M} .'-]{0,119}$/u.test(person.name) || !String(data.get(`age${index}`) || '').trim()
      || !Number.isInteger(person.age) || person.age < 0 || person.age > 120 || !['FEMALE', 'MALE', 'OTHER'].includes(person.gender)))) {
      setError('Select stops and enter a valid name, age and gender for each passenger.'); return;
    }
    if (!confirm) { review.current = details; setConfirm(true); return; }
    const pending = request.current ?? { key: crypto.randomUUID(), seats, version: ride.version, details }; request.current = pending;
    setBusy(true); setError('');
    try { const booking = await bookingsApi.create(ride.id, pending.seats, pending.key, pending.version, pending.details); navigate(`/bookings/${booking.id}`, { state: { message: booking.status === 'CONFIRMED' ? 'Your seats are confirmed.' : booking.status === 'PENDING' ? 'Request sent. Your seats are not reserved until the driver accepts.' : 'This request was already recorded. Check its current booking status below.' } }); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) { request.current = null; setConfirm(false); }
      setError(errorMessage(failure));
    } finally { setBusy(false); }
  }
  return <form className="panel auth-form" onSubmit={submit} aria-busy={busy}>
    <h2>Book your seats</h2><label>Seats<select value={seats} disabled={busy || confirm} onChange={event => setSeats(Number(event.target.value))}>
      {Array.from({ length: ride.availableSeats }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
    </select></label>
    <label>Boarding point<select name="boardingPoint" required disabled={busy || confirm} defaultValue=""><option value="">Select boarding point</option>{(ride.preferences?.boardingPoints || [ride.origin]).map(point => <option key={point}>{point}</option>)}</select></label>
    <label>Dropping point<select name="droppingPoint" required disabled={busy || confirm} defaultValue=""><option value="">Select dropping point</option>{(ride.preferences?.droppingPoints || [ride.destination]).map(point => <option key={point}>{point}</option>)}</select></label>
    {Array.from({ length: seats }, (_, index) => <fieldset key={index} disabled={busy || confirm}>
      <legend>Passenger {index + 1}</legend>
      {recent.length > 0 && <label>Recent passenger<select defaultValue="" onChange={event => selectRecent(event, index)}><option value="">Add passenger below</option>
        {recent.filter(person => !ride.preferences?.womenOnly || person.gender === 'FEMALE').map(person => <option key={JSON.stringify(person)} value={recent.indexOf(person)}>{person.name}, {person.age}</option>)}
      </select></label>}
      <label>Name<input name={`name${index}`} required maxLength={120} /></label>
      <label>Age<input name={`age${index}`} type="number" required min={0} max={120} step={1} /></label>
      <label>Gender<select name={`gender${index}`} required defaultValue=""><option value="">Select gender</option><option value="FEMALE">Female</option>{!ride.preferences?.womenOnly && <><option value="MALE">Male</option><option value="OTHER">Other</option></>}</select></label>
    </fieldset>)}
    <p>Total: <strong>{ride.currency} {(Number(ride.pricePerSeat) * seats).toFixed(2)}</strong>. No payment is collected here.</p>
    {confirm && <p role="status">{ride.preferences?.requiresApproval
      ? `Request ${seats} seat${seats > 1 ? 's' : ''}. The driver must accept before seats are reserved.`
      : `Confirm ${seats} seat${seats > 1 ? 's' : ''}. Availability is checked when you confirm.`}</p>}
    {error && <p role="alert">{error} Reload the ride if availability has changed.</p>}
    <div className="ride-actions"><button className="button" disabled={busy}>{busy ? 'Booking…' : confirm ? (ride.preferences?.requiresApproval ? 'Send request' : 'Confirm booking') : 'Review booking'}</button>
      {confirm && !request.current && <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirm(false)}>Change seats</button>}
    </div>
    <Link to="/bookings/mine">View My Bookings before starting another request</Link>
  </form>;
}
