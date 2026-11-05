import { useState, type FormEvent } from 'react';
import { localDateTime, validateRide, type Ride, type RideInput } from './api';
import { errorMessage } from '../auth/auth';
export function RideForm({ ride, save }: { ride?: Ride; save: (body: RideInput) => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    const local = text('departure'); const date = new Date(local);
    if (!Number.isFinite(date.getTime()) || localDateTime(date.toISOString()) !== local) { setError('Choose a valid local departure time.'); return; }
    const body: RideInput = {
      origin: text('origin'), destination: text('destination'), pickupDescription: text('pickupDescription'),
      dropoffDescription: text('dropoffDescription'), departureAt: date.toISOString(), timeZone,
      totalSeats: Number(text('totalSeats')), pricePerSeat: text('pricePerSeat'), currency: text('currency').toUpperCase(),
      vehicleDetails: text('vehicleDetails'), notes: text('notes'),
    };
    const invalid = validateRide(body); if (invalid) { setError(invalid); return; }
    setBusy(true);
    try { await save(body); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <form className="panel" onSubmit={submit} aria-busy={busy}>
    <fieldset className="ride-form" disabled={busy}>
      <legend>{ride ? 'Edit your offer' : 'Your journey details'}</legend>
      <label>Leaving from<input name="origin" required maxLength={200} defaultValue={ride?.origin} /></label>
      <label>Going to<input name="destination" required maxLength={200} defaultValue={ride?.destination} /></label>
      <label>Departure ({timeZone})<input name="departure" type="datetime-local" required defaultValue={ride ? localDateTime(ride.departureAt) : ''} /></label>
      <label>Seats offered<input name="totalSeats" type="number" required min={1} max={6} step={1} defaultValue={ride?.totalSeats ?? 1} /></label>
      <label>Price per seat<input name="pricePerSeat" type="number" required min={0} max="9999999999.99" step="0.01" defaultValue={ride?.pricePerSeat ?? '0.00'} /></label>
      <label>Currency<input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={ride?.currency ?? 'INR'} /></label>
      <label>Pickup description (optional)<input name="pickupDescription" maxLength={500} defaultValue={ride?.pickupDescription ?? ''} /></label>
      <label>Drop-off description (optional)<input name="dropoffDescription" maxLength={500} defaultValue={ride?.dropoffDescription ?? ''} /></label>
      <label className="form-wide">Vehicle details (optional)<input name="vehicleDetails" maxLength={300} placeholder="For example, blue Suzuki Swift" defaultValue={ride?.vehicleDetails ?? ''} /></label>
      <label className="form-wide">Notes (optional)<textarea name="notes" maxLength={2000} rows={4} defaultValue={ride?.notes ?? ''} /></label>
      <p className="notice form-wide">Departure is entered in {timeZone}. Ride descriptions and notes are public. Leave out private contact details.</p>
      {error && <p className="form-wide" role="alert">{error}</p>}
      <button className="button" type="submit">{busy ? 'Saving…' : ride ? 'Save changes' : 'Offer this ride'}</button>
    </fieldset>
  </form>;
}
