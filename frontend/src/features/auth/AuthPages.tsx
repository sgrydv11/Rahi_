import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage, login, register, validateCredentials, loginWithGoogle, travelPreferenceLabels, type TravelPreference } from './auth';
import { GoogleSignIn } from './GoogleSignIn';
import { demoMode } from '../rides/api';

function AuthForm({ registering = false }: { registering?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [preference, setPreference] = useState<TravelPreference>('PASSENGER');
  const navigate = useNavigate(); const location = useLocation();
  function finish() {
    const from: unknown = location.state?.from;
    navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/profile', { replace: true });
  }
  async function google(credential: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { await loginWithGoogle(credential, preference); finish(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const mobile = String(data.get('mobile') || '').replace(/[ ()-]/g, '');
    const invalid = validateCredentials(email, password, registering);
    if (invalid) { setError(invalid); return; }
    if (registering && !/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(mobile)) { setError('Enter a valid mobile number.'); return; }
    setBusy(true); setError('');
    try {
      if (registering) await register(email, password, 'FlexirRides member', preference, mobile);
      await login(email, password); finish();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow">
    <p className="eyebrow">Your journey starts here</p>
    <h1>{registering ? 'Join the journey.' : 'Welcome back.'}</h1>
    <div className="panel">
      {demoMode ? <p>Accounts are disabled in sample mode. <Link to="/rides">Browse rides</Link></p> : <>
        <GoogleSignIn registering={registering} busy={busy} onCredential={credential => void google(credential)} />
        <form key={String(registering)} className="auth-form" onSubmit={submit} aria-busy={busy}>
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} /></label>
          {registering && <>
            <label>Mobile number<input name="mobile" type="tel" autoComplete="tel" required maxLength={24} disabled={busy} /></label>
            <fieldset disabled={busy}><legend>I want to…</legend>{(Object.keys(travelPreferenceLabels) as TravelPreference[]).map(value => <label key={value}>
              <input type="radio" name="travelPreference" checked={preference === value} onChange={() => setPreference(value)} />{travelPreferenceLabels[value]}
            </label>)}</fieldset>
          </>}
          <label>Password<input name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : undefined} maxLength={72} disabled={busy} /></label>
          <button className="button button-small" type="button" aria-pressed={showPassword} disabled={busy}
            onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button>
          {registering && <p>Use at least 12 characters, up to 72 UTF-8 bytes.</p>}
          <button className="button" type="submit" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}</button>
        </form>
        {error && <p role="alert">{error}</p>}
      </>}
      <p><Link state={location.state} to={registering ? '/login' : '/register'}>{registering ? 'Already have an account? Log in' : 'New to FlexirRides? Join us'}</Link></p>
    </div>
  </section>;
}
export function LoginPage() { return <AuthForm />; }
export function RegisterPage() { return <AuthForm registering />; }
