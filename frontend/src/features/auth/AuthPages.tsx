import {Icon} from '../../app/Icon';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorMessage, login, requestRegistrationOtp, verifyEmailOtp, validateCredentials, loginWithGoogle, travelPreferenceLabels, type TravelPreference } from './auth';
import { GoogleSignIn } from './GoogleSignIn';
import { RegularRoutesEditor,type RegularRoute } from '../profile/RegularRoutes';
import { OtpSignIn } from './OtpSignIn';
import { demoMode } from '../rides/api';

function AuthForm({ registering = false }: { registering?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [regularRoutes,setRegularRoutes]=useState<RegularRoute[]>([]);
  const [emailCodeLogin,setEmailCodeLogin]=useState(false);
  const [challenge,setChallenge]=useState('');
  const [code,setCode]=useState('');
  const [signup,setSignup]=useState<{email:string;password:string;mobile:string;preference:TravelPreference;regularRoutes:RegularRoute[]}>();
  const [resendAt,setResendAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!challenge)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[challenge]);
  async function sendSignup(value:NonNullable<typeof signup>) {
    const next=await requestRegistrationOtp(value.email,value.password,value.mobile,value.preference,value.regularRoutes);
    setSignup(value);setChallenge(next.challengeId);setCode('');setResendAt(Date.now()+60000);setNow(Date.now());
  }
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
    if(challenge) {
      if(!/^\d{6}$/.test(code)){setError('Enter the six-digit code sent to your email.');return;}
      setBusy(true);setError('');
      try{await verifyEmailOtp(challenge,code);setSignup(undefined);finish();}
      catch(failure){setError(errorMessage(failure));}finally{setBusy(false);}
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const mobile = String(data.get('mobile') || '').replace(/[ ()-]/g, '');
    const invalid = validateCredentials(email, password, registering);
    if (invalid) { setError(invalid); return; }
    if (registering && !/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(mobile)) { setError('Enter a valid mobile number.'); return; }
    setBusy(true); setError('');
    try {
      if (registering) await sendSignup({email,password,mobile,preference,regularRoutes});
      else {await login(email, password); finish();}
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow">
    <p className="eyebrow">Your journey starts here</p>
    <h1>{registering ? 'Join the journey.' : 'Welcome back.'}</h1>
    {location.state?.message==='You have been logged out.' && <p role="status">You have been logged out.</p>}
    <div className="panel">
      {demoMode ? <p>Accounts are disabled in sample mode. <Link to="/rides">Browse rides</Link></p> : <>
        {!challenge && <GoogleSignIn registering={registering} busy={busy} onCredential={credential => void google(credential)} />}
        {!registering && <div className="ride-actions" aria-label="Sign-in method"><button type="button" aria-pressed={!emailCodeLogin} onClick={()=>{setEmailCodeLogin(false);setError('');}}>Password</button><button type="button" aria-pressed={emailCodeLogin} onClick={()=>{setEmailCodeLogin(true);setError('');}}>Email code</button></div>}
        {emailCodeLogin && !registering ? <OtpSignIn registering={false} onAuthenticated={finish}/> : <form key={String(registering)} className="auth-form" onSubmit={submit} aria-busy={busy}>
          {challenge ? <div className="signup-verification">
            <h2>Verify your email</h2><p>We sent a six-digit code to {signup?.email}. Your account is created only after verification.</p>
            <label>Email code<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} /></label>
            <p>The code expires in five minutes.</p>
            <button type="button" disabled={busy || now<resendAt} onClick={async()=>{if(!signup)return;setBusy(true);setError('');try{await sendSignup(signup);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>{now<resendAt?`Resend in ${Math.ceil((resendAt-now)/1000)}s`:'Resend code'}</button>
            <button type="button" disabled={busy} onClick={()=>{setChallenge('');setCode('');setSignup(undefined);setError('');}}>Change details</button>
          </div> : <>
          <label>{registering?'Email address':'Email or mobile number'}<input name="email" type={registering?'email':'text'} autoComplete={registering?'email':'username'} required maxLength={254} disabled={busy} /></label>
          {registering && <>
            <RegularRoutesEditor value={regularRoutes} change={setRegularRoutes} disabled={busy}/><label>Mobile number<input name="mobile" type="tel" autoComplete="tel" required maxLength={24} disabled={busy} /></label>
            <fieldset disabled={busy}><legend>I want to…</legend>{(Object.keys(travelPreferenceLabels) as TravelPreference[]).map(value => <label key={value}>
              <input type="radio" name="travelPreference" checked={preference === value} onChange={() => setPreference(value)} />{travelPreferenceLabels[value]}
            </label>)}</fieldset>
          </>}
          <label htmlFor="account-password">Password</label><div className="password-field"><input id="account-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 12 : undefined} maxLength={72} disabled={busy} />
          <button className="password-eye" type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} disabled={busy} onClick={()=>setShowPassword(v=>!v)}><Icon name={showPassword?'eye-off-outline':'eye-outline'}/></button></div>
          {registering && <p>Use at least 12 characters, up to 72 UTF-8 bytes.</p>}
          </>}
          <button className="button" type="submit" disabled={busy}>{busy ? 'Please wait…' : challenge?'Verify and create account':registering ? 'Create account' : 'Log in'}</button>
        </form>}
        {error && <p role="alert">{error}</p>}
      </>}
      <p><Link state={location.state} to={registering ? '/login' : '/register'}>{registering ? 'Already have an account? Log in' : 'New to FlexirRides? Join us'}</Link></p>
    </div>
  </section>;
}
export function LoginPage() { return <AuthForm />; }
export function RegisterPage() { return <AuthForm registering />; }
