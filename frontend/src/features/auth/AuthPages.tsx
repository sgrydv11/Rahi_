import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage, login, loginWithGoogle, register, validateCredentials, travelPreferenceLabels, type TravelPreference } from './auth';
import { GoogleSignIn } from './GoogleSignIn';
import { demoMode } from '../rides/api';

function AuthForm({ registering = false }: { registering?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [travelPreference, setTravelPreference] = useState<TravelPreference>('PASSENGER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  async function googleSignIn(credential: string) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await loginWithGoogle(credential, travelPreference);
      const from: unknown = location.state?.from;
      navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/profile', { replace: true });
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  if (demoMode) {
    return <section className="page narrow">
      <p className="eyebrow">Sample app</p>
      <h1>Preview Hoopr.</h1>
      <div className="panel">
        <p>Sign-in and account creation need the live backend and are disabled in this demo.</p>
        <Link className="button" to="/rides">Browse sample rides</Link>
      </div>
    </section>;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const invalid = validateCredentials(email, password, registering);
    if (invalid) { setError(invalid); return; }
    if (registering && (!name.trim() || name.trim().length > 120)) { setError('Enter your name (up to 120 characters).'); return; }
    setBusy(true);
    try {
      if (registering) { await register(email.trim(), password, name.trim(), travelPreference); setSuccess(true); setPassword(''); }
      else {
        await login(email.trim(), password);
        const from: unknown = location.state?.from;
        navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/profile', { replace: true });
      }
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow">
    <p className="eyebrow">Your journey starts here</p>
    <h1>{registering ? 'Join the journey.' : 'Welcome back.'}</h1>
    <p className="intro">{registering ? 'One profile for driving and riding.' : 'Your next shared journey is just around the corner.'}</p>
    <div className="panel">
      {!success && <GoogleSignIn registering={registering} busy={busy} onCredential={credential => void googleSignIn(credential)} />}
      {success ? <div role="status"><h2>Your account is ready.</h2><p>You can now <Link to="/login">log in</Link>.</p></div>
        : <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
          {registering && <label>Full name<input name="fullName" autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></label>}
          {registering && <fieldset className="travel-preferences" disabled={busy}>
            <legend>I want to…</legend>
            {(Object.keys(travelPreferenceLabels) as TravelPreference[]).map(preference =>
              <label key={preference} className="travel-preference-option">
                <input type="radio" name="travelPreference" value={preference} checked={travelPreference === preference}
                  onChange={() => setTravelPreference(preference)} required />
                <span>{travelPreferenceLabels[preference]}</span>
              </label>)}
          </fieldset>}
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label>
          <label>Password<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-describedby={registering ? 'password-help' : undefined} /></label>
          {registering && <p id="password-help" className="notice">Use at least 12 characters, up to 72 UTF-8 bytes.</p>}
          {error && <p role="alert">{error}</p>}
          <button className="button" disabled={busy} type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}</button>
        </form>}
      <p><Link to={registering ? '/login' : '/register'}>{registering ? 'Already have an account? Log in' : 'New to Hoopr? Join us'} <span aria-hidden="true">↗</span></Link></p>
    </div>
  </section>;
}
export function LoginPage() { return <AuthForm />; }
export function RegisterPage() { return <AuthForm registering />; }
