import assert from 'node:assert/strict';
import test from 'node:test';
import { createGroupWalletClient } from '../src/groupWallet.ts';

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
