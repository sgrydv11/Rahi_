import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { errorMessage } from '../auth/auth';
import { ridesApi, type RidePage } from './api';
import { Pagination, RideCard } from './RideComponents';
export function MyRidesPage() {
  const [params, setParams] = useSearchParams();
  const parsed = Number(params.get('page') || 0); const page = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  const [result, setResult] = useState<RidePage | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    ridesApi.mine(page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page]);
  return <section className="page"><h1>My rides.</h1><Link className="button" to="/rides/new">Offer a ride</Link>
    <div className="ride-results" aria-busy={loading}>
      {loading ? <p role="status">Loading your rides…</p> : error ? <p role="alert">{error}</p> : result && <>
        {!result.content.length && <p role="status">No rides on this page. Offer a ride to get started.</p>}
        {result.content.map(ride => <RideCard ride={ride} key={ride.id} />)}
        <Pagination page={result.page} totalPages={result.totalPages} loading={loading} onChange={number => setParams({ page: String(number) })} />
      </>}
    </div>
  </section>;
}
