import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ridesApi, type Ride } from './api';
import { errorMessage } from '../auth/auth';
export function CancelRideDialog({ ride, cancelled }: { ride: Ride; cancelled: (ride: Ride) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get('reason') || '').trim();
    setBusy(true); setError('');
    try { const result = await ridesApi.cancel(ride.id, ride.version, reason); setOpen(false); cancelled(result); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <><button className="button button-danger" onClick={() => { setError(''); setOpen(true); }}>Cancel ride</button>
    <dialog ref={dialog} aria-labelledby="cancel-ride-title" onCancel={event => { if (busy) event.preventDefault(); else setOpen(false); }}>
      <h2 id="cancel-ride-title">Cancel this ride?</h2><p>{ride.origin} → {ride.destination}</p>
      <p>The ride will leave search results. Its history and cancellation reason will remain visible on the ride.</p>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <label>Reason (optional)<textarea name="reason" maxLength={500} rows={3} disabled={busy} /></label>
        {error && <p role="alert">{error}</p>}
        <div className="ride-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={() => setOpen(false)}>Keep ride</button>
          <button className="button button-danger" type="submit" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div>
      </form>
    </dialog>
  </>;
}
