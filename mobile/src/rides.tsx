import { useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { api, type Booking, type Page, type Pins, type Ride, type User, type Vehicle } from './api';
import type { Navigate } from './navigation';
import { demoMode, demoRide, demoRides } from './demo';
import { Button, Card, Copy, date, ErrorText, Field, labelStatus, QueryState, styles, useAction, useQuery } from './ui';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const future = (ride: Ride) => ride.status === 'SCHEDULED' && Date.parse(ride.departureAt) > Date.now();
const ridePath = (id: string) => '/rides/' + encodeURIComponent(id);
const message = (label: string, value?: string) => value ? <Copy>{label}: {value}</Copy> : null;
const fields = {
  origin: 'Leaving from', destination: 'Going to', departureDate: 'Travel date (YYYY-MM-DD)',
  timeZone: 'Time zone', minimumSeats: 'Seats needed', maximumPrice: 'Maximum price per seat',
};

export function Pagination({ data, setPage }: { data: Page<unknown>; setPage: (page: number) => void }) {
  return <View style={styles.row}>
    {data.page > 0 && <Button label="Previous page" onPress={() => setPage(data.page - 1)} />}
    {data.page + 1 < data.totalPages && <Button label="Next page" onPress={() => setPage(data.page + 1)} />}
  </View>;
}

export function Rides({ mine = false, go }: { mine?: boolean; go: Navigate }) {
  const [draft, setDraft] = useState<Record<string, string>>({ timeZone: tz(), minimumSeats: '1' });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const path = mine ? `/rides/me?page=${page}&size=10` : `/rides?page=${page}&size=10&${query}`;
  const result = useQuery(path, async () => demoMode && !mine ? demoRides(query, page) : api<Page<Ride>>(path, { auth: mine }));
  return <>
    {mine ? <Button label="Offer a ride" onPress={() => go({ kind: 'rideForm' })} /> : <Card>
      {Object.entries(fields).map(([key, label]) => <Field key={key} label={label} value={draft[key] ?? ''}
        numeric={key === 'minimumSeats' || key === 'maximumPrice'}
        change={value => setDraft(previous => ({ ...previous, [key]: value }))} />)}
      <View style={styles.row}>
        <Button label="Search rides" onPress={() => {
          setPage(0);
          setQuery(Object.entries(draft).filter(([, value]) => value.trim()).map(([key, value]) =>
            `${key}=${encodeURIComponent(value.trim())}`).join('&'));
          result.reload();
        }} />
        <Button label="Clear filters" onPress={() => { setDraft({ timeZone: tz(), minimumSeats: '1' }); setQuery(''); setPage(0); }} />
      </View>
    </Card>}
    {!result.data ? <QueryState {...result} /> : <>
      {!result.data.content.length && <Copy>No rides found.</Copy>}
      {result.data.content.map(ride => <Card key={ride.id}>
        <Copy>{ride.origin} → {ride.destination}</Copy>
        <Copy>{date(ride.departureAt)} · {labelStatus(ride.status)}</Copy>
        <Copy>{ride.currency} {ride.pricePerSeat} per seat · {ride.availableSeats} available</Copy>
        <Button label="View ride" onPress={() => go({ kind: 'ride', id: ride.id })} />
      </Card>)}
      <Pagination data={result.data} setPage={setPage} />
    </>}
  </>;
}

export function Route({ pins }: { pins: Pins }) {
  const r = Math.PI / 180;
  const a = Math.sin((pins.dropoff.latitude - pins.pickup.latitude) * r / 2) ** 2 +
    Math.cos(pins.pickup.latitude * r) * Math.cos(pins.dropoff.latitude * r) *
    Math.sin((pins.dropoff.longitude - pins.pickup.longitude) * r / 2) ** 2;
  const distance = 12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  const origin = encodeURIComponent(`${pins.pickup.latitude},${pins.pickup.longitude}`);
  const destination = encodeURIComponent(`${pins.dropoff.latitude},${pins.dropoff.longitude}`);
  const action = useAction();
  return <Card><Copy>Route preview · {distance.toFixed(1)} km straight line</Copy>
    <Copy>Pickup: {pins.pickup.latitude}, {pins.pickup.longitude}</Copy>
    <Copy>Drop-off: {pins.dropoff.latitude}, {pins.dropoff.longitude}</Copy>
    <ErrorText message={action.error} />
    <Button label="Open driving directions" onPress={() => void action.run(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`))} />
  </Card>;
}

export function RideDetails({ id, user, go }: { id: string; user: User | null; go: Navigate }) {
  const path = ridePath(id);
  const result = useQuery(path, async () => demoMode ? demoRide(id) : api<Ride>(path, { auth: Boolean(user) }));
  const action = useAction();
  const [seats, setSeats] = useState(1);
  const [reason, setReason] = useState('');
  const bookingKey = useRef<{ id: string; seats: number; version: number; key: string } | null>(null);
  if (!result.data) return <QueryState {...result} />;
  const ride = result.data;
  const owner = user?.id === ride.driver.id;
  const edit = owner && future(ride) && ride.availableSeats === ride.totalSeats;
  function transition(kind: 'start' | 'complete' | 'cancel') {
    void action.run(async () => {
      await api(`${path}/${kind}`, { method: 'POST', body: {
        version: ride.version, ...(kind === 'cancel' && reason.trim() ? { reason: reason.trim() } : {}),
      } });
      result.reload();
    });
  }
  function book() {
    const prior = bookingKey.current;
    const key = prior && prior.id === id && prior.seats === seats && prior.version === ride.version ? prior.key : randomUUID();
    bookingKey.current = { id, seats, version: ride.version, key };
    void action.run(async () => {
      const booking = await api<Booking>(`${path}/bookings`, {
        method: 'POST', key, body: { seats, rideVersion: ride.version },
      });
      go({ kind: 'booking', id: booking.id });
    });
  }
  return <>
    <Card><Copy>{ride.origin} → {ride.destination}</Copy><Copy>{date(ride.departureAt)} · {labelStatus(ride.status)}</Copy>
      <Copy>Driver: {ride.driver.displayName}</Copy>
      <Copy>{ride.currency} {ride.pricePerSeat} per seat · {ride.availableSeats} of {ride.totalSeats} available</Copy>
      {message('Pickup', ride.pickupDescription)}{message('Drop-off', ride.dropoffDescription)}
      {message('Vehicle', ride.vehicleDetails)}{message('Notes', ride.notes)}{message('Cancellation', ride.cancellationReason)}
      {message('Started', ride.startedAt && date(ride.startedAt))}{message('Completed', ride.completedAt && date(ride.completedAt))}
    </Card>
    {ride.route && <Route pins={ride.route} />}
    <ErrorText message={action.error} />
    {owner && <Card>
      <Button label="Passenger bookings" onPress={() => go({ kind: 'manifest', id })} />
      {edit && <View style={styles.row}>
        <Button label="Edit ride" onPress={() => go({ kind: 'rideForm', id })} />
        <Button label="Edit route pins" onPress={() => go({ kind: 'pins', id })} />
      </View>}
      {ride.canStart && <Button label="Start ride" disabled={action.busy} onPress={() => transition('start')} />}
      {ride.status === 'IN_PROGRESS' && <Button label="Complete ride" disabled={action.busy} onPress={() => transition('complete')} />}
      {future(ride) && <>
        <Field label="Cancellation reason (optional)" value={reason} change={setReason} />
        <Button label="Cancel ride" disabled={action.busy} onPress={() => Alert.alert('Cancel this ride?', 'Confirmed passenger bookings will be cancelled.', [
          { text: 'Keep ride', style: 'cancel' }, { text: 'Cancel ride', style: 'destructive', onPress: () => transition('cancel') },
        ])} />
      </>}
    </Card>}
    {!demoMode && !owner && future(ride) && ride.availableSeats > 0 && <Card>
      {!user ? <Button label="Sign in to book" onPress={() => go({ kind: 'login' })} /> : <>
        <Copy>Seats: {seats} · {ride.currency} {(seats * ride.pricePerSeat).toFixed(2)}</Copy>
        <View style={styles.row}>
          <Button label="Fewer seats" disabled={seats <= 1 || action.busy} onPress={() => setSeats(seats - 1)} />
          <Button label="More seats" disabled={seats >= ride.availableSeats || action.busy} onPress={() => setSeats(seats + 1)} />
        </View>
        <Button label="Review and book" disabled={action.busy || seats > ride.availableSeats} onPress={() =>
          Alert.alert('Confirm booking', `Book ${seats} seat(s) for ${ride.currency} ${(seats * ride.pricePerSeat).toFixed(2)}?`, [
            { text: 'Back', style: 'cancel' }, { text: 'Book seats', onPress: book },
          ])} />
      </>}
    </Card>}
    <Button label="Refresh ride" onPress={result.reload} disabled={action.busy} />
  </>;
}

const rideFields = {
  origin: 'Leaving from', destination: 'Going to', departureAt: 'Local departure (YYYY-MM-DDTHH:mm)',
  totalSeats: 'Seats offered', pricePerSeat: 'Price per seat', currency: 'Currency',
  pickupDescription: 'Pickup description', dropoffDescription: 'Drop-off description',
  vehicleDetails: 'Public vehicle details', notes: 'Notes',
};
function localDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function RideFields({ ride, vehicles, go }: { ride?: Ride; vehicles: Vehicle[]; go: Navigate }) {
  const [draft, setDraft] = useState({
    origin: ride?.origin ?? '', destination: ride?.destination ?? '', departureAt: localDate(ride?.departureAt),
    totalSeats: String(ride?.totalSeats ?? 1), pricePerSeat: String(ride?.pricePerSeat ?? 0), currency: ride?.currency ?? 'INR',
    pickupDescription: ride?.pickupDescription ?? '', dropoffDescription: ride?.dropoffDescription ?? '',
    vehicleDetails: ride?.vehicleDetails ?? '', notes: ride?.notes ?? '',
  });
  const [vehicleId, setVehicle] = useState<string>();
  const action = useAction();
  function save() {
    void action.run(async () => {
      const departure = new Date(draft.departureAt);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(draft.departureAt) || !Number.isFinite(departure.getTime()) ||
          localDate(departure.toISOString()) !== draft.departureAt || departure.getTime() <= Date.now())
        throw new Error('Enter a valid future local departure.');
      if (!draft.pricePerSeat.trim() || !/^\d+(\.\d{1,2})?$/.test(draft.pricePerSeat))
        throw new Error('Enter a valid fare with up to two decimal places.');
      const saved = await api<Ride>(ride ? ridePath(ride.id) : '/rides', {
        method: ride ? 'PATCH' : 'POST', body: {
          ...draft, departureAt: departure.toISOString(), timeZone: tz(), currency: draft.currency.trim().toUpperCase(),
          totalSeats: Number(draft.totalSeats), pricePerSeat: Number(draft.pricePerSeat),
          ...(ride ? { version: ride.version } : vehicleId ? { vehicleId } : {}),
        },
      });
      go({ kind: 'ride', id: saved.id });
    });
  }
  return <Card>
    {Object.entries(rideFields).map(([name, label]) => {
      const key = name as keyof typeof rideFields;
      return <Field key={key} label={label} value={draft[key]} numeric={key === 'totalSeats' || key === 'pricePerSeat'}
        change={value => setDraft(previous => ({ ...previous, [key]: value }))} />;
    })}
    {!ride && vehicles.length > 0 && <>
      <Copy>Saved vehicle</Copy>
      <View style={styles.row}>
        <Button label={!vehicleId ? 'Manual details ✓' : 'Manual details'} onPress={() => setVehicle(undefined)} />
        {vehicles.map(vehicle => <Button key={vehicle.id} label={`${vehicle.make} ${vehicle.model} (${vehicle.passengerCapacity})${vehicleId === vehicle.id ? ' ✓' : ''}`}
          onPress={() => setVehicle(vehicle.id)} />)}
      </View>
    </>}
    <ErrorText message={action.error} />
    <Button label={ride ? 'Save changes' : 'Offer this ride'} disabled={action.busy} onPress={save} />
  </Card>;
}
export function RideForm({ id, go }: { id?: string; go: Navigate }) {
  const result = useQuery(id ?? 'new', async () => id ? { ride: await api<Ride>(ridePath(id)), vehicles: [] } :
    { ride: undefined, vehicles: (await api<Vehicle[]>('/vehicles')).filter(vehicle => vehicle.active) });
  return result.data ? <RideFields {...result.data} go={go} /> : <QueryState {...result} />;
}

function PinFields({ ride, back }: { ride: Ride; back: () => void }) {
  const [values, setValues] = useState([
    ride.route?.pickup.latitude, ride.route?.pickup.longitude, ride.route?.dropoff.latitude, ride.route?.dropoff.longitude,
  ].map(value => value?.toString() ?? ''));
  const action = useAction();
  function save(clear = false) {
    void action.run(async () => {
      if (!clear && values.some(value => !value.trim() || !Number.isFinite(Number(value))))
        throw new Error('Enter all four coordinates.');
      const [a, b, c, d] = values.map(Number);
      await api(`${ridePath(ride.id)}/route`, { method: 'PATCH', body: {
        version: ride.version, pickup: clear ? null : { latitude: a, longitude: b },
        dropoff: clear ? null : { latitude: c, longitude: d },
      } });
      back();
    });
  }
  return <Card><Copy>Use public meeting points. These coordinates are visible on the ride.</Copy>
    {['Pickup latitude', 'Pickup longitude', 'Drop-off latitude', 'Drop-off longitude'].map((label, index) =>
      <Field key={label} label={label} numeric value={values[index]}
        change={value => setValues(old => old.map((item, i) => i === index ? value : item))} />)}
    <ErrorText message={action.error} />
    <Button label="Save route pins" disabled={action.busy} onPress={() => save()} />
    {ride.route && <Button label="Remove route pins" disabled={action.busy} onPress={() => save(true)} />}
  </Card>;
}
export function PinsForm({ id, back }: { id: string; back: () => void }) {
  const result = useQuery(id, () => api<Ride>(ridePath(id)));
  return result.data ? <PinFields ride={result.data} back={back} /> : <QueryState {...result} />;
}
