import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { canManage, departureLabel, money, ridesApi, type Ride } from './api';
import { CancelRideDialog } from './CancelRideDialog';
export function RideDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const [ride, setRide] = useState<Ride | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(typeof location.state?.message === 'string' ? location.state.message : '');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    ridesApi.details(id, Boolean(user), controller.signal).then(value => { if (!controller.signal.aborted) setRide(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, user?.id, revision]);
  return <section className="page"><Link to="/rides">← Find rides</Link>
    {loading ? <p role="status">Loading ride…</p> : error ? <p role="alert">{error}</p> : ride && <>
      <p className="eyebrow">{ride.status}</p><h1>{ride.origin} → {ride.destination}</h1>
      {message && <p role="status">{message}</p>}
      <div className="panel ride-details"><dl>
        <dt>Departure</dt><dd>{departureLabel(ride)}</dd>
        <dt>Driver</dt><dd>{ride.driver.displayName}</dd>
        <dt>Available seats</dt><dd>{ride.availableSeats} of {ride.totalSeats}</dd>
        <dt>Price per seat</dt><dd>{money(ride)}</dd>
        {ride.pickupDescription && <><dt>Pickup</dt><dd>{ride.pickupDescription}</dd></>}
        {ride.dropoffDescription && <><dt>Drop-off</dt><dd>{ride.dropoffDescription}</dd></>}
        {ride.vehicleDetails && <><dt>Vehicle</dt><dd>{ride.vehicleDetails}</dd></>}
        {ride.notes && <><dt>Notes</dt><dd className="preserve-lines">{ride.notes}</dd></>}
        {ride.cancelledAt && <><dt>Cancelled</dt><dd>{new Date(ride.cancelledAt).toLocaleString()}</dd></>}
        {ride.cancellationReason && <><dt>Cancellation reason</dt><dd>{ride.cancellationReason}</dd></>}
      </dl><p className="notice">Seat booking is not available yet.</p></div>
      {user?.id === ride.driver.id && <div className="ride-actions">
        <Link to="/rides/mine">My rides</Link>
        {canManage(ride) && ride.availableSeats === ride.totalSeats && <>
          <Link className="button" to={`/rides/${ride.id}/edit`}>Edit ride</Link>
          <CancelRideDialog ride={ride} cancelled={result => { setRide(result); setMessage('Your ride has been cancelled.'); }} />
        </>}
        <button className="button button-secondary" onClick={() => setRevision(value => value + 1)}>Reload ride</button>
      </div>}
    </>}
  </section>;
}
