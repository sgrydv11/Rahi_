import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import RazorpayCheckout from 'react-native-razorpay';
import { groupWalletApi } from './api';
import { parseTopUpPaise } from './groupWallet';
import { Button, Card, Copy, ErrorText, Field, QueryState, date, useAction, useQuery } from './ui';

const rupees = (paise: number) => 'INR ' + (paise / 100).toFixed(2);

export function Wallet({ userId }: { userId: string }) {
  const storageKey = 'hoopr.wallet-top-up.' + userId;
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const pending = useQuery(storageKey, () => SecureStore.getItemAsync(storageKey).then(id => ({ id })));
  const [topUpId, setTopUpId] = useState<string | null>();
  const activeId = topUpId === undefined ? pending.data?.id : topUpId;
  const request = useRef<{ amount: number; key: string } | undefined>(undefined);
  const action = useAction();
  const balance = useQuery('balance', groupWalletApi.wallet);
  const history = useQuery(String(page), () => groupWalletApi.transactions(page));
  const amount = parseTopUpPaise(input);

  async function sync(id: string) {
    const operation = await groupWalletApi.syncTopUp(id);
    if (operation.status === 'PENDING') {
      setMessage('Waiting for the payment provider to confirm this top-up.');
      return;
    }
    await SecureStore.deleteItemAsync(storageKey);
    setTopUpId(null);
    request.current = undefined;
    setMessage(operation.status === 'SUCCEEDED' ? 'Wallet credited.' : 'Top-up failed.');
    balance.reload();
    history.reload();
  }

  async function openCheckout({ operation, checkout }: Awaited<ReturnType<typeof groupWalletApi.getTopUp>>) {
    if (operation.status !== 'PENDING') { await sync(operation.id); return; }
    setMessage('Return here after checkout to check the payment status.');
    if (checkout.provider === 'stripe') {
      const url = new URL(checkout.checkoutUrl);
      if (url.origin !== 'https://checkout.stripe.com') throw new Error('Invalid Stripe Checkout address.');
      await Linking.openURL(url.toString());
    } else {
      if (!checkout.keyId?.startsWith('rzp_test_') || !checkout.orderId) throw new Error('Test checkout is unavailable.');
      await RazorpayCheckout.open({ key: checkout.keyId, order_id: checkout.orderId,
        amount: String(operation.amountPaise), currency: 'INR', name: 'Hoopr', description: 'Test wallet top-up' });
      await sync(operation.id);
    }
  }

  return <>
    <Card>
      <Copy>Wallet balance</Copy>
      {balance.data ? <Copy>{rupees(balance.data.availablePaise)} available</Copy> :
        <QueryState error={balance.error} reload={balance.reload} />}
      <Copy>Test-mode top-ups</Copy>
      <Field label="Amount in INR (1 to 10,000)" value={input} change={setInput} numeric />
      <Button label="Add test funds" disabled={action.busy || !!activeId || !pending.data || amount === null}
        onPress={() => action.run(async () => {
          if (amount === null) return;
          if (request.current?.amount !== amount) request.current = { amount, key: randomUUID() };
          const { operation, checkout } = await groupWalletApi.topUp(amount, request.current.key);
          setTopUpId(operation.id);
          await SecureStore.setItemAsync(storageKey, operation.id);
          await openCheckout({ operation, checkout });
        })} />
      {activeId && <Button label="Resume test checkout" disabled={action.busy}
        onPress={() => action.run(async () => {
          const operation = await groupWalletApi.syncTopUp(activeId);
          if (operation.status === 'PENDING') await openCheckout(await groupWalletApi.getTopUp(activeId));
          else await sync(activeId);
        })} />}
      {activeId && <Button label="Check top-up status" disabled={action.busy}
        onPress={() => action.run(() => sync(activeId))} />}
      {message && <Copy>{message}</Copy>}
      <ErrorText message={action.error || pending.error} />
    </Card>
    <Card>
      <Copy>Wallet activity</Copy>
      {!history.data ? <QueryState error={history.error} reload={history.reload} /> :
        history.data.content.length ? history.data.content.map(entry =>
          <Copy key={entry.id}>{entry.kind.replace(/_/g, ' ')} {rupees(entry.amountPaise)} · {date(entry.createdAt)}</Copy>) :
          <Copy>No transactions yet.</Copy>}
      {page > 0 && <Button label="Previous page" onPress={() => setPage(page - 1)} />}
      {history.data && page + 1 < history.data.totalPages && <Button label="Next page" onPress={() => setPage(page + 1)} />}
    </Card>
  </>;
}
