import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.SMOKE_API_BASE_URL || 'http://127.0.0.1:8082/api/v1';
const target = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(target.hostname)) {
  throw new Error('This write-enabled smoke test requires a local test server.');
}
const run = randomUUID();
const sessions = [];
async function request(path, { token, body, key, method = 'GET' } = {}) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(20000),
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: response.status === 204 ? undefined : await response.json() };
}
async function account(label) {
  const email = `${label}.${run}@smoke.flexirrides.test`;
  const password = `Smoke!${randomUUID()}`;
  const registration = await request('/mobile/auth/register', {
    method: 'POST', body: { email, password, fullName: `Smoke ${label.replace(/[0-9]/g, '')}`, travelPreference: 'BOTH' },
  });
  assert.equal(registration.status, 201);
  const login = await request('/mobile/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200);
  sessions.push(login.data);
  return login.data;
}

try {
  assert.equal((await request('/health')).status, 200);
  const owner = await account('provider');
  const first = await account('passenger1');
  const second = await account('passenger2');
  const offered = await request('/rides', {
    token: owner.accessToken, method: 'POST', body: {
      origin: 'Indore', destination: 'Ujjain',
      departureAt: new Date(Date.now() + 86400000).toISOString(), timeZone: 'Asia/Kolkata',
      totalSeats: 1, pricePerSeat: 120, currency: 'INR', notes: `Local smoke ${run}`,
      preferences: { boardingPoints: ['Station'], droppingPoints: ['Tower'], hasCar: true, ac: true,
        flexibleDropoff: true, womenOnly: false, routeType: 'HOME_TO_OFFICE' },
    },
  });
  assert.equal(offered.status, 201);
  const ride = offered.data;
  assert.equal((await request(`/rides/${ride.id}`)).status, 200);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ride.departureAt));
  const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  const search = await request('/rides?origin=Indore&destination=Ujjain&departureDate=' + date);
  assert.equal(search.status, 200);
  assert.ok(search.data.content.some(entry => entry.id === ride.id));
  const candidates = [first, second].map(session => ({ session, key: randomUUID() }));
  const bookingBody = { seats: 1, rideVersion: ride.version, details: { boardingPoint: 'Station', droppingPoint: 'Tower',
    passengers: [{ name: 'Smoke Passenger', age: 25, gender: 'FEMALE' }] } };
  const attempts = await Promise.all(candidates.map(async candidate => ({
    ...candidate,
    result: await request(`/rides/${ride.id}/bookings`, {
      token: candidate.session.accessToken, key: candidate.key, method: 'POST',
      body: bookingBody,
    }),
  })));
  assert.deepEqual(attempts.map(attempt => attempt.result.status).sort(), [201, 409]);
  const winner = attempts.find(attempt => attempt.result.status === 201);
  const booking = winner.result.data;
  const replay = await request(`/rides/${ride.id}/bookings`, {
    token: winner.session.accessToken, key: winner.key, method: 'POST',
    body: bookingBody,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.id, booking.id);
  assert.equal((await request(`/rides/${ride.id}`)).data.availableSeats, 0);
  assert.equal((await request(`/bookings/${booking.id}`, { token: owner.accessToken })).status, 200);
  const mine = await request('/bookings/me', { token: winner.session.accessToken });
  assert.ok(mine.data.content.some(entry => entry.id === booking.id));
  const cancelled = await request(`/bookings/${booking.id}/cancel`, {
    token: winner.session.accessToken, method: 'POST', body: { reason: 'Smoke test completed' },
  });
  assert.equal(cancelled.status, 200);
  const restored = await request(`/rides/${ride.id}`);
  assert.equal(restored.data.availableSeats, 1);
  const closed = await request(`/rides/${ride.id}/cancel`, {
    token: owner.accessToken, method: 'POST', body: { version: restored.data.version, reason: 'Smoke test completed' },
  });
  assert.equal(closed.status, 200);
  console.log('PASS registration, login, publish, public search/details, last-seat race, replay, booking history, cancellation and seat restoration');
} finally {
  for (const session of sessions) {
    const result = await request('/mobile/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } });
    assert.equal(result.status, 204);
  }
}
