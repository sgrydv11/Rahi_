import { Linking } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { GroupOffer, SeatHold } from './groupWallet';
import { groupWalletApi } from './api';
import { Button, Card, Copy, ErrorText, Field, QueryState, date, useAction, useQuery } from './ui';

export function GroupOffers({ userId, openBooking }: { userId: string; openBooking: (id: string) => void }) {
  const storageKey = 'hoopr.group-hold.' + userId;
  const recovery = useQuery(storageKey, async () => {
    const id = await SecureStore.getItemAsync(storageKey);
    return { hold: id ? await groupWalletApi.getHold(id) : undefined };
  });
  const [dismissed, setDismissed] = useState(false);
  const [hold, setHold] = useState<SeatHold>();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [search, setSearch] = useState({ origin: '', destination: '', page: 0 });
  const query = useQuery(JSON.stringify(search),
    () => groupWalletApi.offers(search.page, search.origin, search.destination));

  async function remember(next: SeatHold) {
    setHold(next);
    await SecureStore.setItemAsync(storageKey, next.id);
  }

  const current = hold ?? (dismissed ? undefined : recovery.data?.hold);
  if (current) return <HoldCard openBooking={openBooking} hold={current} update={setHold}
    restored={hold === undefined} back={async () => {
      await SecureStore.deleteItemAsync(storageKey);
      setDismissed(true);
      setHold(undefined);
      query.reload();
    }} />;
  if (!dismissed && !recovery.data) return <QueryState error={recovery.error} reload={recovery.reload} />;

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
      {query.data.content.map(offer => <OfferCard key={offer.rideId} offer={offer} onHold={remember} />)}
      {search.page > 0 && <Button label="Previous page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page - 1 }))} />}
      {search.page + 1 < query.data.totalPages && <Button label="Next page"
        onPress={() => setSearch(previous => ({ ...previous, page: previous.page + 1 }))} />}
      <Button label="Refresh availability" onPress={query.reload} />
    </>}
  </>;
}

function OfferCard({ offer, onHold }: { offer: GroupOffer; onHold: (hold: SeatHold) => Promise<void> }) {
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
      await onHold(await groupWalletApi.hold(offer.rideId, count, request.current.key));
    })} />
    <ErrorText message={action.error} />
  </Card>;
}

function HoldCard({ hold, update, back, openBooking, restored }: {
  hold: SeatHold; update: (hold: SeatHold) => void; back: () => Promise<void>; openBooking: (id: string) => void; restored: boolean;
}) {
  const checkoutKey = useRef<string | undefined>(undefined);
  const walletKey = useRef<string | undefined>(undefined);
  const [started, setStarted] = useState(hold.status === 'PAYMENT_PENDING');
  const [now, setNow] = useState(Date.now);
  const action = useAction();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000));
  const payable = hold.status === 'HELD' || hold.status === 'PAYMENT_PENDING';
  const active = payable && remaining > 0;
  const message = active ? 'Seats held temporarily' : payable ? 'Hold expired' : hold.status.replace(/_/g, ' ').toLowerCase();
  return <Card>
    <Copy>{message}</Copy>
    <Copy>{hold.seats} seat(s). INR {(hold.quote.totalPaise / 100).toFixed(2)} total.</Copy>
    {active && <Copy>{remaining} seconds left.</Copy>}
    {active && !started && <Button label="Pay from wallet" disabled={action.busy} onPress={() => action.run(async () => {
      walletKey.current ??= randomUUID();
      const result = await groupWalletApi.checkout(hold.id, 'WALLET', walletKey.current);
      update(result.hold);
    })} />}
    {active && <Button label="Pay test fare" disabled={action.busy} onPress={() => action.run(async () => {
      checkoutKey.current ??= randomUUID();
      const result = await groupWalletApi.checkout(hold.id, 'PROVIDER', checkoutKey.current);
      update(result.hold);
      setStarted(true);
      if (Date.parse(result.hold.expiresAt) <= Date.now()) throw new Error('This seat hold has expired.');
      const checkout = result.checkout;
      if (!checkout) throw new Error('Test checkout is unavailable.');
      if (checkout.provider === 'stripe') {
        const url = new URL(checkout.checkoutUrl);
        if (url.origin !== 'https://checkout.stripe.com') throw new Error('Invalid Stripe Checkout address.');
        await Linking.openURL(url.toString());
      } else {
        if (!checkout.keyId?.startsWith('rzp_test_') || !checkout.orderId) throw new Error('Test checkout is unavailable.');
        await RazorpayCheckout.open({
          key: checkout.keyId, order_id: checkout.orderId, amount: String(hold.quote.totalPaise),
          currency: hold.quote.currency, name: 'Hoopr', description: 'Test ride fare',
        });
        update(await groupWalletApi.sync(hold.id));
      }
    })} />}
    {started && payable && <Copy>After checkout, return here and check payment status.</Copy>}
    {hold.status === 'REFUND_PENDING' && <Copy>The payment arrived after the seats were released. Check payment status to process the refund.</Copy>}
    {(started || restored) && !hold.bookingId && hold.status !== 'REFUNDED' &&
      <Button label="Check payment status" disabled={action.busy}
        onPress={() => action.run(async () => update(await groupWalletApi.sync(hold.id)))} />}
    <Button label="Check hold status" disabled={action.busy}
      onPress={() => action.run(async () => update(await groupWalletApi.getHold(hold.id)))} />
    {active && <Button label="Release seats" disabled={action.busy}
      onPress={() => action.run(async () => update(await groupWalletApi.cancel(hold.id)))} />}
    {hold.bookingId && <Button label="Open confirmed booking" disabled={action.busy}
      onPress={() => { if (hold.bookingId) openBooking(hold.bookingId); }} />}
    <Button label="Back to offers" disabled={active || action.busy} onPress={() => action.run(back)} />
    <ErrorText message={action.error} />
  </Card>;
}