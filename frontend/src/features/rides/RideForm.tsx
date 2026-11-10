import { useEffect, useState, type FormEvent } from 'react';
import { listVehicles, type Vehicle } from '../vehicles/VehiclesPage';
import { localDateTime, validateRide, type Ride, type RideInput } from './api';
import { errorMessage } from '../auth/auth';
export function RideForm({ ride, save }: { ride?: Ride; save: (body: RideInput) => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    if (ride) return;
    const controller = new AbortController();
    listVehicles(controller.signal)
      .then(items => { if (!controller.signal.aborted) setVehicles(items.filter(item => item.active)); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [ride]);
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
      vehicleId: text('vehicleId') || undefined,
      preferences: {
        boardingPoints: text('boardingPoints').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
        droppingPoints: text('droppingPoints').split(/\r?\n/).map(value => value.trim()).filter(Boolean),
        hasCar: text('hasCar') === 'yes', ac: data.has('ac'), flexibleDropoff: data.has('flexibleDropoff'),
        requiresApproval: data.has('requiresApproval'),
        womenOnly: data.has('womenOnly'), routeType: text('routeType') as 'HOME_TO_OFFICE' | 'OFFICE_TO_HOME' | 'OTHER',
      },
    };
    const invalid = validateRide(body); if (invalid) { setError(invalid); return; }
    if (!body.preferences?.hasCar) { setError('A car is required to offer a carpool ride.'); return; }
    if (!body.preferences.boardingPoints.length || !body.preferences.droppingPoints.length) { setError('Add boarding and dropping points.'); return; }
    setBusy(true);
    try { await save(body); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <form className="panel" onSubmit={submit} aria-busy={busy}>
    <fieldset className="ride-form" disabled={busy}>
      <legend>{ride ? 'Edit your offer' : 'Your journey details'}</legend>
      <label>Leaving from<input name="origin" required maxLength={200} defaultValue={ride?.origin} /></label>
      <label>Going to<input name="destination" required maxLength={200} defaultValue={ride?.destination} /></label>
      <label>Departure<input name="departure" type="datetime-local" required defaultValue={ride ? localDateTime(ride.departureAt) : ''} /></label>
      <label>Do you have a car?<select name="hasCar" required defaultValue={ride?.preferences?.hasCar ? 'yes' : ''}><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Route type<select name="routeType" defaultValue={ride?.preferences?.routeType || 'OTHER'}><option value="HOME_TO_OFFICE">Home to Office</option><option value="OFFICE_TO_HOME">Office to Home</option><option value="OTHER">Other</option></select></label>
      <label>Boarding points, one per line<textarea name="boardingPoints" required defaultValue={ride?.preferences?.boardingPoints.join('\n') || ride?.origin || ''} /></label>
      <label>Dropping points, one per line<textarea name="droppingPoints" required defaultValue={ride?.preferences?.droppingPoints.join('\n') || ride?.destination || ''} /></label>
      <label><input name="ac" type="checkbox" defaultChecked={ride?.preferences?.ac === true} />Car has AC</label>
      <label><input name="flexibleDropoff" type="checkbox" defaultChecked={ride?.preferences?.flexibleDropoff} />Agree to nearby requested drop-off, by arrangement</label>
      <label><input name="womenOnly" type="checkbox" defaultChecked={ride?.preferences?.womenOnly} />Women-only ride</label>
      <label><input name="requiresApproval" type="checkbox" defaultChecked={ride?.preferences?.requiresApproval} /> Review booking requests before confirming seats</label>
      <label>Seats offered<input name="totalSeats" type="number" required min={1} max={6} step={1} defaultValue={ride?.totalSeats ?? 1} /></label>
      <label>Price per seat<input name="pricePerSeat" type="number" required min={0} max="9999999999.99" step="0.01" defaultValue={ride?.pricePerSeat ?? '0.00'} /></label>
      <label>Currency<input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={ride?.currency ?? 'INR'} /></label>
      <label>Pickup description (optional)<input name="pickupDescription" maxLength={500} defaultValue={ride?.pickupDescription ?? ''} /></label>
      <label>Drop-off description (optional)<input name="dropoffDescription" maxLength={500} defaultValue={ride?.dropoffDescription ?? ''} /></label>
      {!ride && vehicles.length > 0 && <label>Saved vehicle<select name="vehicleId" defaultValue="">
        <option value="">Enter vehicle details manually</option>
        {vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>
          {vehicle.make} {vehicle.model} ({vehicle.passengerCapacity} seats)
        </option>)}
      </select></label>}
      <label className="form-wide">Vehicle details (optional)<input name="vehicleDetails" maxLength={300} placeholder="For example, blue Suzuki Swift" defaultValue={ride?.vehicleDetails ?? ''} /></label>
      <label className="form-wide">Notes (optional)<textarea name="notes" maxLength={2000} rows={4} defaultValue={ride?.notes ?? ''} /></label>
      <p className="notice form-wide">What You See Is What You Pay – No Hidden Charges, No Convenience Fees!</p>
      <p className="notice form-wide">Ride descriptions and notes are public. Leave out private contact details.</p>
      {error && <p className="form-wide" role="alert">{error}</p>}
      <button className="button" type="submit">{busy ? 'Saving…' : ride ? 'Save changes' : 'Offer this ride'}</button>
    </fieldset>
  </form>;
}
