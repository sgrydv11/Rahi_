import { useEffect, useState } from 'react';
import { authenticatedRequest, errorMessage } from '../auth/auth';
import { ApiError } from '../../lib/api/client';
import type { Booking } from './api';

interface Payment {
  provider: 'stripe' | 'razorpay';
  checkoutUrl: string | null;
  enabled: boolean;
  canPay: boolean;
  canRefund: boolean;
  amount: number;
  currency: string;
  keyId: string | null;
  orderId: string | null;
  paymentId: string | null;
  paidAt: string | null;
  refundId: string | null;
  refundStatus: 'pending' | 'processed' | 'failed' | null;
}
interface CheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (result: { razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal: { ondismiss: () => void };
}
type Checkout = new (options: CheckoutOptions) => { open: () => void };
let checkoutLoad: Promise<Checkout> | undefined;
function loadCheckout() {
  checkoutLoad ??= new Promise<Checkout>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      const checkout = (window as Window & { Razorpay?: Checkout }).Razorpay;
      if (checkout) resolve(checkout);
      else { script.remove(); reject(new Error('Razorpay checkout did not load.')); }
    };
    script.onerror = () => { script.remove(); reject(new Error('Razorpay checkout could not be loaded.')); };
    document.head.append(script);
  }).catch(failure => { checkoutLoad = undefined; throw failure; });
  return checkoutLoad;
}

export function BookingPayment({ booking }: { booking: Booking }) {
  const [payment, setPayment] = useState<Payment>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/bookings/${encodeURIComponent(booking.id)}/payment`;
  useEffect(() => {
    const controller = new AbortController();
    authenticatedRequest<Payment>(path, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setPayment(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [path, booking.status]);

  const post = (action: string, body?: object) => authenticatedRequest<Payment>(`${path}/${action}`, {
    method: 'POST', body: body ? JSON.stringify(body) : undefined,
  });
  async function update(action: 'sync' | 'refund' | 'verify', body?: object) {
    setBusy(true);
    setError('');
    try { setPayment(await post(action, body)); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function checkout() {
    setBusy(true);
    setError('');
    try {
      const order = await post('order');
      setPayment(order);
      if (order.paymentId) { setBusy(false); return; }
      if (order.provider === 'stripe') {
        if (!order.checkoutUrl) throw new Error('Stripe Checkout is unavailable.');
        const url = new URL(order.checkoutUrl);
        if (url.origin !== 'https://checkout.stripe.com') throw new Error('Invalid Stripe Checkout address.');
        window.location.assign(url);
        return;
      }
      if (!order.keyId?.startsWith('rzp_test_') || !order.orderId) throw new Error('Razorpay test checkout is unavailable.');
      const Razorpay = await loadCheckout();
      let verifying = false;
      new Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: 'Hoopr', description: 'Test ride fare',
        handler: result => {
          verifying = true;
          void update('verify', { paymentId: result.razorpay_payment_id, signature: result.razorpay_signature });
        },
        modal: { ondismiss: () => { if (!verifying) setBusy(false); } },
      }).open();
    } catch (failure) {
      setError(failure instanceof Error && !(failure instanceof ApiError) ? failure.message : errorMessage(failure));
      setBusy(false);
    }
  }

  return <section className="panel">
    <h2>Fare payment</h2>
    {error && <p role="alert">{error}</p>}
    {!payment ? !error && <p role="status">Loading payment status…</p> : <>
      {!payment.enabled && <p>{payment.provider === 'stripe' ? 'Stripe' : 'Razorpay'} test checkout is unavailable.</p>}
      {payment.enabled && <p>{payment.provider === 'stripe' ? 'Stripe' : 'Razorpay'} test mode.</p>}
      {payment.amount === 0 && <p>This booking has no fare to pay.</p>}
      {payment.enabled && payment.amount > 0 && (payment.currency !== 'INR' || payment.amount < 100) &&
        <p>Test checkout supports INR fares of at least ₹1.</p>}
      {payment.paymentId && <dl>
        <dt>Receipt amount</dt><dd>{payment.currency} {(payment.amount / 100).toFixed(2)}</dd>
        <dt>Payment reference</dt><dd>{payment.paymentId}</dd>
        {payment.paidAt && <><dt>Confirmed</dt><dd>{new Date(payment.paidAt).toLocaleString()}</dd></>}
      </dl>}
      {payment.refundId && <p>Refund {payment.refundStatus}: {payment.refundId}</p>}
      <div className="ride-actions">
        {payment.canPay && <button className="button" disabled={busy} onClick={() => void checkout()}>Pay test fare</button>}
        {payment.canRefund && <button className="button" disabled={busy} onClick={() => void update('refund')}>Request test refund</button>}
        {payment.enabled && payment.orderId && (!payment.paymentId || payment.refundStatus === 'pending') &&
          <button className="button button-secondary" disabled={busy} onClick={() => void update('sync')}>Check payment status</button>}
      </div>
      {busy && <p role="status">Waiting for the payment provider…</p>}
    </>}
  </section>;
}
