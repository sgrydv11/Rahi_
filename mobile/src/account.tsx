import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { api, requestEmailOtp, verifyEmailOtp, type Preference, type User, type Vehicle } from './api';
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
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [wait, setWait] = useState(0);
  const [preference, setPreference] = useState<Preference>('PASSENGER');
  const action = useAction();
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254)
      throw new Error('Enter a valid email address.');
    const number = mobile.replace(/[ ()-]/g, '');
    if (create && !/^(?:[6-9][0-9]{9}|\+[1-9][0-9]{7,14})$/.test(number))
      throw new Error('Enter a valid mobile number with country code for numbers outside India.');
    const next = await requestEmailOtp(email.trim(), number || undefined, preference);
    setChallenge(next.challengeId); setCode(''); setWait(60);
  }
  return <Card>
    {!challenge ? <>
      <Field label="Email address" value={email} change={setEmail} />
      {create && <>
        <Field label="Mobile number" value={mobile} change={setMobile} />
        <Preferences value={preference} change={setPreference} />
        <Copy>We verify your email now. Mobile verification will follow when SMS is available.</Copy>
      </>}
      <Button label={action.busy ? 'Sending…' : 'Send email OTP'} disabled={action.busy}
        onPress={() => void action.run(send)} />
    </> : <>
      <Copy>Enter the code sent to your email. It expires in 5 minutes.</Copy>
      <Field label="Email code" value={code} numeric change={value => setCode(value.replace(/\D/g, '').slice(0, 6))} />
      <Button label={action.busy ? 'Verifying…' : 'Verify and continue'} disabled={action.busy} onPress={() => void action.run(async () => {
        if (!/^[0-9]{6}$/.test(code)) throw new Error('Enter the six-digit email code.');
        onUser(await verifyEmailOtp(challenge, code));
      })} />
      <Button label={wait ? 'Resend in ' + wait + 's' : 'Resend code'} disabled={action.busy || wait > 0} onPress={() => void action.run(send)} />
      <Button label="Change email" disabled={action.busy} onPress={() => { setChallenge(''); setCode(''); }} />
    </>}
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
    <Copy>{user.email}</Copy>
    <Field label="Full name" value={name} change={value => { setName(value); setSaved(false); }} />
    <Preferences value={preference} change={value => { setPreference(value); setSaved(false); }} />
    <ErrorText message={action.error} />
    {saved && <Copy>Profile saved.</Copy>}
    <Button label="Save profile" disabled={action.busy} onPress={() => void action.run(async () => {
      if (!/^\p{L}[\p{L}\p{M} .'-]{0,119}$/u.test(name.trim())) throw new Error('Enter a valid name using letters, spaces, apostrophes or hyphens.');
      onUser(await api<User>('/users/me', { method: 'PATCH', body: { fullName: name.trim(), travelPreference: preference } }));
      setSaved(true);
    })} />
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
