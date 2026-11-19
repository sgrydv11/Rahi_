import {authenticatedRequest} from '../auth/auth';
import {namedRides} from './namedRides';
import './ride-search.css';
import {nearbyCity} from './nearbyCity';
import {useAuth} from '../auth/AuthContext';
import {canBook} from '../auth/capabilities';
import {Icon} from '../../app/Icon';
import { useCityPoints } from './locations';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../auth/auth';
import { ridesApi, type RidePage } from './api';
import { Pagination, RideCard } from './RideComponents';

const seatOptions = [1, 2, 3, 4];

function day(offset = 0) {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function RideSearchPage() {
  const{user}=useAuth();
  const cityPoints=useCityPoints();
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(params.get('departureDate')||day());
  const [origin,setOrigin]=useState(params.get('origin')||''),[editing,setEditing]=useState(false),[locating,setLocating]=useState(false),[locationMessage,setLocationMessage]=useState('');
  const [destination,setDestination]=useState(params.get('destination')||''),[routeType,setRouteType]=useState(params.get('routeType')||'');
  const [savedRoutes,setSavedRoutes]=useState<{origin:string;destination:string;period:string}[]>([]);
  useEffect(()=>{if(!user)return;const c=new AbortController();authenticatedRequest<{origin:string;destination:string;period:string}[]>('/travel-preferences',{signal:c.signal}).then(setSavedRoutes).catch(()=>{});return()=>c.abort();},[user?.id]);
  const rideChoices=[...namedRides,...savedRoutes.map((r,i)=>({value:'saved-'+i,label:`${r.period==='MORNING'?'Office':r.period==='EVENING'?'Home':'Saved'} · ${r.origin} → ${r.destination}`,origin:r.origin,destination:r.destination,routeType:''}))];
  const [boardingPoint,setBoardingPoint]=useState(params.get('boardingPoint')||''),[droppingPoint,setDroppingPoint]=useState(params.get('droppingPoint')||'');
  const [calendar, setCalendar] = useState(false);
  const dateInput=useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<RidePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const query = params.toString();
  const selected = Boolean(params.get('origin')?.trim() && params.get('destination')?.trim());
  const seats = seatOptions.find(value => String(value) === params.get('minimumSeats')) ?? 1;
  const returnDate = params.get('returnDate');
  const returnQuery = selected && returnDate ? new URLSearchParams({
    origin: params.get('destination')!, destination: params.get('origin')!, departureDate: returnDate,
    minimumSeats: String(seats), page: '0', size: '10', timeZone: params.get('timeZone') || 'Asia/Kolkata',
  }) : null;
  if(returnQuery&&params.get('routeType'))returnQuery.set('routeType',params.get('routeType')==='HOME_TO_OFFICE'?'OFFICE_TO_HOME':params.get('routeType')==='OFFICE_TO_HOME'?'HOME_TO_OFFICE':params.get('routeType')!);
  if (returnQuery && params.get('womenOnly') === 'true') returnQuery.set('womenOnly', 'true');
  useEffect(() => {
    if (!selected) { setResult(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    const searchParams = new URLSearchParams(query);
    searchParams.delete('returnDate'); searchParams.delete('ac');
    ridesApi.search(searchParams, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) { setError(errorMessage(failure)); setResult(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, selected]);
  function locateCity(){
    if(!navigator.geolocation){setLocationMessage('Location is unavailable. Enter your city manually.');return;}
    setLocating(true);setLocationMessage('');navigator.geolocation.getCurrentPosition(position=>{
      setLocating(false);const city=nearbyCity(position.coords.latitude,position.coords.longitude);
      if(city){setOrigin(city);setBoardingPoint('');setLocationMessage(`Nearby city: ${city}. You can edit it.`);}else setLocationMessage('No supported city nearby. Enter your city manually.');
    },()=>{setLocating(false);setLocationMessage('Location was unavailable or not allowed. Enter your city manually.');},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) if (String(value).trim()) next.set(key, String(value).trim());
    if (next.get('origin')?.toLowerCase() === next.get('destination')?.toLowerCase()) { setError('Choose different cities.'); return; }
    const returnDay = next.get('returnDate');
    if (returnDay && returnDay < (next.get('departureDate') || day())) { setError('Choose a return date on or after departure.'); return; }
    next.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    next.set('page', '0'); next.set('size', '10'); setEditing(false);setParams(next);
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params); next.set(key, value); next.set('page', '0'); setParams(next);
  }
  function filters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(params);
    for (const name of ['departureTime', 'timeFrom', 'timeTo', 'boardingPoint', 'droppingPoint', 'flexibleDropoff']) {
      const value = String(data.get(name) ?? '').trim(); if (value) next.set(name, value); else next.delete(name);
    }
    const preset = String(data.get('window') ?? '');
    if (preset) { const [from, to] = preset.split(','); next.set('timeFrom', from); next.set('timeTo', to); }
    if (next.get('timeTo') === '00:00') next.set('timeTo', '24:00');
    if (next.has('departureTime') && (next.has('timeFrom') || next.has('timeTo'))) { setError('Choose a direct time or a range, not both.'); return; }
    next.set('page', '0'); setParams(next);
  }
  if(!canBook(user))return <section className="page"><h1>Book a ride</h1><p>Select Passenger or Both in <Link to="/profile">Account</Link> to find and book rides.</p></section>;
  return <section className={`page ride-search-page ${selected&&!editing?'compact-results':''}`}>
    {(!selected||editing)&&<h1>Where are you headed?</h1>}
    {!selected||editing ? <form className="panel ride-search-compact" onSubmit={search}>
      <label className="route-preference">Choose a ride<select aria-label="Choose a ride" value={rideChoices.find(r=>r.origin===origin&&r.destination===destination)?.value||''} onChange={e=>{const r=rideChoices.find(r=>r.value===e.target.value);if(r){setOrigin(r.origin);setDestination(r.destination);setRouteType(r.routeType);setBoardingPoint('');setDroppingPoint('');}}}><option value="">Choose a ride</option>{rideChoices.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label><input type="hidden" name="routeType" value={routeType}/>
      <div className="journey-fields"><div className="from-city-row"><label className="city-field"><span aria-hidden="true"><Icon name="location-outline"/></span><span>From City<input aria-label="From City" name="origin" value={origin} onChange={e=>{setOrigin(e.target.value);setBoardingPoint('');}} required maxLength={200} placeholder="Leaving from" /></span></label><button className="city-locate-icon" aria-label="Use current city" title="Use current city" type="button" disabled={locating} onClick={locateCity}><Icon name="locate-outline"/></button></div>
      {locationMessage&&<p className="location-message" role="status">{locationMessage}</p>}<label className="city-field"><span aria-hidden="true"><Icon name="location-outline"/></span><span>To City<input aria-label="To City" name="destination" value={destination} onChange={e=>{setDestination(e.target.value);setDroppingPoint('');}} required maxLength={200} placeholder="Going to" /></span></label>
      <div className="journey-date"><input type="hidden" name="departureDate" value={date} />
        <button className="calendar-trigger" type="button" aria-label="Calendar" onClick={()=>{setCalendar(true);try{dateInput.current?.showPicker();}catch{dateInput.current?.focus();}}}><Icon name="calendar-outline"/><span><small>Date of Journey</small><strong>{new Date(date+'T12:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong></span></button>
        <button className="date-chip" type="button" aria-pressed={date===day()} onClick={()=>{setDate(day());setCalendar(false);}}>Today</button><button className="date-chip" type="button" aria-pressed={date===day(1)} onClick={()=>{setDate(day(1));setCalendar(false);}}>Tomorrow</button>
      </div></div>
      <div className="search-extras"><label>Boarding point<select name="boardingPoint" value={boardingPoint} onChange={e=>setBoardingPoint(e.target.value)}><option value="">Any boarding point</option>{cityPoints(origin).map(p=><option key={p}>{p}</option>)}</select></label><label>Dropping point<select name="droppingPoint" value={droppingPoint} onChange={e=>setDroppingPoint(e.target.value)}><option value="">Any dropping point</option>{cityPoints(destination).map(p=><option key={p}>{p}</option>)}</select></label></div>
      <label className={calendar?'calendar-input':'calendar-input visually-hidden'}>Custom date<input ref={dateInput} type="date" required min={day()} value={date} onChange={event=>{if(event.target.value){setDate(event.target.value);setCalendar(false);}}} /></label>

      <label className="women-toggle"><span>Booking for women<small>Show women-only rides</small></span><input name="womenOnly" defaultChecked={params.get('womenOnly')==='true'} type="checkbox" role="switch" aria-label="Women-only rides" value="true" /></label>
      <div className="search-extras">
      <label>Return date (optional)<input type="date" name="returnDate" defaultValue={params.get('returnDate')||''} min={date} /></label>
      <label>Seats<select name="minimumSeats" defaultValue={seats}>
        {seatOptions.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      </div><button className="button search-submit" type="submit" aria-label="Search rides">⌕ Search rides</button>
    </form> : <>
      <div className="search-summary"><div><strong>{params.get('origin')} <span aria-hidden="true">→</span> {params.get('destination')}</strong><div className="search-summary-meta"><span>{new Date((params.get('departureDate')||day())+'T12:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {seats} {seats===1?'seat':'seats'}</span><button className="edit-search" aria-label="Edit search" onClick={()=>{setOrigin(params.get('origin')||'');setDestination(params.get('destination')||'');setRouteType(params.get('routeType')||'');setDate(params.get('departureDate')||day());setBoardingPoint(params.get('boardingPoint')||'');setDroppingPoint(params.get('droppingPoint')||'');setEditing(true);}}><Icon name="create-outline"/></button></div></div></div>
      {returnQuery && <p><Link to={`/rides?${returnQuery}`}>Find return rides on {returnDate}</Link></p>}
      <div className="ride-results-toolbar"><details className="panel filter-sort-panel sort-panel"><summary><Icon name="swap-vertical-outline"/>Sort</summary><div className="sort-toggles" role="group" aria-label="Sort rides">{[['TIME','Time'],['PRICE','Price'],['RATING','Rating']].map(([key,label])=>{const current=params.get('sort')||'TIME_ASC',selected=current.startsWith(key),descending=selected&&current.endsWith('DESC');return <button type="button" key={key} aria-pressed={selected} aria-label={`Sort by ${label.toLowerCase()} ${descending?'descending':'ascending'}`} onClick={()=>change('sort',key+(selected&&!descending?'_DESC':'_ASC'))}>{label} {descending?'↓':'↑'}</button>;})}</div></details><details className="panel filter-sort-panel"><summary><Icon name="options-outline"/>Filters</summary>
      <label>Seats<select value={seats} onChange={event => change('minimumSeats', event.target.value)}>
        {seatOptions.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <form className="ride-filter" key={query} onSubmit={filters}>
        <label>Direct departure time<input name="departureTime" type="time" defaultValue={params.get('departureTime') || ''} /></label>
        <label>Time range<select name="window" defaultValue=""><option value="">Custom range or any time</option>
          <option value="07:00,12:00">7 AM – 12 PM</option><option value="12:00,16:00">12 PM – 4 PM</option>
          <option value="16:00,20:00">4 PM – 8 PM</option><option value="20:00,24:00">8 PM – 12 AM</option>
        </select></label>
        <label>From time<input name="timeFrom" type="time" defaultValue={params.get('timeFrom') || ''} /></label>
        <label>To time<input name="timeTo" type="time" defaultValue={params.get('timeTo') === '24:00' ? '00:00' : params.get('timeTo') || ''} /></label>
        <label>Boarding point<select name="boardingPoint" defaultValue={params.get('boardingPoint')||''}><option value="">Any boarding point</option>{[...new Set([...cityPoints(params.get('origin')||''),...(result?.content.flatMap(r=>r.preferences?.boardingPoints||[])||[]),params.get('boardingPoint')||''])].filter(Boolean).map(p=><option key={p}>{p}</option>)}</select></label>
        <label>Dropping point<select name="droppingPoint" defaultValue={params.get('droppingPoint')||''}><option value="">Any dropping point</option>{[...new Set([...cityPoints(params.get('destination')||''),...(result?.content.flatMap(r=>r.preferences?.droppingPoints||[])||[]),params.get('droppingPoint')||''])].filter(Boolean).map(p=><option key={p}>{p}</option>)}</select></label>
        <label><input type="checkbox" name="flexibleDropoff" value="true" defaultChecked={params.get('flexibleDropoff') === 'true'} />Flexible nearby drop-off</label>
        <button className="button">Apply filters</button>
      </form></details><button className="date-chip" type="button" onClick={()=>{const next=new URLSearchParams();for(const key of ['origin','destination','departureDate','returnDate','timeZone','routeType'])if(params.has(key))next.set(key,params.get(key)!);next.set('minimumSeats','1');next.set('sort','TIME_ASC');next.set('page','0');setError('');setParams(next);}}>Clear filters</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
    {!editing&&<div className="ride-results" aria-busy={loading}>
      {loading ? <p role="status">Finding rides…</p> : result && <>
        <p role="status">{result.totalElements ? `${result.totalElements} rides found` : 'No rides found. Try another date or route.'}</p>
        {result.content.map(ride => <RideCard compact ride={ride} requestedSeats={seats} key={ride.id} />)}
        <Pagination page={result.page} totalPages={result.totalPages} loading={loading} onChange={number => { const next = new URLSearchParams(params); next.set('page', String(number)); setParams(next); }} />
      </>}
    </div>}
  </section>;
}
