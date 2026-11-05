import { useState } from 'react';
import { groupWalletApi } from './api';
import { Button, Card, Copy, Field, QueryState, date, useQuery } from './ui';

export function GroupOffers() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [search, setSearch] = useState({ origin: '', destination: '', page: 0 });
  const query = useQuery(JSON.stringify(search),
    () => groupWalletApi.offers(search.page, search.origin, search.destination));

  return <>
    <Card>
      <Copy>Open Ride Group</Copy>
      <Field label="Leaving from" value={origin} change={setOrigin} />
      <Field label="Going to" value={destination} change={setDestination} />
      <Button label="Find seats" onPress={() => {
        setSearch({ origin: origin.trim(), destination: destination.trim(), page: 0 });
        query.reload();
      }} />
    </Card>
    {!query.data ? <QueryState error={query.error} reload={query.reload} /> : <>
      {query.data.content.length === 0 && <Copy>No available seats match this search.</Copy>}
      {query.data.content.map(offer => <Card key={offer.rideId}>
        <Copy>{offer.origin} {'→'} {offer.destination}</Copy>
        <Copy>{date(offer.departureAt)}</Copy>
        <Copy>{offer.availableSeats} available · INR {(offer.farePerSeatPaise / 100).toFixed(2)} per seat</Copy>
      </Card>)}
      {search.page > 0 && <Button label="Previous page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page - 1 }))} />}
      {search.page + 1 < query.data.totalPages && <Button label="Next page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page + 1 }))} />}
      <Button label="Refresh availability" onPress={query.reload} />
    </>}
  </>;
}
