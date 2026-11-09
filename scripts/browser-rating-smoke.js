// Run with Playwright CLI `run-code --filename=...` on the isolated browser test server.
async page => {
  const base = 'http://127.0.0.1:5174';
  if (new URL(page.url()).origin !== base) throw new Error('Open the isolated local test frontend first.');
  const stamp = Date.now();
  const password = `Local-test-only-${stamp}`;
  const driverEmail = `driver-${stamp}@qa.example.test`;
  const riderEmail = `rider-${stamp}@qa.example.test`;
  async function api(path, { token, body, key, status = 200 } = {}) {
    const response = await page.request.fetch(`${base}/api/v1${path}`, {
      method: body ? 'POST' : 'GET', data: body,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    });
    if (response.status() !== status) throw new Error(`${path} returned ${response.status()}, expected ${status}: ${(await response.json()).detail || ''}`);
    return response.json();
  }
  async function account(email) {
    await api('/mobile/auth/register', { body: { email, password, fullName: 'Local Audit' }, status: 201 });
    return (await api('/mobile/auth/login', { body: { email, password } })).accessToken;
  }
  const driver = await account(driverEmail);
  const rider = await account(riderEmail);
  const departure = Date.now() + 30000;
  const offer = {
    origin: 'Indore', destination: 'Dewas', departureAt: new Date(departure).toISOString(), timeZone: 'Asia/Kolkata',
    totalSeats: 1, pricePerSeat: 90, currency: 'INR',
    preferences: { boardingPoints: ['Station'], droppingPoints: ['Depot'], hasCar: true, ac: true, flexibleDropoff: false, womenOnly: false, routeType: 'HOME_TO_OFFICE' },
  };
  const ride = await api('/rides', { token: driver, body: offer, status: 201 });
  const booking = await api(`/rides/${ride.id}/bookings`, {
    token: rider, key: ride.id, status: 201, body: {
      seats: 1, rideVersion: ride.version,
      details: { boardingPoint: 'Station', droppingPoint: 'Depot', passengers: [{ name: 'Audit Rider', age: 25, gender: 'FEMALE' }] },
    },
  });
  await page.goto(`${base}/login`);
  await page.getByLabel('Email address', { exact: true }).fill(riderEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('heading', { name: 'Your profile.', exact: true }).waitFor();
  await page.clock.install();
  await page.goto(`${base}/bookings/${booking.id}`);
  await page.getByText('Trip status: scheduled', { exact: true }).waitFor();
  await new Promise(resolve => setTimeout(resolve, Math.max(0, departure - Date.now() + 1000)));
  const current = await api(`/rides/${ride.id}`, { token: driver });
  const started = await api(`/rides/${ride.id}/start`, { token: driver, body: { version: current.version } });
  await api(`/rides/${ride.id}/complete`, { token: driver, body: { version: started.version } });
  await page.clock.fastForward(31000);
  await page.getByRole('dialog', { name: 'Rate your journey' }).waitFor({ timeout: 10000 });
  await page.getByRole('combobox', { name: 'Score', exact: true }).selectOption('5');
  const review = `Verified boarding instructions ${stamp}.`;
  await page.getByRole('textbox', { name: 'Review (optional, public)', exact: true }).fill(review);
  await page.getByRole('button', { name: 'Submit rating', exact: true }).click();
  await page.getByText('5 out of 5', { exact: true }).waitFor();
  const nextDeparture = new Date(Date.now() + 86400000);
  await api('/rides', { token: driver, body: { ...offer, departureAt: nextDeparture.toISOString() }, status: 201 });
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(nextDeparture);
  await page.goto(`${base}/rides?origin=Indore&destination=Dewas&departureDate=${day}&timeZone=Asia%2FKolkata&sort=RATING_DESC`);
  await page.getByText(review, { exact: false }).waitFor();
  return 'PASS: scheduled booking updated in place, rating popup opened, review saved and appeared in ride results';
}
