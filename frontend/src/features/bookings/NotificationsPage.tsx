import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { authenticatedRequest, errorMessage } from '../auth/auth';

const titles: Record<string, string> = {
  TRAVEL_RIDE:'Ride on your regular route',
  TRAVEL_BUDDY:'Travel buddy on your regular route',
  BOOKING_CONFIRMED: 'Booking confirmed',
  BOOKING_REQUESTED: 'Booking requested',
  BOOKING_DECLINED: 'Booking declined',
  BOOKING_EXPIRED: 'Booking request expired',
  CANCELLED_BY_PASSENGER: 'Booking cancelled by passenger',
  CANCELLED_BY_DRIVER: 'Booking cancelled by driver',
  DEPARTURE_REMINDER: 'Upcoming departure',
};
interface Notice { id: string; kind: string; origin: string; destination: string; time: string; link: string }

export function NotificationsPage() {
  const [notices, setNotices] = useState<Notice[]>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    authenticatedRequest<Notice[]>('/notifications', { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setNotices(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [revision]);
  return <section className="page">
    <h1>Notifications</h1>
    <button className="button button-secondary" onClick={() => {
      setNotices(undefined);
      setError('');
      setRevision(value => value + 1);
    }}>Refresh notifications</button>
    {error ? <p role="alert">{error}</p> : !notices ? <p role="status">Loading notifications…</p> :
      notices.length === 0 ? <p>No notifications yet.</p> :
      <div className="ride-results">{notices.map(notice => <article key={notice.id} className="panel">
        <h2>{titles[notice.kind] ?? 'Ride update'}</h2>
        <p>{notice.origin} → {notice.destination}</p>
        <p><time dateTime={notice.time}>{new Date(notice.time).toLocaleString()}</time></p>
        <Link to={notice.link}>View details</Link>
      </article>)}</div>}
  </section>;
}
