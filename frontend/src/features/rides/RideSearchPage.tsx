import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../auth/auth';
import { ridesApi, type RidePage } from './api';
import { Pagination, RideCard } from './RideComponents';
export function RideSearchPage() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState<RidePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = params.toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    ridesApi.search(new URLSearchParams(query), controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) { setError(errorMessage(failure)); setResult(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of data.entries()) if (String(value).trim()) next.set(key, String(value).trim());
    next.set('page', '0'); next.set('size', '10'); setParams(next);
  }
  function page(number: number) { const next = new URLSearchParams(params); next.set('page', String(number)); setParams(next); }
  return <section className="page">
    <p className="eyebrow">Go further, together</p><h1>Where are you headed?</h1>
    <p className="intro">Find an available seat on your next shared journey.</p>
    <form className="panel ride-filter" onSubmit={search} key={query}>
      <label>Leaving from<input name="origin" maxLength={200} defaultValue={params.get('origin') || ''} placeholder="Origin city" /></label>
      <label>Going to<input name="destination" maxLength={200} defaultValue={params.get('destination') || ''} placeholder="Destination city" /></label>
      <label>Travel date<input name="departureDate" type="date" defaultValue={params.get('departureDate') || ''} /></label>
      <label>Date time zone<input name="timeZone" defaultValue={params.get('timeZone') || Intl.DateTimeFormat().resolvedOptions().timeZone} required maxLength={64} /></label>
      <label>Seats needed<input name="minimumSeats" type="number" min={1} max={6} step={1} defaultValue={params.get('minimumSeats') || '1'} /></label>
      <label>Maximum price per seat<input name="maximumPrice" type="number" min={0} max="9999999999.99" step="0.01" defaultValue={params.get('maximumPrice') || ''} /></label>
      <button className="button" type="submit">Search rides</button><Link to="/rides">Clear filters</Link>
      <p className="notice">Location filters match the start of a city name, ignoring case. Prices show each ride’s currency.</p>
    </form>
    <div className="ride-results" aria-busy={loading}>
      {loading ? <p role="status">Finding rides…</p> : error ? <p role="alert">{error}</p> : result && <>
        <p role="status">{result.totalElements ? `${result.totalElements} rides found` : 'No rides found. Try another date or route.'}</p>
        {result.content.map(ride => <RideCard ride={ride} key={ride.id} />)}
        <Pagination page={result.page} totalPages={result.totalPages} loading={loading} onChange={page} />
      </>}
    </div>
  </section>;
}
