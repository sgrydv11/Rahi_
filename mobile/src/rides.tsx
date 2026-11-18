import {namedRides} from './namedRides';
import {Ionicons} from '@expo/vector-icons';
import * as Location from 'expo-location';
import {nearbyCity} from './nearbyCity';
import {Text} from './Typography';
import {useCityPoints} from './locations';
import {Dropdown} from './dropdown';
import { useEffect,useState } from 'react';
import { Alert, Linking, Pressable, Switch, View,StyleSheet } from 'react-native';
import { api, type Page, type Pins, type Ride, type RidePreferences, type User, type Vehicle } from './api';
import type { Navigate } from './navigation';
import { demoMode, demoRide, demoRides } from './demo';
import { DateField } from './dateField';
import { SeatBooking } from './seatBooking';
import { Button, Card, Choice, Copy, date, ErrorText, Field, labelStatus, QueryState, styles, useAction, useQuery } from './ui';

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const future = (ride: Ride) => ride.status === 'SCHEDULED' && Date.parse(ride.departureAt) > Date.now();
const ridePath = (id: string) => '/rides/' + encodeURIComponent(id);
function departureClock(ride:Ride) {
  try{return new Date(ride.departureAt).toLocaleTimeString('en-IN',{timeZone:ride.timeZone,hour:'numeric',minute:'2-digit',hour12:true});}
  catch{return new Date(ride.departureAt).toLocaleTimeString('en-IN',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true})+' UTC';}
}
const message = (label: string, value?: string) => value ? <Copy>{label}: {value}</Copy> : null;
function day(offset = 0) {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return localDate(date.toISOString()).slice(0, 10);
}
const sortOptions = [
  { value: 'TIME_ASC', label: 'Time ↑' }, { value: 'TIME_DESC', label: 'Time ↓' },
  { value: 'PRICE_ASC', label: 'Price ↑' }, { value: 'PRICE_DESC', label: 'Price ↓' },
  { value: 'RATING_ASC', label: 'Rating ↑' }, { value: 'RATING_DESC', label: 'Rating ↓' },
];
const seatOptions = [1, 2, 3, 4, 5, 6].map(value => ({ value: String(value), label: String(value) }));
const yesNo = [{ value: '', label: 'Any' }, { value: 'true', label: 'Yes' }];

export function Pagination({ data, setPage }: { data: Page<unknown>; setPage: (page: number) => void }) {
  return <View style={styles.row}>
    {data.page > 0 && <Button label="Previous page" onPress={() => setPage(data.page - 1)} />}
    {data.page + 1 < data.totalPages && <Button label="Next page" onPress={() => setPage(data.page + 1)} />}
  </View>;
}

export function Rides({ mine = false, go,user,onResultsChange }: { mine?: boolean; go: Navigate;user?:User|null;onResultsChange?:(value:boolean)=>void }) {
  const canOffer=!!user&&user.travelPreference!=='PASSENGER',canBook=!user||user.travelPreference!=='DRIVER';
  const points=useCityPoints();
  const [savedRoutes,setSavedRoutes]=useState<{origin:string;destination:string;period:string}[]>([]);
  useEffect(()=>{if(!user)return;const c=new AbortController();api<{origin:string;destination:string;period:string}[]>('/travel-preferences',{signal:c.signal}).then(setSavedRoutes).catch(()=>{});return()=>c.abort();},[user?.id]);
  const rideChoices=[...namedRides,...savedRoutes.map((r,i)=>({value:'saved-'+i,label:`${r.period==='MORNING'?'Office':r.period==='EVENING'?'Home':'Saved'} · ${r.origin} → ${r.destination}`,origin:r.origin,destination:r.destination,routeType:''}))];
  const [draft, setDraft] = useState<Record<string, string>>({ departureDate: day(), timeZone: tz(), sort: 'TIME_ASC', minimumSeats: '1' });
  const [query, setQuery] = useState('');
  const [sortOpen,setSortOpen]=useState(false),[locating,setLocating]=useState(false),[locationMessage,setLocationMessage]=useState('');
  useEffect(()=>{onResultsChange?.(!!query);},[query]);
  const requestedSeats = Number(new URLSearchParams(query).get('minimumSeats') || 1);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(false);
  const [error, setError] = useState('');
  const path = mine ? '/rides/me?page=' + page + '&size=10' : '/rides?page=' + page + '&size=10&' + query;
  const result = useQuery(path, async signal => {
    if (!mine && !query) return { content: [], page: 0, totalPages: 0 } as Page<Ride>;
    return demoMode && !mine ? demoRides(query, page) : api<Page<Ride>>(path, { auth: mine, signal });
  });
  async function locateCity(){
    if(locating)return;setLocating(true);setLocationMessage('');
    try{const permission=await Location.requestForegroundPermissionsAsync();if(permission.status!=='granted'){setLocationMessage('Location not allowed. Enter your city manually.');return;}
      const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});const city=nearbyCity(position.coords.latitude,position.coords.longitude);
      if(city){update('origin',city);setLocationMessage(`Nearby city: ${city}. You can edit it.`);}else setLocationMessage('No supported city nearby. Enter your city manually.');
    }catch{setLocationMessage('Unable to get location. Enter your city manually.');}finally{setLocating(false);}
  }
  function apply(values = draft) {
    if (!values.origin?.trim() || !values.destination?.trim()) { setError('Select both From City and To City.'); return; }
    if (values.origin.trim().toLowerCase() === values.destination.trim().toLowerCase()) { setError('Choose different cities.'); return; }
    if (values.returnDate && values.returnDate < values.departureDate) { setError('Choose a return date on or after departure.'); return; }
    if (values.departureTime && (values.timeFrom || values.timeTo)) { setError('Choose a direct time or a range, not both.'); return; }
    setError(''); setPage(0);
    setQuery(Object.entries(values).filter(([key, value]) => key !== 'returnDate' && key !== 'ac' && key !== 'namedRide' && value.trim()).map(([key, value]) => key + '=' + encodeURIComponent(value.trim())).join('&'));
  }
  function update(key: string, value: string) { setDraft(previous => ({ ...previous, [key]: value,...(key==='origin'||key==='destination'?{namedRide:''}:{}) })); }
  const travelDate = draft.departureDate ? new Date(draft.departureDate + 'T12:00') : undefined;
  function timeField(key: string, label: string) {
    return <DateField label={label} mode="time" value={draft[key] && draft[key] !== '24:00' ? new Date(draft.departureDate + 'T' + draft[key]) : undefined}
      change={value => update(key, String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0'))}
      clear={() => update(key, '')} />;
  }
  if (!mine && !query) return <View style={rideUI.form}>
    <Field label="From City" value={draft.origin || ''} change={value => update('origin', value)} />
    <Pressable accessibilityRole="button" disabled={locating} onPress={()=>void locateCity()} style={rideUI.location}><Ionicons name="locate-outline" size={18} color="#245EEA"/><Text style={rideUI.link}>{locating?'Locating…':'Use current city'}</Text></Pressable>
    {!!locationMessage&&<Text accessibilityRole="alert" style={rideUI.secondary}>{locationMessage}</Text>}
    <Field label="To City" value={draft.destination || ''} change={value => update('destination', value)} />
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap: 8}}>
      <DateField label="Date of Journey" mode="date" minimumDate={new Date(day()+'T00:00')} value={travelDate} change={value => update('departureDate', localDate(value.toISOString()).slice(0, 10))} />
      <View style={{flexDirection:'row',gap: 4}}>{[{label:'Today',offset:0},{label:'Tomorrow',offset:1}].map(item=><Pressable key={item.label} accessibilityRole="button" onPress={()=>update('departureDate',day(item.offset))} style={{borderRadius:20,padding:8,backgroundColor:draft.departureDate===day(item.offset)?'#245EEA':'#EDF3FF'}}><Text style={{fontSize:11,color:draft.departureDate===day(item.offset)?'#fff':'#142D4E'}}>{item.label}</Text></Pressable>)}</View>
    </View>
    <DateField label="Return date (optional)" mode="date" value={draft.returnDate ? new Date(draft.returnDate + 'T12:00') : undefined}
      change={value => update('returnDate', localDate(value.toISOString()).slice(0, 10))} clear={() => update('returnDate', '')} />
    <Choice label="Ride" values={[{value:'',label:'Choose a named route'},...rideChoices]} selected={draft.namedRide||''} change={v=>{const r=rideChoices.find(r=>r.value===v);if(r)setDraft(p=>({...p,origin:r.origin,destination:r.destination,routeType:r.routeType,namedRide:v}));}}/>
    <Choice label="Seats" values={seatOptions} selected={draft.minimumSeats} change={value => update('minimumSeats', value)} />
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12,borderWidth:1,borderColor:'#D5DEEA',borderRadius:12}}><View><Copy>Booking for women</Copy><Text style={{color:'#4C5E75',fontSize:12}}>Show women-only rides</Text></View><Switch accessibilityLabel="Women-only rides" value={draft.womenOnly==='true'} onValueChange={value=>update('womenOnly',value?'true':'')} trackColor={{true:'#245EEA'}}/></View>
    <ErrorText message={error} />
    <Button label="Search rides" onPress={() => apply()} />
  </View>;
  return <>
    {mine ? <View style={styles.row}>
      {canBook&&<Button label="Find a ride" onPress={() => go({ kind: 'search' })} />}
      <Button label="My bookings" onPress={() => go({ kind: 'bookings' })} />
      {canOffer&&<Button label="Offer a ride" onPress={() => go({ kind: 'rideForm' })} />}
    </View> : <>
      <View style={rideUI.summary}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={rideUI.route}>{draft.origin} → {draft.destination}</Text><View style={rideUI.meta}><Text numberOfLines={1} style={[rideUI.secondary,{fontSize:11}]}>{new Date(draft.departureDate+'T12:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {requestedSeats} {requestedSeats===1?'seat':'seats'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Edit search" onPress={()=>{setQuery('');setError('');setFilters(false);setSortOpen(false);}} style={rideUI.edit}><Ionicons name="create-outline" size={20} color="#245EEA"/></Pressable></View></View>
      {draft.returnDate && <Button label={`Find return rides on ${draft.returnDate}`} onPress={() => {
        const next = { origin: draft.destination, destination: draft.origin, departureDate: draft.returnDate,
          routeType:draft.routeType==='HOME_TO_OFFICE'?'OFFICE_TO_HOME':draft.routeType==='OFFICE_TO_HOME'?'HOME_TO_OFFICE':draft.routeType||'',minimumSeats: draft.minimumSeats, womenOnly: draft.womenOnly || '', sort: 'TIME_ASC', timeZone: tz() };
        setDraft(next); apply(next);
      }} />}
      <View style={rideUI.toolbar}><Pressable accessibilityRole="button" accessibilityState={{expanded:sortOpen}} onPress={()=>{setSortOpen(v=>!v);setFilters(false);}} style={rideUI.control}><Ionicons name="swap-vertical-outline" size={16} color="#142D4E"/><Text style={rideUI.controlText}>Sort</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{expanded:filters}} onPress={()=>{setFilters(v=>!v);setSortOpen(false);}} style={rideUI.control}><Ionicons name="options-outline" size={16} color="#142D4E"/><Text style={rideUI.controlText}>Filters</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>{const next={origin:draft.origin,destination:draft.destination,departureDate:draft.departureDate,returnDate:draft.returnDate||'',routeType:draft.routeType||'',timeZone:tz(),sort:'TIME_ASC',minimumSeats:'1'};setDraft(next);apply(next);}} style={rideUI.control}><Text style={rideUI.controlText}>Clear filters</Text></Pressable></View>
      {sortOpen&&<View style={rideUI.form}><Choice label="Sort rides" values={sortOptions} selected={draft.sort} change={sort=>{const next={...draft,sort};setDraft(next);apply(next);setSortOpen(false);}}/></View>}
      {filters && <Card>
        {timeField('departureTime', 'Direct departure time')}
        <Choice label="Time range" selected={(draft.timeFrom || '') + ',' + (draft.timeTo || '')}
          values={[{ value: ',', label: 'Any time' }, { value: '07:00,12:00', label: '7 AM – 12 PM' },
            { value: '12:00,16:00', label: '12 PM – 4 PM' }, { value: '16:00,20:00', label: '4 PM – 8 PM' }, { value: '20:00,24:00', label: '8 PM – 12 AM' }]}
          change={value => { const [from, to] = value.split(','); setDraft(previous => ({ ...previous, departureTime: '', timeFrom: from, timeTo: to })); }} />
        {timeField('timeFrom', 'From time')}{timeField('timeTo', 'To time')}
        <Dropdown label="Boarding point" selected={draft.boardingPoint||''} values={[...points(draft.origin||''),...(result.data?.content.flatMap(r=>r.preferences?.boardingPoints||[])||[]),...(draft.boardingPoint?[draft.boardingPoint]:[])]} change={v=>update('boardingPoint',v)}/>
        <Dropdown label="Dropping point" selected={draft.droppingPoint||''} values={[...points(draft.destination||''),...(result.data?.content.flatMap(r=>r.preferences?.droppingPoints||[])||[]),...(draft.droppingPoint?[draft.droppingPoint]:[])]} change={v=>update('droppingPoint',v)}/>
        <Choice label="Flexible nearby drop-off" values={yesNo} selected={draft.flexibleDropoff || ''} change={value => update('flexibleDropoff', value)} />
        <Button label="Apply filters" onPress={() => {
          const next = { ...draft, timeTo: draft.timeTo === '00:00' ? '24:00' : draft.timeTo || '' }; setDraft(next); apply(next); result.reload();
        }} />
      </Card>}
      <ErrorText message={error} />
    </>}
    {!result.data ? <QueryState {...result} /> : <>
      {!result.data.content.length && <Copy>{mine ? 'You have not offered any rides yet.' : 'No rides match this route, date and filters.'}</Copy>}
      {result.data.content.map(ride => <View key={ride.id} style={rideUI.card}>
        <View style={rideUI.cardTop}><Text style={rideUI.time}>{departureClock(ride)}</Text><View><Text style={rideUI.price}>{ride.currency==='INR'?'â‚¹':ride.currency+' '}{ride.pricePerSeat}</Text><Text style={rideUI.perSeat}>per seat</Text></View></View>
        <Text style={rideUI.cardRoute}>{ride.origin} → {ride.destination}</Text>
        {mine&&<Text style={rideUI.secondary}>{date(ride.departureAt)}</Text>}
        <Text style={rideUI.secondary}>{ride.driver.displayName} · {ride.availableSeats} {ride.availableSeats===1?'seat':'seats'} available{ride.preferences?.womenOnly?' · Women only':''}</Text>
        <View style={rideUI.cardBottom}><Text style={[rideUI.secondary,{flex:1}]}>{ride.preferences?.routeType==='HOME_TO_OFFICE'?'Home → Office':ride.preferences?.routeType==='OFFICE_TO_HOME'?'Office → Home':'Shared journey'} · {ride.driverRating?ride.driverRating.toFixed(1)+'/5':'No ratings yet'}</Text><Pressable accessibilityRole="button" onPress={()=>go({kind:'ride',id:ride.id,requestedSeats})} hitSlop={4} style={rideUI.view}><Text style={{color:'#fff',fontWeight:'600',fontSize:12}}>{mine?'View ride':'Book ride'}</Text></Pressable></View>
        {ride.preferences?.requiresApproval&&<Text style={rideUI.secondary}>Driver approval required</Text>}
        {!!ride.reviews?.length&&<Text style={rideUI.secondary}>{ride.reviews[0].score}/5 · {ride.reviews[0].text||''}</Text>}
      </View>)}
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

export function RideDetails({ id, requestedSeats = 1, user, go }: { id: string; requestedSeats?: number; user: User | null; go: Navigate }) {
  const path = ridePath(id);
  const result = useQuery(path, async signal => demoMode ? demoRide(id) : api<Ride>(path, { auth: Boolean(user), signal }));
  const action = useAction();
  const [reason, setReason] = useState('');
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
    {!demoMode && user?.travelPreference!=='DRIVER' && !owner && future(ride) && ride.availableSeats > 0 && <SeatBooking ride={ride} requestedSeats={requestedSeats} user={user} go={go} />}
    <Button label="Refresh ride" onPress={result.reload} disabled={action.busy} />
  </>;
}

const rideFields = {
  origin: 'Leaving from', destination: 'Going to', departureAt: 'Departure',
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
  const points=useCityPoints();
  const [preferences, setPreferences] = useState<RidePreferences>(ride?.preferences || {
    boardingPoints: [], droppingPoints: [], hasCar: null, ac: false, flexibleDropoff: false, womenOnly: false, routeType: 'HOME_TO_OFFICE',
  });
  const [boarding, setBoarding] = useState(ride?.preferences?.boardingPoints.join('\n') || ride?.origin || '');
  const [dropping, setDropping] = useState(ride?.preferences?.droppingPoints.join('\n') || ride?.destination || '');
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
      if (!preferences.hasCar) throw new Error('A car is required to offer a carpool ride.');
      const stops = { boardingPoints: boarding.split(/\r?\n/).map(value => value.trim()).filter(Boolean), droppingPoints: dropping.split(/\r?\n/).map(value => value.trim()).filter(Boolean) };
      if (!stops.boardingPoints.length || !stops.droppingPoints.length) throw new Error('Add boarding and dropping points.');
      const saved = await api<Ride>(ride ? ridePath(ride.id) : '/rides', {
        method: ride ? 'PATCH' : 'POST', body: {
          ...draft, preferences: { ...preferences, ...stops }, departureAt: departure.toISOString(), timeZone: tz(), currency: draft.currency.trim().toUpperCase(),
          totalSeats: Number(draft.totalSeats), pricePerSeat: Number(draft.pricePerSeat),
          ...(ride ? { version: ride.version } : vehicleId ? { vehicleId } : {}),
        },
      });
      go({ kind: 'ride', id: saved.id });
    });
  }
  return <Card>
    <Copy>What You See Is What You Pay – No Hidden Charges, No Convenience Fees!</Copy>
    <Choice label="Do you have a car?" values={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} selected={String(preferences.hasCar)} change={value => setPreferences(previous => ({ ...previous, hasCar: value === 'true' }))} />
    <Choice label="Booking mode" values={[{ value: 'instant', label: 'Instant booking' }, { value: 'approval', label: 'Review requests' }]}
      selected={preferences.requiresApproval ? 'approval' : 'instant'} change={value => setPreferences(previous => ({ ...previous, requiresApproval: value === 'approval' }))} />
    <Choice label="Route type" values={[{ value: 'HOME_TO_OFFICE', label: 'Office · Home to Office' }, { value: 'OFFICE_TO_HOME', label: 'Home · Office to Home' }, { value: 'OTHER', label: 'Other' }]} selected={preferences.routeType} change={value => setPreferences(previous => ({ ...previous, routeType: value as RidePreferences['routeType'] }))} />
    {points(draft.origin).length>0&&<Button label="Use city boarding points" onPress={()=>setBoarding(points(draft.origin).join('\n'))}/>}
    <Field label="Boarding points, one per line" value={boarding} change={setBoarding} multiline />
    {points(draft.destination).length>0&&<Button label="Use city dropping points" onPress={()=>setDropping(points(draft.destination).join('\n'))}/>}
    <Field label="Dropping points, one per line" value={dropping} change={setDropping} multiline />
    {(['ac', 'flexibleDropoff', 'womenOnly'] as const).map(key => <Choice key={key} label={key === 'ac' ? 'Car has AC' : key === 'womenOnly' ? 'Women-only ride' : 'Agree to nearby requested drop-off, by arrangement'} values={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} selected={String(preferences[key])} change={value => setPreferences(previous => ({ ...previous, [key]: value === 'true' }))} />)}
    {Object.entries(rideFields).map(([name, label]) => {
      const key = name as keyof typeof rideFields;
      if (key === 'departureAt') {
        const selected = draft.departureAt ? new Date(draft.departureAt) : undefined;
        function changeDeparture(value: Date, mode: 'date' | 'time') {
          const departure = new Date(selected ?? Date.now());
          if (mode === 'date') departure.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
          else departure.setHours(value.getHours(), value.getMinutes(), 0, 0);
          setDraft(previous => ({ ...previous, departureAt: localDate(departure.toISOString()) }));
        }
        return <View key={key} style={styles.field}>
          <DateField label="Departure date" mode="date" value={selected} change={value => changeDeparture(value, 'date')} />
          <DateField label="Departure time" mode="time" value={selected} change={value => changeDeparture(value, 'time')} />
        </View>;
      }
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

const rideUI=StyleSheet.create({
 form:{padding:16,gap:12,borderRadius:16,borderWidth:1,borderColor:'#D5DEEA',backgroundColor:'#fff'},location:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40},link:{fontSize:14,color:'#245EEA',fontWeight:'600'},summary:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},route:{fontSize:15,fontWeight:'700',color:'#142D4E',flexShrink:1},meta:{flexDirection:'row',alignItems:'center',gap:4},secondary:{fontSize:13,lineHeight:19,color:'#4C5E75'},edit:{padding:6,minHeight:36,minWidth:32,justifyContent:'center'},toolbar:{flexDirection:'row',gap:8,flexWrap:'wrap'},control:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#D5DEEA',backgroundColor:'#fff'},controlText:{fontSize:13,color:'#142D4E',fontWeight:'600'},card:{padding:14,gap:6,borderRadius:14,borderWidth:1,borderColor:'#D5DEEA',backgroundColor:'#fff'},cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},time:{fontSize:22,fontWeight:'700',color:'#142D4E'},price:{fontSize:22,fontWeight:'700',color:'#142D4E',textAlign:'right'},perSeat:{fontSize:11,color:'#4C5E75',textAlign:'right'},cardRoute:{fontSize:14,fontWeight:'600',color:'#142D4E'},cardBottom:{flexDirection:'row',gap:8,alignItems:'center'},view:{backgroundColor:'#245EEA',paddingHorizontal:10,minHeight:36,borderRadius:10,justifyContent:'center'}
});
