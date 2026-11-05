import { useState, type FormEvent } from 'react';
import { errorMessage } from '../auth/auth';
import { ridesApi, type Ride, type RoutePins } from './api';

export function routeDistance({ pickup, dropoff }: RoutePins) {
  const radians = Math.PI / 180;
  const latA = pickup.latitude * radians;
  const latB = dropoff.latitude * radians;
  const deltaLon = (dropoff.longitude - pickup.longitude) * radians;
  const a = Math.sin((latB - latA) / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function directionsUrl({ pickup, dropoff }: RoutePins) {
  const query = new URLSearchParams({
    api: '1', origin: `${pickup.latitude},${pickup.longitude}`,
    destination: `${dropoff.latitude},${dropoff.longitude}`, travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${query}`;
}

export function RoutePreview({ pins }: { pins: RoutePins }) {
  return <section className="panel">
    <h2>Route preview</h2>
    <p>Pickup ({pins.pickup.latitude}, {pins.pickup.longitude}) → Drop-off ({pins.dropoff.latitude}, {pins.dropoff.longitude})</p>
    <p>{routeDistance(pins).toLocaleString(undefined, { maximumFractionDigits: 1 })} km straight-line estimate</p>
    <a href={directionsUrl(pins)} target="_blank" rel="noreferrer">Open driving directions in Google Maps</a>
  </section>;
}

export function RouteEditor({ ride, onSaved }: { ride: Ride; onSaved: (ride: Ride) => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(pins: RoutePins | null) {
    setBusy(true);
    setError('');
    try {
      onSaved(await ridesApi.updateRoute(ride.id, ride.version, pins));
      setEditing(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const point = (key: string) => ({
      latitude: Number(values.get(`${key}Latitude`)), longitude: Number(values.get(`${key}Longitude`)),
    });
    if (!busy) void save({ pickup: point('pickup'), dropoff: point('dropoff') });
  }
  if (!editing) return <button className="button button-secondary" onClick={() => setEditing(true)}>Edit route pins</button>;
  return <form className="panel auth-form" onSubmit={submit}>
    <h2>Pickup and drop-off pins</h2>
    <p>Use coordinates for public meeting points. These pins are visible on the ride.</p>
    <fieldset className="ride-form" disabled={busy}>
      {(['pickup', 'dropoff'] as const).map(key => {
        const label = key === 'pickup' ? 'Pickup' : 'Drop-off';
        return <div key={key}>
          <label>{label} latitude<input name={`${key}Latitude`} type="number" min={-90} max={90} step="0.000001" required defaultValue={ride.route?.[key].latitude} /></label>
          <label>{label} longitude<input name={`${key}Longitude`} type="number" min={-180} max={180} step="0.000001" required defaultValue={ride.route?.[key].longitude} /></label>
        </div>;
      })}
      <button className="button">{busy ? 'Saving…' : 'Save route pins'}</button>
      {ride.route && <button type="button" className="button button-secondary" onClick={() => void save(null)}>Remove route pins</button>}
      <button type="button" className="button button-secondary" onClick={() => { setEditing(false); setError(''); }}>Cancel route edit</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
