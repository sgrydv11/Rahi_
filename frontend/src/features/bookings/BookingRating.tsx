import type { FormEvent } from 'react';
import type { Booking } from './api';

export function BookingRating({ booking, viewerId, busy, onRate }: {
  booking: Booking;
  viewerId?: string;
  busy: boolean;
  onRate: (score: number) => void;
}) {
  if (booking.rating) {
    return <section className="panel"><h2>Driver rating</h2><p>{booking.rating.score} out of 5</p></section>;
  }
  if (viewerId !== booking.passenger.id || viewerId === booking.ride.driverId ||
      booking.status !== 'CONFIRMED' || booking.ride.status !== 'COMPLETED') return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const score = Number(new FormData(event.currentTarget).get('score'));
    if (!busy && Number.isInteger(score) && score >= 1 && score <= 5) onRate(score);
  }

  return <form className="panel auth-form" onSubmit={submit} aria-busy={busy}>
    <h2>Rate your driver</h2>
    <p>The driver can see your score on this booking. You can submit one rating.</p>
    <label>Score
      <select name="score" defaultValue="" required disabled={busy}>
        <option value="" disabled>Choose a score</option>
        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score} out of 5</option>)}
      </select>
    </label>
    <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Submit rating'}</button>
  </form>;
}
