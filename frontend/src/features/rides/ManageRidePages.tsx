import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../auth/auth';
import { canManage, ridesApi, type Ride } from './api';
import { RideForm } from './RideForm';
export function OfferRidePage() {
  const navigate = useNavigate();
  return <section className="page"><p className="eyebrow">Make room for good company</p><h1>Offer a ride.</h1>
    <RideForm save={async body => { const ride = await ridesApi.create(body); navigate(`/rides/${ride.id}`, { replace: true, state: { message: 'Your ride is now available in search.' } }); }} />
  </section>;
}
export function EditRidePage() {
  const { id = '' } = useParams(); const { user } = useAuth(); const navigate = useNavigate();
  const [ride, setRide] = useState<Ride | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setRide(null); setError('');
    ridesApi.details(id, true, controller.signal).then(value => { if (!controller.signal.aborted) setRide(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [id]);
  const unavailable = ride && (ride.driver.id !== user?.id || !canManage(ride) || ride.availableSeats !== ride.totalSeats);
  return <section className="page"><h1>Edit ride.</h1><Link to={`/rides/${id}`}>← Back to ride</Link>
    {error ? <p role="alert">{error}</p> : unavailable ? <p role="alert">Only an owner’s future scheduled ride without reserved seats can be edited.</p>
      : ride ? <RideForm key={ride.id} ride={ride} save={async body => {
        const result = await ridesApi.update(id, body, ride.version);
        navigate(`/rides/${result.id}`, { replace: true, state: { message: 'Your ride has been updated.' } });
      }} /> : <p role="status">Loading ride…</p>}
  </section>;
}
