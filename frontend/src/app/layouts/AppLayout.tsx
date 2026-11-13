import { Link, NavLink, Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../../features/auth/AuthContext';
import { logout, errorMessage } from '../../features/auth/auth';
import { demoMode } from '../../features/rides/api';

export function AppLayout() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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


  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="FlexirRides home">FlexirRides<span aria-hidden="true">↗</span></Link>
      <nav aria-label="Main navigation">
        <NavLink to="/rides" end>Find a ride</NavLink>
        {loading ? <span role="status">Loading…</span> : user ? <>
          <NavLink to="/rides/new">Offer a ride</NavLink>
          <NavLink to="/rides/mine">My rides</NavLink>
          <NavLink to="/bookings/mine">My bookings</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
          <NavLink to="/chat">Chat</NavLink>
          <button className="button button-small" disabled={busy} onClick={signOut}>{busy ? 'Logging out…' : 'Log out'}</button>
        </> : demoMode ? <span className="demo-nav-note">Sample app</span> : <><NavLink to="/login">Log in</NavLink>
          <NavLink className="button button-small" to="/register">Join FlexirRides</NavLink></>}
      </nav>
    </header>
    {error && <p role="alert">{error}</p>}
    {demoMode && <p className="demo-banner" role="status">Sample app · Browse demo rides. Accounts and bookings are disabled.</p>}
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer><span className="footer-brand">FlexirRides</span><span>Good company. Shared journeys.</span><span>Shared journeys</span></footer>
    <nav className="mobile-nav" aria-label="App navigation">
      <MobileNavLink to="/" label="Home" icon="home" end />
      <MobileNavLink to="/bookings/mine" label="My Bookings" icon="bookings" />
      <MobileNavLink to="/rides/mine" label="Offers" icon="offer" />
      <MobileNavLink to="/chat" label="Chat" icon="chat" />
      <MobileNavLink to="/profile" label="Account" icon="account" />
    </nav>
  </div>;
}

type MobileIconName = 'home' | 'account' | 'find' | 'offer' | 'rides' | 'bookings' | 'more' | 'chat';

function MobileIcon({ name }: { name: MobileIconName }) {
  const paths: Record<MobileIconName, string> = {
    chat: 'M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0ZM7 10h10M7 14h6',
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
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
