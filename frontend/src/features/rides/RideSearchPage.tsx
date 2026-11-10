import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../auth/auth';
import { ridesApi, type RidePage } from './api';
import { Pagination, RideCard } from './RideComponents';

const seatOptions = [1, 2, 3, 4, 5, 6];

function day(offset = 0) {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function RideSearchPage() {
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(day());
  const [calendar, setCalendar] = useState(false);
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
  if (returnQuery && params.get('womenOnly') === 'true') returnQuery.set('womenOnly', 'true');
  useEffect(() => {
    if (!selected) { setResult(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError('');
    const searchParams = new URLSearchParams(query);
    searchParams.delete('returnDate');
    ridesApi.search(searchParams, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) { setError(errorMessage(failure)); setResult(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, selected]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) if (String(value).trim()) next.set(key, String(value).trim());
    if (next.get('origin')?.toLowerCase() === next.get('destination')?.toLowerCase()) { setError('Choose different cities.'); return; }
    const returnDay = next.get('returnDate');
    if (returnDay && returnDay < (next.get('departureDate') || day())) { setError('Choose a return date on or after departure.'); return; }
    next.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    next.set('page', '0'); next.set('size', '10'); setParams(next);
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params); next.set(key, value); next.set('page', '0'); setParams(next);
  }
  function filters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams(params);
    for (const name of ['departureTime', 'timeFrom', 'timeTo', 'boardingPoint', 'droppingPoint', 'ac', 'flexibleDropoff']) {
      const value = String(data.get(name) ?? '').trim(); if (value) next.set(name, value); else next.delete(name);
    }
    const preset = String(data.get('window') ?? '');
    if (preset) { const [from, to] = preset.split(','); next.set('timeFrom', from); next.set('timeTo', to); }
    if (next.get('timeTo') === '00:00') next.set('timeTo', '24:00');
    if (next.has('departureTime') && (next.has('timeFrom') || next.has('timeTo'))) { setError('Choose a direct time or a range, not both.'); return; }
    next.set('page', '0'); setParams(next);
  }
  return <section className="page">
    <p className="eyebrow">Go further, together</p><h1>{selected ? 'Available rides' : 'Where are you headed?'}</h1>
    {!selected ? <form className="panel ride-filter" onSubmit={search}>
      <label>From City<input name="origin" required maxLength={200} placeholder="From City" /></label>
      <label>To City<input name="destination" required maxLength={200} placeholder="To City" /></label>
      <fieldset><legend>Date of Journey</legend><input type="hidden" name="departureDate" value={date} />
        <div className="ride-actions"><button type="button" onClick={() => { setDate(day()); setCalendar(false); }}>Today</button><button type="button" onClick={() => { setDate(day(1)); setCalendar(false); }}>Tomorrow</button><button type="button" onClick={() => setCalendar(true)}>Calendar</button></div>
        {calendar && <label>Custom date<input type="date" required min={day()} value={date} onChange={event => setDate(event.target.value)} /></label>}
        <p>{date}</p>
      </fieldset>
      <label>Return date (optional)<input type="date" name="returnDate" min={date} /></label>
      <label><input name="womenOnly" type="checkbox" value="true" />Women-only rides</label>
      <label>Passengers<select name="minimumSeats" defaultValue={seats}>
        {seatOptions.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <button className="button" type="submit">Search rides</button>
    </form> : <>
      <p>{params.get('origin')} → {params.get('destination')} · {params.get('departureDate') || day()} <Link to={`/rides?minimumSeats=${seats}`}>Change search</Link></p>
      {returnQuery && <p><Link to={`/rides?${returnQuery}`}>Find return rides on {returnDate}</Link></p>}
      <label>Passengers<select value={seats} onChange={event => change('minimumSeats', event.target.value)}>
        {seatOptions.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>Sort<select value={params.get('sort') || 'TIME_ASC'} onChange={event => change('sort', event.target.value)}>
        <option value="TIME_ASC">Time ascending</option><option value="TIME_DESC">Time descending</option>
        <option value="PRICE_ASC">Price ascending</option><option value="PRICE_DESC">Price descending</option>
        <option value="RATING_ASC">Rating ascending</option><option value="RATING_DESC">Rating descending</option>
      </select></label>
      <details className="panel"><summary>Filter rides</summary><form className="ride-filter" key={query} onSubmit={filters}>
        <label>Direct departure time<input name="departureTime" type="time" defaultValue={params.get('departureTime') || ''} /></label>
        <label>Time range<select name="window" defaultValue=""><option value="">Custom range or any time</option>
          <option value="07:00,12:00">7 AM – 12 PM</option><option value="12:00,16:00">12 PM – 4 PM</option>
          <option value="16:00,20:00">4 PM – 8 PM</option><option value="20:00,24:00">8 PM – 12 AM</option>
        </select></label>
        <label>From time<input name="timeFrom" type="time" defaultValue={params.get('timeFrom') || ''} /></label>
        <label>To time<input name="timeTo" type="time" defaultValue={params.get('timeTo') === '24:00' ? '00:00' : params.get('timeTo') || ''} /></label>
        <label>Boarding point<input name="boardingPoint" maxLength={200} defaultValue={params.get('boardingPoint') || ''} /></label>
        <label>Dropping point<input name="droppingPoint" maxLength={200} defaultValue={params.get('droppingPoint') || ''} /></label>
        <label><input type="checkbox" name="ac" value="true" defaultChecked={params.get('ac') === 'true'} />AC</label>
        <label><input type="checkbox" name="flexibleDropoff" value="true" defaultChecked={params.get('flexibleDropoff') === 'true'} />Flexible nearby drop-off</label>
        <button className="button">Apply filters</button>
      </form></details>
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="ride-results" aria-busy={loading}>
      {loading ? <p role="status">Finding rides…</p> : result && <>
        <p role="status">{result.totalElements ? `${result.totalElements} rides found` : 'No rides found. Try another date or route.'}</p>
        {result.content.map(ride => <RideCard ride={ride} requestedSeats={seats} key={ride.id} />)}
        <Pagination page={result.page} totalPages={result.totalPages} loading={loading} onChange={number => { const next = new URLSearchParams(params); next.set('page', String(number)); setParams(next); }} />
      </>}
    </div>
  </section>;
}
