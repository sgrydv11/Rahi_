import { useEffect, useState, type FormEvent } from 'react';
import { authenticatedRequest, errorMessage } from '../auth/auth';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  color: string | null;
  registrationNumber: string;
  passengerCapacity: number;
  active: boolean;
}
export const listVehicles = (signal?: AbortSignal) => authenticatedRequest<Vehicle[]>('/vehicles', { signal });

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>();
  const [editing, setEditing] = useState<Vehicle>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    listVehicles(controller.signal).then(value => { if (!controller.signal.aborted) setVehicles(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    const body = {
      make: text('make'), model: text('model'), color: text('color'),
      registrationNumber: text('registrationNumber'),
      passengerCapacity: Number(text('passengerCapacity')), active: data.has('active'),
    };
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const vehicle = await authenticatedRequest<Vehicle>(editing ? `/vehicles/${editing.id}` : '/vehicles', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body),
      });
      setVehicles(previous => editing ? previous?.map(entry => entry.id === vehicle.id ? vehicle : entry) :
        [...(previous ?? []), vehicle]);
      form.reset();
      setEditing(undefined);
      setMessage('Vehicle saved.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return <section className="page narrow">
    <h1>My vehicles</h1>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!vehicles && !error && <p role="status">Loading vehicles…</p>}
    {vehicles?.map(vehicle => <article className="panel" key={vehicle.id}>
      <h2>{vehicle.make} {vehicle.model}</h2>
      <p>{vehicle.registrationNumber} · {vehicle.passengerCapacity} passenger seats · {vehicle.active ? 'Active' : 'Archived'}</p>
      <button className="button button-secondary" disabled={busy} onClick={() => setEditing(vehicle)}>
        Edit {vehicle.make} {vehicle.model}
      </button>
    </article>)}
    {vehicles && <form key={editing?.id ?? 'new'} className="panel auth-form" onSubmit={save}>
      <h2>{editing ? 'Edit vehicle' : 'Add a vehicle'}</h2>
      <fieldset className="ride-form" disabled={busy}>
        <label>Make<input name="make" maxLength={80} required defaultValue={editing?.make} /></label>
        <label>Model<input name="model" maxLength={80} required defaultValue={editing?.model} /></label>
        <label>Colour<input name="color" maxLength={40} defaultValue={editing?.color ?? ''} /></label>
        <label>Registration number<input name="registrationNumber" maxLength={32} required defaultValue={editing?.registrationNumber} /></label>
        <label>Passenger seats<input name="passengerCapacity" type="number" min={1} max={6} required defaultValue={editing?.passengerCapacity ?? 1} /></label>
        <label><input name="active" type="checkbox" defaultChecked={editing?.active ?? true} /> Available for new rides</label>
        <button className="button">{busy ? 'Saving…' : 'Save vehicle'}</button>
        {editing && <button type="button" className="button button-secondary" onClick={() => setEditing(undefined)}>Cancel edit</button>}
      </fieldset>
      <p>Your registration number is private. Ride listings can show make, model and colour.</p>
    </form>}
  </section>;
}
