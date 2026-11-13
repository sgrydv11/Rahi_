import { Link } from 'react-router';
import { departureLabel, money, type Ride } from './api';
function departureClock(ride:Ride) {
  const value=new Date(ride.departureAt);
  if(!Number.isFinite(value.getTime()))return 'Time unavailable';
  try{return value.toLocaleTimeString('en-IN',{timeZone:ride.timeZone,hour:'numeric',minute:'2-digit',hour12:true});}
  catch{return value.toLocaleTimeString('en-IN',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true})+' UTC';}
}
export function RideCard({ ride, requestedSeats = 1 }: { ride: Ride; requestedSeats?: number }) {
  const detailsUrl = `/rides/${ride.id}${requestedSeats > 1 ? `?seats=${requestedSeats}` : ''}`;
  return <article className="panel ride-card">
    <div><div className="ride-card-top"><strong className="departure-clock">{departureClock(ride)}</strong><span className="ride-state">{ride.status.toLowerCase()}</span></div><h2><Link to={detailsUrl}>{ride.origin} → {ride.destination}</Link></h2>
      <p>{departureLabel(ride)}</p><p>Driver: {ride.driver.displayName}</p>
      <p>{ride.driverRating ? `${ride.driverRating.toFixed(1)} / 5` : 'No ratings yet'}{ride.preferences?.ac ? ' · AC' : ''}{ride.preferences?.womenOnly ? ' · Women only' : ''}{ride.preferences?.flexibleDropoff ? ' · Flexible drop-off' : ''}</p>
      {ride.reviews?.map((review, index) => <blockquote key={index}>{review.score}/5 {review.text}</blockquote>)}
    </div>
    <div className="ride-card-price"><p><strong aria-label={money(ride)}>{ride.currency==='INR'?'₹'+Number(ride.pricePerSeat).toLocaleString('en-IN'):money(ride)}</strong><small> per seat</small></p>{ride.preferences?.requiresApproval && <p>Driver approval required</p>}<p>{ride.availableSeats} of {ride.totalSeats} seats available</p>
      <Link className="button button-small" to={detailsUrl}>View ride</Link></div>
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
