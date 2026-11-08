import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Booking } from './api';

export function BookingRating({ booking, viewerId, busy, onRate }: {
  booking: Booking;
  viewerId?: string;
  busy: boolean;
  onRate: (score: number, review?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const eligible = viewerId === booking.passenger.id && viewerId !== booking.ride.driverId && !booking.rating
    && booking.status === 'CONFIRMED' && booking.ride.status === 'COMPLETED';
  useEffect(() => {
    if (eligible && !dismissed && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [eligible, dismissed]);
  if (booking.rating) {
    return <section className="panel"><h2>Driver rating</h2><p>{booking.rating.score} out of 5</p></section>;
  }
  if (viewerId !== booking.passenger.id || viewerId === booking.ride.driverId ||
      booking.status !== 'CONFIRMED' || booking.ride.status !== 'COMPLETED') return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget); const score = Number(data.get('score'));
    if (!busy && Number.isInteger(score) && score >= 1 && score <= 5) onRate(score, String(data.get('review') || '').trim());
  }

  if (dismissed) return <button className="button" onClick={() => setDismissed(false)}>Rate your journey</button>;
  return <dialog ref={dialog} aria-label="Rate your journey" onCancel={() => setDismissed(true)}><form className="panel auth-form" onSubmit={submit} aria-busy={busy}>
    <h2>Rate your driver</h2>
    <p>The driver can see your score on this booking. You can submit one rating.</p>
    <label>Score
      <select name="score" defaultValue="" required disabled={busy}>
        <option value="" disabled>Choose a score</option>
        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score} out of 5</option>)}
      </select>
    </label>
    <label>Review (optional, public)<textarea name="review" maxLength={1000} disabled={busy} /></label>
    <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Submit rating'}</button>
    <button type="button" disabled={busy} onClick={() => setDismissed(true)}>Later</button>
  </form></dialog>;
}
