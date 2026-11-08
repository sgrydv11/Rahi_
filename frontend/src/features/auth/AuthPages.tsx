import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage, loginWithGoogle } from './auth';
import { GoogleSignIn } from './GoogleSignIn';
import { OtpSignIn } from './OtpSignIn';
import { demoMode } from '../rides/api';

function AuthForm({ registering = false }: { registering?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate(); const location = useLocation();
  function finish() {
    const from: unknown = location.state?.from;
    navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/profile', { replace: true });
  }
  async function google(credential: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { await loginWithGoogle(credential); finish(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow">
    <p className="eyebrow">Your journey starts here</p>
    <h1>{registering ? 'Join the journey.' : 'Welcome back.'}</h1>
    <div className="panel">
      {demoMode ? <p>Accounts are disabled in sample mode. <Link to="/rides">Browse rides</Link></p> : <>
        <GoogleSignIn registering={registering} busy={busy} onCredential={credential => void google(credential)} />
        <OtpSignIn registering={registering} onAuthenticated={finish} />
        {error && <p role="alert">{error}</p>}
      </>}
      <p><Link to={registering ? '/login' : '/register'}>{registering ? 'Already have an account? Log in' : 'New to FlexirRides? Join us'}</Link></p>
    </div>
  </section>;
}
export function LoginPage() { return <AuthForm />; }
export function RegisterPage() { return <AuthForm registering />; }
