import {Icon} from '../Icon';
import { CommunityContext,useCommunityState } from '../../features/chat/Community';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { pageMetadata } from '../pageMetadata';
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
  const location=useLocation();
  const community=useCommunityState(user?.id,location.pathname==='/chat'?Number(new URLSearchParams(location.search).get('group')||1):undefined);
  const [menuOpen,setMenuOpen]=useState(false);
  const menuButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    setMenuOpen(false);
    const metadata=pageMetadata(location.pathname);
    document.title=metadata.title;
    for(const [name,content] of [['description',metadata.description],['robots',metadata.robots]]) {
      let tag=document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if(!tag){tag=document.createElement('meta');tag.name=name;document.head.append(tag);}
      tag.content=content;
    }
  },[location.pathname]);
  useEffect(()=>{
    if(!menuOpen)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenuOpen(false);menuButton.current?.focus();}};
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
  },[menuOpen]);

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
    try { await logout(); setMenuOpen(false); navigate('/login',{state:{message:'You have been logged out.'}}); } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }


  return <CommunityContext.Provider value={community}><div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <Link className="brand" to="/" aria-label="FlexirRides home">FlexirRides<Icon name="arrow-forward-outline"/></Link>
      <button ref={menuButton} type="button" className="menu-toggle" aria-label={menuOpen?'Close menu':'Open menu'} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={()=>setMenuOpen(value=>!value)}><Icon name={menuOpen?'close-outline':'menu-outline'}/></button>
      <nav id="primary-navigation" className={`primary-navigation${menuOpen?' is-open':''}`} aria-label="Main navigation">
        <NavLink to="/rides" end>Find a ride</NavLink>
        {loading ? <span role="status">Loading…</span> : user ? <>
          <NavLink to="/rides/new">Offer a ride</NavLink>
          <NavLink to="/bookings/mine">My bookings</NavLink>
          <NavLink to="/chat">Chat {community.unread>0&&<span className="unread-badge">{community.unread>99?'99+':community.unread}</span>}</NavLink>
          <NavLink to="/profile">Account</NavLink>
          <button className="button button-small" disabled={busy} onClick={signOut}>{busy ? 'Logging out…' : 'Log out'}</button>
        </> : demoMode ? <span className="demo-nav-note">Sample app</span> : <><NavLink to="/login">Log in</NavLink>
          <NavLink className="button button-small" to="/register">Join FlexirRides</NavLink></>}
        {!user&&<NavLink to="/help">Help</NavLink>}
      </nav>
    </header>
    {community.toast && <div className="community-toast" role="status"><button type="button" onClick={()=>{navigate(community.toast!.link);community.dismiss();}}><strong>{community.toast.title}</strong><span>{community.toast.body}</span></button><button type="button" aria-label="Dismiss notification" onClick={community.dismiss}><Icon name="close-outline"/></button></div>}
    {error && <p role="alert">{error}</p>}
    {demoMode && <p className="demo-banner" role="status">Sample app · Browse demo rides. Accounts and bookings are disabled.</p>}
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><Link className="footer-brand" to="/">FlexirRides</Link><nav aria-label="Footer navigation"><Link to="/">Home</Link><Link to="/rides">Find a ride</Link><Link to="/help">Help</Link></nav><small>© {new Date().getFullYear()} FlexirRides</small></footer>
    <nav className="mobile-nav" aria-label="App navigation">
      <MobileNavLink to="/" label="Home" icon="home" end />
      <MobileNavLink to="/bookings/mine" label="My Bookings" icon="bookings" />
      <MobileNavLink to="/rides/mine" label="Offers" icon="offer" />
      <MobileNavLink to="/chat" label="Chat" icon="chat" badge={community.unread} />
      <MobileNavLink to="/profile" label="Account" icon="account" />
    </nav>
  </div></CommunityContext.Provider>;
}

type MobileIconName = 'home' | 'account' | 'find' | 'offer' | 'rides' | 'bookings' | 'more' | 'chat';

function MobileIcon({name}:{name:MobileIconName}) {
 const names={home:'home-outline',account:'person-outline',find:'search-outline',offer:'add-outline',rides:'car-outline',bookings:'ticket-outline',more:'menu-outline',chat:'chatbubbles-outline'} as const;
 return <Icon name={names[name]} className="mobile-nav-icon"/>;
}

function MobileNavLink({ to, label, icon, end = false,badge=0 }: {
  to: string; label: string; icon: MobileIconName; end?: boolean;badge?:number;
}) {
  return <NavLink className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
    to={to} end={end}>
    <MobileIcon name={icon} />{badge>0&&<span className="unread-badge" aria-label={`${badge} unread messages`}>{badge>99?'99+':badge}</span>}<span className="mobile-nav-label">{label}</span>
  </NavLink>;
}
