import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { api, type Booking, type Notice, type Page, type Payment, type User } from './api';
import type { Navigate } from './navigation';
import { Pagination, Route } from './rides';
import { Button, Card, Copy, date, ErrorText, Field, labelStatus, QueryState, styles, useAction, useQuery } from './ui';

export function Bookings({ ride, go }: { ride?: string; go: Navigate }) {
  const [page, setPage] = useState(0);
  const path = (ride ? `/rides/${encodeURIComponent(ride)}/bookings` : '/bookings/me') + `?page=${page}&size=10`;
  const result = useQuery(path, () => api<Page<Booking>>(path));
  if (!result.data) return <QueryState {...result} />;
  return <>
    {!result.data.content.length && <Copy>No bookings yet.</Copy>}
    {result.data.content.map(booking => <Card key={booking.id}>
      <Copy>{booking.ride.origin} → {booking.ride.destination}</Copy>
      <Copy>{date(booking.ride.departureAt)} · {labelStatus(booking.status)}</Copy>
      {ride && <Copy>Passenger: {booking.passenger.displayName}</Copy>}
      <Button label="View booking" onPress={() => go({ kind: 'booking', id: booking.id })} />
    </Card>)}
    <Pagination data={result.data} setPage={setPage} />
  </>;
}

function PaymentPanel({ booking }: { booking: Booking }) {
  const path = `/bookings/${encodeURIComponent(booking.id)}/payment`;
  const result = useQuery(path + booking.status, () => api<Payment>(path));
  const action = useAction();
  if (!result.data) return <QueryState {...result} />;
  const payment = result.data;
  function update(kind: 'sync' | 'refund') {
    void action.run(async () => {
      await api(`${path}/${kind}`, { method: 'POST' });
      result.reload();
    });
  }
  function checkout() {
    void action.run(async () => {
      const order = await api<Payment>(`${path}/order`, { method: 'POST' });
      try {
        if (order.paymentId) return;
        if (order.provider === 'stripe') {
          const url = new URL(order.checkoutUrl ?? '');
          if (url.origin !== 'https://checkout.stripe.com') throw new Error('Invalid Stripe Checkout address.');
          await Linking.openURL(url.toString());
          return;
        }
        if (!order.keyId?.startsWith('rzp_test_') || !order.orderId) throw new Error('Test checkout is unavailable.');
        const completed = await RazorpayCheckout.open({
          key: order.keyId, order_id: order.orderId, amount: String(order.amount), currency: order.currency,
          name: 'Hoopr', description: 'Test ride fare',
        });
        await api(`${path}/verify`, { method: 'POST', body: {
          paymentId: completed.razorpay_payment_id, signature: completed.razorpay_signature,
        } });
      } finally {
        result.reload();
      }
    });
  }
  return <Card>
    <Copy>Fare payment · {payment.provider === 'stripe' ? 'Stripe' : 'Razorpay'} test mode</Copy>
    {!payment.enabled && <Copy>Test checkout is unavailable.</Copy>}
    {payment.amount === 0 && <Copy>This booking has no fare.</Copy>}
    {payment.enabled && payment.amount > 0 && (payment.currency !== 'INR' || payment.amount < 100) &&
      <Copy>Test checkout supports INR fares of at least ₹1.</Copy>}
    {payment.paymentId && <>
      <Copy>Receipt: {payment.currency} {(payment.amount / 100).toFixed(2)}</Copy>
      <Copy>Payment reference: {payment.paymentId}</Copy>
      {payment.paidAt && <Copy>Confirmed: {date(payment.paidAt)}</Copy>}
    </>}
    {payment.refundId && <Copy>Refund {payment.refundStatus}: {payment.refundId}</Copy>}
    {payment.orderId && !payment.paymentId && payment.provider === 'stripe' &&
      <Copy>After hosted checkout, return here and check payment status.</Copy>}
    <ErrorText message={action.error} />
    {payment.canPay && <Button label="Pay test fare" disabled={action.busy} onPress={checkout} />}
    {payment.canRefund && <Button label="Request test refund" disabled={action.busy} onPress={() =>
      Alert.alert('Request a test refund?', 'The full captured test fare will be refunded.', [
        { text: 'Back', style: 'cancel' }, { text: 'Request refund', onPress: () => update('refund') },
      ])} />}
    {payment.enabled && payment.orderId && (!payment.paymentId || payment.refundStatus === 'pending') &&
      <Button label="Check payment status" disabled={action.busy} onPress={() => update('sync')} />}
  </Card>;
}

export function BookingDetails({ id, user, go }: { id: string; user: User; go: Navigate }) {
  const path = `/bookings/${encodeURIComponent(id)}`;
  const result = useQuery(path, () => api<Booking>(path));
  const action = useAction();
  const [reason, setReason] = useState('');
  const [score, setScore] = useState(0);
  if (!result.data) return <QueryState {...result} />;
  const booking = result.data;
  const passenger = user.id === booking.passenger.id;
  function submit(kind: 'cancel' | 'rating') {
    void action.run(async () => {
      await api(`${path}/${kind}`, { method: 'POST', body: kind === 'cancel' ? { reason } : { score } });
      result.reload();
    });
  }
  return <>
    <Card>
      <Copy>{booking.ride.origin} → {booking.ride.destination}</Copy>
      <Copy>Departure: {date(booking.ride.departureAt)}</Copy>
      <Copy>Trip status: {labelStatus(booking.ride.status)}</Copy>
      <Copy>Booking: {labelStatus(booking.status)} · {booking.seats} seat(s)</Copy>
      <Copy>Fare: {booking.currency} {booking.totalPrice}</Copy>
      {booking.cancellationReason && <Copy>Cancellation: {booking.cancellationReason}</Copy>}
      {booking.rating && <Copy>Driver rating: {booking.rating.score} / 5</Copy>}
      <Button label="View ride" onPress={() => go({ kind: 'ride', id: booking.ride.id })} />
    </Card>
    {booking.ride.route && <Route pins={booking.ride.route} />}
    <ErrorText message={action.error} />
    {passenger && booking.canCancel && <Card>
      <Field label="Cancellation reason (optional)" value={reason} change={setReason} />
      <Button label="Cancel booking" disabled={action.busy} onPress={() =>
        Alert.alert('Cancel your booking?', 'Your seats will be released.', [
          { text: 'Keep booking', style: 'cancel' }, { text: 'Cancel booking', style: 'destructive', onPress: () => submit('cancel') },
        ])} />
    </Card>}
    {passenger && !booking.rating && booking.status === 'CONFIRMED' && booking.ride.status === 'COMPLETED' && <Card>
      <Copy>Rate your driver</Copy><View style={styles.row}>{[1, 2, 3, 4, 5].map(value =>
        <Button key={value} label={value === score ? `${value} ✓` : String(value)} onPress={() => setScore(value)} />)}</View>
      <Button label="Submit rating" disabled={!score || action.busy} onPress={() => submit('rating')} />
    </Card>}
    {passenger && <PaymentPanel booking={booking} />}
    <Button label="Refresh booking" disabled={action.busy} onPress={result.reload} />
  </>;
}

export function Notifications({ go }: { go: Navigate }) {
  const result = useQuery('notices', () => api<Notice[]>('/notifications'));
  return <>
    <Button label="Refresh notifications" onPress={result.reload} />
    {!result.data ? <QueryState {...result} /> : !result.data.length ? <Copy>No notifications yet.</Copy> :
      result.data.map(notice => {
        const match = /^\/(bookings|rides)\/([a-f0-9-]+)$/i.exec(notice.link);
        return <Card key={notice.id}><Copy>{labelStatus(notice.kind)}</Copy>
          <Copy>{notice.origin} → {notice.destination}</Copy><Copy>{date(notice.time)}</Copy>
          {match && <Button label="View details" onPress={() => go({
            kind: match[1] === 'bookings' ? 'booking' : 'ride', id: match[2],
          })} />}
        </Card>;
      })}
  </>;
}
