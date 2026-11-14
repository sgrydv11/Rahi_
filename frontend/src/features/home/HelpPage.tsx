import { Link } from 'react-router';
export function HelpPage() {
  return <section className="page narrow"><h1>How can we help?</h1>
    <article className="panel"><h2>Find and book a seat</h2><p>Select both cities and your journey date in <Link to="/rides">Find a ride</Link>. Open a ride to review the fare, boarding and dropping points. Sign in, add passenger details and review the booking before confirming.</p>
    <h2>Offer a ride</h2><p><Link to="/rides/new">Offer a ride</Link> with your departure time, available seats, fare and stops. Manage your offers and passenger requests from <Link to="/rides/mine">Offers</Link>.</p>
    <h2>Access your account</h2><p><Link to="/login">Log in</Link> with your email or registered mobile number and password, or choose Email code. Codes expire after five minutes. Check your spam folder if a code is missing.</p>
    <h2>Chat and shared contact details</h2><p><Link to="/chat">Community chat</Link> is visible to signed-in members. Use Reply to quote a message. Registered mobile numbers are visible to signed-in members; tap a number for member details.</p>
    <h2>Booking updates</h2><p>Check <Link to="/bookings/mine">My Bookings</Link> and <Link to="/notifications">Notifications</Link> for requests, cancellations and journey updates.</p></article>
  </section>;
}
