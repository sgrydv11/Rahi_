import { Link, NavLink, Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../features/auth/AuthContext';
import { logout, errorMessage } from '../../features/auth/auth';
import { demoMode } from '../../features/rides/api';

export function AppLayout() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    let listener: Awaited<ReturnType<typeof App.addListener>> | undefined;
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) navigate(-1);
      else void App.exitApp().catch(failure => console.error('Unable to close Hoopr.', failure));
    }).then(handle => {
      if (active) listener = handle;
      else void handle.remove().catch(failure => console.error('Unable to remove back navigation.', failure));
    }).catch(failure => console.error('Unable to register Android back navigation.', failure));
    return () => {
      active = false;
      void listener?.remove().catch(failure => console.error('Unable to remove back navigation.', failure));
    };
  }, [navigate]);

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const moreIsActive = ['/profile', '/notifications', '/vehicles']
    .some(path => location.pathname === path || location.pathname.startsWith(`${path}/`));

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
          <NavLink to="/notifications">Notifications</NavLink>
          <NavLink to="/profile">My profile</NavLink>
          <button className="button button-small" disabled={busy} onClick={signOut}>{busy ? 'Logging out…' : 'Log out'}</button>
        </> : demoMode ? <span className="demo-nav-note">Sample app</span> : <><NavLink to="/login">Log in</NavLink>
          <NavLink className="button button-small" to="/register">Join Hoopr</NavLink></>}
      </nav>
    </header>
    {error && <p role="alert">{error}</p>}
    {demoMode && <p className="demo-banner" role="status">Sample app · Browse demo rides. Accounts and bookings are disabled.</p>}
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer><span className="footer-brand">hoopr</span><span>Good company. Shared journeys.</span><span>Shared journeys</span></footer>
    <nav className="mobile-nav" aria-label="App navigation">
      <MobileNavLink to="/rides" label="Find" icon="find" end />
      {loading ? <span className="mobile-nav-loading" role="status">Loading…</span> : user ? <>
        <MobileNavLink to="/rides/new" label="Offer" icon="offer" end />
        <MobileNavLink to="/rides/mine" label="My rides" icon="rides" end />
        <MobileNavLink to="/bookings/mine" label="Bookings" icon="bookings" />
        <button className={`mobile-nav-item${moreIsActive ? ' active' : ''}`} type="button"
          aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen(open => !open)}>
          <MobileIcon name="more" /><span className="mobile-nav-label">More</span>
        </button>
        {moreOpen && <div className="mobile-more-menu" id="mobile-more-menu" role="menu" aria-label="More">
          <NavLink role="menuitem" to="/profile" onClick={() => setMoreOpen(false)}>My profile</NavLink>
          <NavLink role="menuitem" to="/notifications" onClick={() => setMoreOpen(false)}>Notifications</NavLink>
          <NavLink role="menuitem" to="/vehicles" onClick={() => setMoreOpen(false)}>My vehicles</NavLink>
          <button role="menuitem" type="button" disabled={busy} onClick={() => { setMoreOpen(false); void signOut(); }}>
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </div>}
      </> : demoMode ? <span className="mobile-nav-loading">Sample mode</span> : <>
        <MobileNavLink to="/login" label="Log in" icon="rides" end />
        <MobileNavLink to="/register" label="Join" icon="offer" end />
      </>}
    </nav>
  </div>;
}

type MobileIconName = 'find' | 'offer' | 'rides' | 'bookings' | 'more';

function MobileIcon({ name }: { name: MobileIconName }) {
  const paths: Record<MobileIconName, string> = {
    find: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 5 5',
    offer: 'M12 5v14M5 12h14',
    rides: 'M5 17h14l1-5-2-5H6l-2 5 1 5Zm0 0v2m14-2v2M5 13h14M7 17h.01M17 17h.01',
    bookings: 'M6 3h12v18l-6-4-6 4V3Z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
  };
  return <svg className="mobile-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>;
}

function MobileNavLink({ to, label, icon, end = false }: {
  to: string; label: string; icon: MobileIconName; end?: boolean;
}) {
  return <NavLink className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
    to={to} end={end}>
    <MobileIcon name={icon} /><span className="mobile-nav-label">{label}</span>
  </NavLink>;
}
