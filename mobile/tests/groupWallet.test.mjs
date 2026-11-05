import assert from 'node:assert/strict';
import test from 'node:test';
import { createGroupWalletClient, formatQuote, parseTopUpPaise } from '../src/groupWallet.ts';

function fixture() {
  const requests = [];
  const client = createGroupWalletClient(async (path, options) => {
    requests.push({ path, options });
    return { status: 'PENDING' };
  });
  return { client, requests };
}

test('encodes group filters and pagination in the request URL', async () => {
  const { client, requests } = fixture();
  await client.offers(2, ' Pune & West ', 'Mumbai');
  const url = new URL(requests[0].path, 'https://example.test');
  assert.equal(url.pathname, '/group/offers');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('origin'), 'Pune & West');
  assert.equal(url.searchParams.get('destination'), 'Mumbai');
});

test('retries use the caller idempotency key and never supply a fare', async () => {
  const { client, requests } = fixture();
  const key = 'a88f4976-fd1b-4d34-bced-216667ef3f89';
  await client.hold('ride', 2, key);
  await client.hold('ride', 2, key);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0], {
    path: '/group/holds', options: { method: 'POST', body: { rideId: 'ride', seats: 2 }, key },
  });
  await client.checkout('hold/one', 'WALLET', key);
  assert.equal(requests[2].path, '/group/holds/hold%2Fone/checkout');
  assert.deepEqual(requests[2].options.body, { method: 'WALLET' });
});

test('wallet writes send integer paise and preserve the operation key', async () => {
  const { client, requests } = fixture();
  const key = 'a88f4976-fd1b-4d34-bced-216667ef3f89';
  await client.topUp(1050, key);
  await client.withdraw(525, key);
  assert.deepEqual(requests.map(({ path, options }) => [path, options.body.amountPaise, options.key]), [
    ['/wallet/top-ups', 1050, key], ['/wallet/withdrawals', 525, key],
  ]);
  await client.syncTopUp('topup', { paymentId: 'pay_test', signature: 'fixture' });
  assert.deepEqual(requests[2].options.body, { paymentId: 'pay_test', signature: 'fixture' });
  await client.nextDiscount();
  assert.equal(requests[3].path, '/ride-discounts/next');
});

test('the initial feed omits blank filters and requests the first page', async () => {
  const { client, requests } = fixture();
  await client.offers(0, '  ', '');
  assert.deepEqual(requests, [{ path: '/group/offers?page=0&size=20', options: undefined }]);
});

test('loads and releases only the selected hold with the expected HTTP methods', async () => {
  const { client, requests } = fixture();
  await client.getHold('hold/one');
  await client.cancel('hold/one');
  assert.deepEqual(requests, [
    { path: '/group/holds/hold%2Fone', options: undefined },
    { path: '/group/holds/hold%2Fone/cancel', options: { method: 'POST' } },
  ]);
});

test('provider checkout reuses its key and sync uses the server-side order', async () => {
  const { client, requests } = fixture();
  await client.checkout('hold', 'PROVIDER', 'checkout-key');
  await client.checkout('hold', 'PROVIDER', 'checkout-key');
  await client.sync('hold');
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0].options, { method: 'POST', body: { method: 'PROVIDER' }, key: 'checkout-key' });
  assert.deepEqual(requests[2], { path: '/group/holds/hold/sync', options: { method: 'POST', body: undefined } });
});

test('converts wallet input to exact paise and rejects unsupported amounts', () => {
  assert.equal(parseTopUpPaise(' 10.01 '), 1001);
  assert.equal(parseTopUpPaise('1.1'), 110);
  assert.equal(parseTopUpPaise('10000'), 1000000);
  for (const invalid of ['', '0.99', '10000.01', '-2', '1e2', '1.001']) {
    assert.equal(parseTopUpPaise(invalid), null);
  }
});

test('checks the status of the exact withdrawal or recovered top-up', async () => {
  const { client, requests } = fixture();
  await client.withdrawal('withdrawal/one');
  await client.getTopUp('topup/one');
  assert.deepEqual(requests, [
    { path: '/wallet/withdrawals/withdrawal%2Fone', options: undefined },
    { path: '/wallet/top-ups/topup%2Fone', options: undefined },
  ]);
});

test('displays the server-quoted fare, discount and exact payable amount', () => {
  const quote = { currency: 'INR', farePaise: 12550, discountPercent: 5, discountPaise: 628, totalPaise: 11922 };
  assert.deepEqual(formatQuote(quote), { fare: 'INR 125.50', discount: '5% off (INR 6.28)', total: 'INR 119.22' });
  assert.equal(formatQuote({ ...quote, discountPercent: 0, discountPaise: 0, totalPaise: 12550 }).discount, null);
});

test('a discounted wallet booking uses the hold quote and sends no client-calculated fare', async () => {
  const calls = [];
  const quote = { farePaise: 12550, discountPercent: 5, discountPaise: 628, totalPaise: 11922, currency: 'INR' };
  const client = createGroupWalletClient(async (path, options) => {
    calls.push({ path, options });
    if (path === '/group/holds') return { id: 'hold', status: 'HELD', quote };
    return { hold: { id: 'hold', status: 'CONFIRMED', bookingId: 'booking', quote }, checkout: null };
  });
  const hold = await client.hold('ride', 1, 'hold-key');
  const result = await client.checkout(hold.id, 'WALLET', 'checkout-key');
  assert.equal(formatQuote(result.hold.quote).total, 'INR 119.22');
  assert.equal(result.hold.bookingId, 'booking');
  assert.equal(result.checkout, null);
  assert.deepEqual(calls[1], { path: '/group/holds/hold/checkout',
    options: { method: 'POST', body: { method: 'WALLET' }, key: 'checkout-key' } });
});
