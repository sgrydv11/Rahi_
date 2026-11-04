import { Link, NavLink, Outlet } from 'react-router';
import { useState } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { logout, errorMessage } from '../../features/auth/auth';

export function AppLayout() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Hoopr home">hoopr<span aria-hidden="true">↗</span></Link>
      <nav aria-label="Main navigation">
        <NavLink to="/rides" end>Find a ride</NavLink>
        {loading ? <span role="status">Loading…</span> : user ? <>
          <NavLink to="/rides/new">Offer a ride</NavLink>
          <NavLink to="/rides/mine">My rides</NavLink>
          <NavLink to="/bookings/mine">My bookings</NavLink>
          <NavLink to="/profile">My profile</NavLink>
          <button className="button button-small" disabled={busy} onClick={signOut}>{busy ? 'Logging out…' : 'Log out'}</button>
        </> : <><NavLink to="/login">Log in</NavLink>
          <NavLink className="button button-small" to="/register">Join Hoopr</NavLink></>}
      </nav>
    </header>
    {error && <p role="alert">{error}</p>}
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer><span className="footer-brand">hoopr</span><span>Good company. Shared journeys.</span><span>Shared journeys</span></footer>
  </div>;
}
