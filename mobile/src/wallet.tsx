import {DemoCard} from './demoWallet';
import { useRef, useState } from 'react';
import { Linking } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import RazorpayCheckout from 'react-native-razorpay';
import { groupWalletApi } from './api';
import { parseTopUpPaise, type WalletOperation } from './groupWallet';
import { Button, Card, Choice, Copy, ErrorText, Field, QueryState, date, useAction, useQuery } from './ui';

const rupees = (paise: number) => 'INR ' + (paise / 100).toFixed(2);

export function Wallet({ userId }: { userId: string }) {
  const storageKey = 'hoopr.wallet-top-up.' + userId;
  const withdrawalKey = 'hoopr.wallet-withdrawal.' + userId;
  const [provider,setProvider]=useState<'razorpay'|'stripe'>('razorpay');
  const options=useQuery('wallet-payment-options',groupWalletApi.paymentOptions);
  const [input, setInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [withdrawal, setWithdrawal] = useState<WalletOperation>();
  const recoveredWithdrawal = useQuery(withdrawalKey, async () => {
    const id = await SecureStore.getItemAsync(withdrawalKey);
    return { operation: id ? await groupWalletApi.withdrawal(id) : undefined };
  });
  const currentWithdrawal = withdrawal ?? recoveredWithdrawal.data?.operation;
  const withdrawRequest = useRef<{ amount: number; key: string } | undefined>(undefined);
  const withdrawalAction = useAction();
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const pending = useQuery(storageKey, () => SecureStore.getItemAsync(storageKey).then(id => ({ id })));
  const [topUpId, setTopUpId] = useState<string | null>();
  const activeId = topUpId === undefined ? pending.data?.id : topUpId;
  const request = useRef<{ amount: number; key: string; provider:string } | undefined>(undefined);
  const action = useAction();
  const balance = useQuery('balance', groupWalletApi.wallet);
  const history = useQuery(String(page), () => groupWalletApi.transactions(page));
  const amount = parseTopUpPaise(input);
  const withdrawalAmount = parseTopUpPaise(withdrawInput);

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
        amount: String(operation.amountPaise), currency: 'INR', name: 'FlexiRides', description: 'Test wallet top-up' });
      await sync(operation.id);
    }
  }

  return <>
    <DemoCard/><Card>
      <Copy>Provider test wallet balance</Copy>
      {balance.data ? <Copy>{rupees(balance.data.availablePaise)} available · {rupees(balance.data.reservedPaise)} reserved</Copy> :
        <QueryState error={balance.error} reload={balance.reload} />}
      <Copy>Test-mode top-ups · no real money</Copy>
      <Choice label="Payment provider" values={[{value:'razorpay',label:'Razorpay'},{value:'stripe',label:'Stripe'}]} selected={provider} change={v=>setProvider(v as 'razorpay'|'stripe')}/>
      <Copy>{provider==='razorpay'?'Razorpay test card: 4100 2800 0000 1007':'Stripe test card: 4242 4242 4242 4242'} · CVV 123 · any future expiry.</Copy>
      <Copy>Enter the test card only in the provider checkout. Card details are not stored in FlexiRides.</Copy>
      {options.data&&<Copy>{(provider==='razorpay'?options.data.razorpayEnabled:options.data.stripeEnabled)?'Test checkout configured.':'This provider needs test API keys before checkout is available.'}</Copy>}
      {!options.data&&<QueryState error={options.error} reload={options.reload}/>}

      <Field label="Amount in INR (1 to 10,000)" value={input} change={setInput} numeric />
      <Button label="Add test funds" disabled={action.busy || !!activeId || !pending.data || amount === null || !options.data || !(provider==='razorpay'?options.data.razorpayEnabled:options.data.stripeEnabled)}
        onPress={() => action.run(async () => {
          if (amount === null) return;
          if (request.current?.amount !== amount || request.current.provider!==provider) request.current = { amount, key: randomUUID(),provider };
          const { operation, checkout } = await groupWalletApi.topUp(amount, request.current.key,provider);
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
      <Copy>Sandbox withdrawal</Copy>
      <Copy>This simulates a payout from the test balance.</Copy>
      <Field label="Withdrawal amount in INR" value={withdrawInput} change={setWithdrawInput} numeric />
      <Button label="Request test withdrawal" disabled={withdrawalAction.busy || !recoveredWithdrawal.data ||
        withdrawalAmount === null || !options.data?.simulatedWithdrawalsEnabled || currentWithdrawal?.status === 'PENDING'}
        onPress={() => withdrawalAction.run(async () => {
          if (withdrawalAmount === null) return;
          if (withdrawRequest.current?.amount !== withdrawalAmount) {
            withdrawRequest.current = { amount: withdrawalAmount, key: randomUUID() };
          }
          const next = await groupWalletApi.withdraw(withdrawalAmount, withdrawRequest.current.key);
          await SecureStore.setItemAsync(withdrawalKey, next.id);
          withdrawRequest.current = undefined;
          setWithdrawal(next);
          balance.reload();
          history.reload();
        })} />
      {currentWithdrawal && <Copy>{rupees(currentWithdrawal.amountPaise)} · {currentWithdrawal.status.toLowerCase()}</Copy>}
      {currentWithdrawal?.status === 'PENDING' && <Button label="Check withdrawal status" disabled={withdrawalAction.busy}
        onPress={() => withdrawalAction.run(async () => {
          setWithdrawal(await groupWalletApi.withdrawal(currentWithdrawal.id));
          balance.reload();
          history.reload();
        })} />}
      <ErrorText message={withdrawalAction.error || recoveredWithdrawal.error} />
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
