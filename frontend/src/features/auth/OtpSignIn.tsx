import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, requestEmailOtp, verifyEmailOtp, travelPreferenceLabels, type TravelPreference } from './auth';

export function OtpSignIn({ registering, onAuthenticated }: { registering: boolean; onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [preference, setPreference] = useState<TravelPreference>('PASSENGER');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) { setError('Enter a valid email address.'); return; }
    const number = mobile.replace(/[ ()-]/g, '');
    if ((registering || number) && !/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(number)) { setError('Enter a valid mobile number, including country code for numbers outside India.'); return; }
    setBusy(true); setError('');
    try {
      const next = await requestEmailOtp(email.trim(), number || undefined, preference);
      setChallenge(next.challengeId); setCode(''); setWait(60);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!challenge) { await send(); return; }
    if (!/^[0-9]{6}$/.test(code)) { setError('Enter the six-digit code from your email.'); return; }
    setBusy(true); setError('');
    try { await verifyEmailOtp(challenge, code); onAuthenticated(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
    {!challenge ? <>
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
      {registering && <>
        <label>Mobile number<input type="tel" autoComplete="tel" required maxLength={24} value={mobile} onChange={event => setMobile(event.target.value)} disabled={busy} /></label>
        <fieldset disabled={busy}><legend>I want to…</legend>{(Object.keys(travelPreferenceLabels) as TravelPreference[]).map(value => <label key={value}>
          <input type="radio" name="travelPreference" checked={preference === value} onChange={() => setPreference(value)} />{travelPreferenceLabels[value]}
        </label>)}</fieldset>
        <p>We verify your email now. Mobile verification will be added when SMS is available.</p>
      </>}
    </> : <>
      <p role="status">Enter the code sent to your email. It expires in 5 minutes.</p>
      <label>Email code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} disabled={busy} /></label>
      <button type="button" disabled={busy || wait > 0} onClick={() => void send()}>{wait ? `Resend in ${wait}s` : 'Resend code'}</button>
      <button type="button" disabled={busy} onClick={() => { setChallenge(''); setCode(''); setError(''); }}>Change email</button>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="button" disabled={busy} type="submit">{busy ? 'Please wait…' : challenge ? 'Verify and continue' : 'Send email OTP'}</button>
  </form>;
}
