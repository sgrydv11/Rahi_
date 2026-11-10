import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { api, type Booking, type JourneyDetails, type Page, type Passenger, type Ride, type User } from './api';
import type { Navigate } from './navigation';
import { Button, Card, Choice, Copy, ErrorText, Field, styles, useAction } from './ui';

interface DraftPassenger { name: string; age: string; gender: string }
export function SeatBooking({ ride, requestedSeats = 1, user, go }: { ride: Ride; requestedSeats?: number; user: User | null; go: Navigate }) {
  const [stage, setStage] = useState<'start' | 'stops' | 'passengers' | 'review'>('start');
  const [boarding, setBoarding] = useState('');
  const [dropping, setDropping] = useState('');
  const [passengers, setPassengers] = useState<DraftPassenger[]>(() => Array.from({ length: Math.min(requestedSeats, ride.availableSeats) }, () => ({ name: '', age: '', gender: '' })));
  const [recent, setRecent] = useState<Passenger[]>([]);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const action = useAction();
  useEffect(() => {
    if (!user || stage !== 'passengers') return;
    const controller = new AbortController();
    api<Page<Booking>>('/bookings/me?size=50', { signal: controller.signal }).then(page => {
      if (controller.signal.aborted) return;
      const unique = new Map<string, Passenger>();
      page.content.flatMap(booking => booking.details?.passengers || []).forEach(person => unique.set(JSON.stringify(person), person));
      setRecent([...unique.values()]);
    }).catch(() => { /* Manual passenger entry remains available if history cannot load. */ });
    return () => controller.abort();
  }, [user?.id, stage]);
  function details(): JourneyDetails {
    if (!boarding || !dropping) throw new Error('Select boarding and dropping points.');
    if (passengers.some(person => !/^\p{L}[\p{L}\p{M} .'-]{0,119}$/u.test(person.name.trim()) || !person.age.trim()
        || !Number.isInteger(Number(person.age)) || Number(person.age) < 0 || Number(person.age) > 120
        || !['FEMALE', 'MALE', 'OTHER'].includes(person.gender))) throw new Error('Enter a valid name, age and gender for each passenger.');
    if (ride.preferences?.womenOnly && passengers.some(person => person.gender !== 'FEMALE')) throw new Error('This ride is for women passengers only.');
    return { boardingPoint: boarding, droppingPoint: dropping, passengers: passengers.map(person => ({
      name: person.name.trim(), age: Number(person.age), gender: person.gender as Passenger['gender'],
    })) };
  }
  if (stage === 'start') return <>
    {requestedSeats > ride.availableSeats && <Copy>Only {ride.availableSeats} seats remain. You can choose a smaller group.</Copy>}
    <Button label={ride.preferences?.requiresApproval ? 'Request seats' : 'Book Seat'} onPress={() => {
      if (!user) go({ kind: 'register' }); else setStage('stops');
    }} />
  </>;
  function edit(index: number, field: keyof DraftPassenger, value: string) {
    setPassengers(previous => previous.map((person, position) => position === index ? { ...person, [field]: value } : person));
  }
  return <Card>
    {stage === 'stops' && <>
      <Choice label="Boarding point" selected={boarding} values={(ride.preferences?.boardingPoints || [ride.origin]).map(point => ({ value: point, label: point }))} change={setBoarding} />
      <Choice label="Dropping point" selected={dropping} values={(ride.preferences?.droppingPoints || [ride.destination]).map(point => ({ value: point, label: point }))} change={setDropping} />
      {ride.preferences?.flexibleDropoff && <Copy>The driver accepts nearby drop-off requests by arrangement. Confirm any alternative with the driver.</Copy>}
      <Button label="Passenger details" onPress={() => void action.run(async () => {
        if (!boarding || !dropping) throw new Error('Select boarding and dropping points.'); setStage('passengers');
      })} />
    </>}
    {stage === 'passengers' && <>
      <Choice label="Seats" selected={String(passengers.length)} values={Array.from({ length: Math.min(6, ride.availableSeats) }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
        change={value => setPassengers(previous => Array.from({ length: Number(value) }, (_, index) => previous[index] || { name: '', age: '', gender: '' }))} />
      {passengers.map((person, index) => <View key={index} style={styles.field}>
        <Copy>Passenger {index + 1}</Copy>
        {recent.length > 0 && <Choice label="Select a recent passenger or add details below" selected="" values={recent.map((entry, position) => ({ value: String(position), label: entry.name }))} change={value => {
          const entry = recent[Number(value)]; setPassengers(previous => previous.map((item, position) => position === index ? { name: entry.name, age: String(entry.age), gender: entry.gender } : item));
        }} />}
        <Field label="Name" value={person.name} change={value => edit(index, 'name', value)} />
        <Field label="Age" value={person.age} numeric change={value => edit(index, 'age', value)} />
        <Choice label="Gender" selected={person.gender} values={ride.preferences?.womenOnly ? [{ value: 'FEMALE', label: 'Female' }] : [{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }, { value: 'OTHER', label: 'Other' }]}
          change={value => edit(index, 'gender', value)} />
      </View>)}
      <Button label="Review booking" onPress={() => void action.run(async () => { details(); setStage('review'); })} />
    </>}
    {stage === 'review' && <>
      <Copy>{boarding} → {dropping}</Copy>
      {passengers.map((person, index) => <Copy key={index}>{person.name} · {person.age} · {person.gender}</Copy>)}
      <Copy>Total: {ride.currency} {(passengers.length * ride.pricePerSeat).toFixed(2)}. No convenience fees or hidden charges.</Copy>
      <Button label={action.busy ? 'Booking…' : ride.preferences?.requiresApproval ? 'Send request' : 'Confirm booking'} disabled={action.busy} onPress={() => void action.run(async () => {
        const body = { seats: passengers.length, rideVersion: ride.version, details: details() };
        const signature = JSON.stringify(body);
        if (request.current?.signature !== signature) request.current = { signature, key: randomUUID() };
        const booking = await api<Booking>('/rides/' + encodeURIComponent(ride.id) + '/bookings', { method: 'POST', key: request.current.key, body });
        go({ kind: 'booking', id: booking.id });
      })} />
    </>}
    <ErrorText message={action.error} />
    {stage !== 'stops' && <Button label="Back" disabled={action.busy} onPress={() => setStage(stage === 'review' ? 'passengers' : 'stops')} />}
    <Button label="My Bookings" onPress={() => go({ kind: 'bookings' })} />
  </Card>;
}
