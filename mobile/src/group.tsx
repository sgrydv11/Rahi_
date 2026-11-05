import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import type { GroupOffer, SeatHold } from './groupWallet';
import { groupWalletApi } from './api';
import { Button, Card, Copy, ErrorText, Field, QueryState, date, useAction, useQuery } from './ui';

export function GroupOffers() {
  const [hold, setHold] = useState<SeatHold>();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [search, setSearch] = useState({ origin: '', destination: '', page: 0 });
  const query = useQuery(JSON.stringify(search),
    () => groupWalletApi.offers(search.page, search.origin, search.destination));

  if (hold) return <HoldCard hold={hold} update={setHold} back={() => { setHold(undefined); query.reload(); }} />;

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
      {query.data.content.map(offer => <OfferCard key={offer.rideId} offer={offer} onHold={setHold} />)}
      {search.page > 0 && <Button label="Previous page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page - 1 }))} />}
      {search.page + 1 < query.data.totalPages && <Button label="Next page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page + 1 }))} />}
      <Button label="Refresh availability" onPress={query.reload} />
    </>}
  </>;
}

function OfferCard({ offer, onHold }: { offer: GroupOffer; onHold: (hold: SeatHold) => void }) {
  const [seats, setSeats] = useState('1');
  const request = useRef<{ seats: number; key: string } | undefined>(undefined);
  const action = useAction();
  const count = Number(seats);
  const valid = /^[1-6]$/.test(seats) && count <= offer.availableSeats;
  return <Card>
    <Copy>{offer.origin} to {offer.destination}</Copy>
    <Copy>{date(offer.departureAt)}</Copy>
    <Copy>{offer.availableSeats} available. INR {(offer.farePerSeatPaise / 100).toFixed(2)} per seat.</Copy>
    <Field label="Number of seats" value={seats} change={setSeats} numeric />
    <Button label="Hold seats" disabled={!valid || action.busy} onPress={() => action.run(async () => {
      if (request.current?.seats !== count) request.current = { seats: count, key: randomUUID() };
      onHold(await groupWalletApi.hold(offer.rideId, count, request.current.key));
    })} />
    <ErrorText message={action.error} />
  </Card>;
}

function HoldCard({ hold, update, back }: { hold: SeatHold; update: (hold: SeatHold) => void; back: () => void }) {
  const [now, setNow] = useState(Date.now);
  const action = useAction();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000));
  const active = hold.status === 'HELD' && remaining > 0;
  return <Card>
    <Copy>{active ? 'Seats held temporarily' : hold.status === 'HELD' ? 'Hold expired' : hold.status.toLowerCase()}</Copy>
    <Copy>{hold.seats} seat(s). INR {(hold.quote.totalPaise / 100).toFixed(2)} total.</Copy>
    {active && <Copy>{remaining} seconds left. Payment from this screen is unavailable.</Copy>}
    <Button label="Check hold status" disabled={action.busy}
      onPress={() => action.run(async () => update(await groupWalletApi.getHold(hold.id)))} />
    {active && <Button label="Release seats" disabled={action.busy}
      onPress={() => action.run(async () => update(await groupWalletApi.cancel(hold.id)))} />}
    <Button label="Back to offers" disabled={active || action.busy} onPress={back} />
    <ErrorText message={action.error} />
  </Card>;
}