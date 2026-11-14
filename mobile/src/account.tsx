import {RegularRoutesEditor,TravelPreferencesSettings,type RegularRoute} from './regularRoutes';
import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignIn } from './GoogleSignIn';
import { api, login, requestEmailOtp, requestRegistrationOtp, verifyEmailOtp, type Preference, type User, type Vehicle } from './api';
import type { Navigate } from './navigation';
import { Button, Card, Copy, ErrorText, Field, QueryState, styles, useAction, useQuery } from './ui';

const preferences: Record<Preference, string> = { BOTH: 'Drive and ride', DRIVER: 'Drive', PASSENGER: 'Ride' };
function Preferences({ value, change }: { value: Preference; change: (value: Preference) => void }) {
  return <><Copy>Travel preference</Copy><View style={styles.row}>
    {(Object.keys(preferences) as Preference[]).map(option => <Button key={option}
      label={preferences[option] + (value === option ? ' ✓' : '')} onPress={() => change(option)} />)}
  </View></>;
}
export function SignIn({ create, onUser, go }: { create: boolean; onUser: (user: User) => void; go: Navigate }) {
  const [regularRoutes,setRegularRoutes]=useState<RegularRoute[]>([]);
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailCodeLogin,setEmailCodeLogin]=useState(false);
  const [challenge,setChallenge]=useState('');
  const [code,setCode]=useState('');
  const [resendAt,setResendAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{if(!challenge)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[challenge]);
  const [preference, setPreference] = useState<Preference>('PASSENGER');
  const action = useAction();
  async function submit() {
    if(challenge){if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit email code.');onUser(await verifyEmailOtp(challenge,code));return;}
    const address = email.trim();
    const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && address.length<=254;
    const validPhone=/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(address.replace(/[ ()-]/g,''));
    if(!validEmail && (create || emailCodeLogin || !validPhone)) throw new Error(create || emailCodeLogin?'Enter a valid email address.':'Enter a valid email address or mobile number.');
    if(!create && emailCodeLogin){const next=await requestEmailOtp(address);setChallenge(next.challengeId);setCode('');setResendAt(Date.now()+60000);setNow(Date.now());return;}
    const number = mobile.replace(/[ ()-]/g, '');
    if (create && !/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(number))
      throw new Error('Enter a valid mobile number with country code for numbers outside India.');
    if (!password.trim() || (create && password.length < 12))
      throw new Error(create ? 'Use a password of at least 12 characters.' : 'Enter your password.');
    if(create){const next=await requestRegistrationOtp(address,password,number,preference,regularRoutes);setChallenge(next.challengeId);setCode('');setResendAt(Date.now()+60000);setNow(Date.now());}
    else onUser(await login(address,password));
  }
  return <Card>
    {!challenge && <GoogleSignIn preference={preference} busy={action.busy} run={action.run} onUser={onUser}/>}
    {challenge?<>
      <Copy>Verify your email</Copy><Copy>Enter the code sent to {email}. {create?'Your account is created only after verification.':'Verify the code to sign in.'} The code expires in five minutes.</Copy>
      <Field label="Email code" value={code} change={value=>setCode(value.replace(/\D/g,'').slice(0,6))} numeric />
      <Button label={now<resendAt?`Resend in ${Math.ceil((resendAt-now)/1000)}s`:'Resend code'} disabled={action.busy||now<resendAt} onPress={()=>void action.run(async()=>{const next=create?await requestRegistrationOtp(email.trim(),password,mobile,preference,regularRoutes):await requestEmailOtp(email.trim());setChallenge(next.challengeId);setCode('');setResendAt(Date.now()+60000);setNow(Date.now());})}/>
      <Button label="Change details" disabled={action.busy} onPress={()=>{setChallenge('');setCode('');}} />
    </>:<>
    {!create && <View style={styles.row}><Button label={'Password'+(!emailCodeLogin?' ✓':'')} disabled={action.busy} onPress={()=>setEmailCodeLogin(false)}/><Button label={'Email code'+(emailCodeLogin?' ✓':'')} disabled={action.busy} onPress={()=>setEmailCodeLogin(true)}/></View>}
    <Field label={create || emailCodeLogin?'Email address':'Email or mobile number'} value={email} change={setEmail} />
    {create && <>
      <Field label="Mobile number" value={mobile} change={setMobile} />
      <Preferences value={preference} change={setPreference} />
      <RegularRoutesEditor value={regularRoutes} change={setRegularRoutes} disabled={action.busy}/>
      <Copy>Use a password of at least 12 characters, up to 72 UTF-8 bytes.</Copy>
    </>}
    {(create || !emailCodeLogin) && <Field label="Password" value={password} change={setPassword} secret={!showPassword} trailing={<Pressable accessibilityRole="button" accessibilityLabel={showPassword?'Hide password':'Show password'} onPress={()=>setShowPassword(v=>!v)} disabled={action.busy} style={{padding:12}}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={22} color="#245EEA" /></Pressable>} />}
    </>}
    <Button label={action.busy ? 'Please wait…' : challenge?(create?'Verify and create account':'Verify and sign in'):create ? 'Create account' : emailCodeLogin?'Send email code':'Sign in'} disabled={action.busy}
      onPress={() => void action.run(submit)} />
    <ErrorText message={action.error} />
    <Button label={create ? 'Already have an account?' : 'Create an account'} disabled={action.busy}
      onPress={() => go({ kind: create ? 'login' : 'register' })} />
  </Card>;
}

export function Profile({ user, onUser, go }: { user: User; onUser: (user: User) => void; go: Navigate }) {
  const [name, setName] = useState(user.fullName);
  const [preference, setPreference] = useState(user.travelPreference);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  return <Card>
    <Button label={user.email} onPress={()=>void action.run(async()=>{await Linking.openURL(`mailto:${user.email}`);})}/>
    <Field label="Full name" value={name} change={value => { setName(value); setSaved(false); }} />
    <Preferences value={preference} change={value => { setPreference(value); setSaved(false); }} />
    <ErrorText message={action.error} />
    {saved && <Copy>Profile saved.</Copy>}
    <Button label="Save profile" disabled={action.busy} onPress={() => void action.run(async () => {
      if (!/^\p{L}[\p{L}\p{M} .'-]{0,119}$/u.test(name.trim())) throw new Error('Enter a valid name using letters, spaces, apostrophes or hyphens.');
      onUser(await api<User>('/users/me', { method: 'PATCH', body: { fullName: name.trim(), travelPreference: preference } }));
      setSaved(true);
    })} />
    <TravelPreferencesSettings/>
    <Button label="Manage vehicles" onPress={() => go({ kind: 'vehicles' })} />
  </Card>;
}

export function Vehicles({ go }: { go: Navigate }) {
  const result = useQuery('vehicles', () => api<Vehicle[]>('/vehicles'));
  return <>
    <Button label="Add vehicle" onPress={() => go({ kind: 'vehicleForm' })} />
    {!result.data ? <QueryState {...result} /> : <>
      {!result.data.length && <Copy>No saved vehicles.</Copy>}
      {result.data.map(vehicle => <Card key={vehicle.id}>
        <Copy>{vehicle.make} {vehicle.model} · {vehicle.passengerCapacity} seats</Copy>
        <Copy>{vehicle.registrationNumber} · {vehicle.active ? 'Active' : 'Archived'}</Copy>
        <Button label="Edit vehicle" onPress={() => go({ kind: 'vehicleForm', id: vehicle.id })} />
      </Card>)}
    </>}
  </>;
}

function VehicleFields({ vehicle, back }: { vehicle?: Vehicle; back: () => void }) {
  const [draft, setDraft] = useState({
    make: vehicle?.make ?? '', model: vehicle?.model ?? '', color: vehicle?.color ?? '',
    registrationNumber: vehicle?.registrationNumber ?? '', passengerCapacity: String(vehicle?.passengerCapacity ?? 1),
  });
  const [active, setActive] = useState(vehicle?.active ?? true);
  const action = useAction();
  const labels = { make: 'Make', model: 'Model', color: 'Colour', registrationNumber: 'Registration number', passengerCapacity: 'Passenger seats' };
  return <Card>
    {Object.entries(labels).map(([name, label]) => {
      const key = name as keyof typeof labels;
      return <Field key={key} label={label} numeric={key === 'passengerCapacity'} value={draft[key]}
        change={value => setDraft(previous => ({ ...previous, [key]: value }))} />;
    })}
    <Button label={active ? 'Available for new rides ✓' : 'Archived'} onPress={() => setActive(!active)} />
    <ErrorText message={action.error} />
    <Button label="Save vehicle" disabled={action.busy} onPress={() => void action.run(async () => {
      await api(vehicle ? `/vehicles/${encodeURIComponent(vehicle.id)}` : '/vehicles', {
        method: vehicle ? 'PATCH' : 'POST',
        body: { ...draft, passengerCapacity: Number(draft.passengerCapacity), active },
      });
      back();
    })} />
  </Card>;
}
export function VehicleForm({ id, back }: { id?: string; back: () => void }) {
  const result = useQuery(id ?? 'new', async () => ({
    vehicle: id ? (await api<Vehicle[]>('/vehicles')).find(vehicle => vehicle.id === id) : undefined,
  }));
  if (!result.data) return <QueryState {...result} />;
  if (id && !result.data.vehicle) return <Copy>Vehicle not found.</Copy>;
  return <VehicleFields vehicle={result.data.vehicle} back={back} />;
}
