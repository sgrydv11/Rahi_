import { Link } from 'react-router';
import { departureLabel, money, type Ride } from './api';
export function RideCard({ ride }: { ride: Ride }) {
  return <article className="panel ride-card">
    <div><p className="eyebrow">{ride.status}</p><h2><Link to={`/rides/${ride.id}`}>{ride.origin} → {ride.destination}</Link></h2>
      <p>{departureLabel(ride)}</p><p>Driver: {ride.driver.displayName}</p>
      <p>{ride.driverRating ? `${ride.driverRating.toFixed(1)} / 5` : 'No ratings yet'}{ride.preferences?.ac ? ' · AC' : ''}{ride.preferences?.womenOnly ? ' · Women only' : ''}{ride.preferences?.flexibleDropoff ? ' · Flexible drop-off' : ''}</p>
      {ride.reviews?.map((review, index) => <blockquote key={index}>{review.score}/5 {review.text}</blockquote>)}
    </div>
    <div><p><strong>{money(ride)}</strong> per seat</p><p>{ride.availableSeats} of {ride.totalSeats} seats available</p>
      <Link className="button button-small" to={`/rides/${ride.id}`}>View ride</Link></div>
  </article>;
}
export function Pagination({ page, totalPages, onChange, loading }: { page: number; totalPages: number; onChange: (page: number) => void; loading: boolean }) {
  if (totalPages < 2) return null;
  return <nav className="pagination" aria-label="Ride result pages">
    <button className="button button-small" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Previous</button>
    <span>Page {page + 1} of {totalPages}</span>
    <button className="button button-small" disabled={loading || page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}
