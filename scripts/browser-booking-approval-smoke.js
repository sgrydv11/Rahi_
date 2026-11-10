// Run with Playwright CLI run-code against the isolated test frontend.
async page => {
  const base = 'http://127.0.0.1:5174';
  if (new URL(page.url()).origin !== base) throw new Error('Use the isolated frontend.');
  const stamp = Date.now();
  const password = 'Local-test-only-' + stamp;
  const driverEmail = 'driver-' + stamp + '@qa.example.test';
  const riderEmail = 'rider-' + stamp + '@qa.example.test';
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86400000));
  async function api(path, { data, token, status = 200 } = {}) {
    const response = await page.request.fetch(base + '/api/v1' + path, {
      method: data ? 'POST' : 'GET', data, headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (response.status() !== status) throw new Error(path + ' HTTP ' + response.status());
    return response.json();
  }
  async function account(email) {
    await api('/mobile/auth/register', { data: { email, password, fullName: 'Local Audit' }, status: 201 });
    return (await api('/mobile/auth/login', { data: { email, password } })).accessToken;
  }
  async function webLogin(target, email) {
    await target.goto(base + '/login');
    await target.getByLabel('Email address', { exact: true }).fill(email);
    await target.getByLabel('Password', { exact: true }).fill(password);
    await target.getByRole('button', { name: 'Log in', exact: true }).click();
    await target.getByRole('heading', { name: 'Your profile.', exact: true }).waitFor();
  }
  const driver = await account(driverEmail);
  const rider = await account(riderEmail);
  const offer = {
    origin: 'Indore', destination: 'Ujjain', departureAt: date + 'T10:00:00+05:30', timeZone: 'Asia/Kolkata',
    totalSeats: 2, pricePerSeat: 100, currency: 'INR',
    preferences: { boardingPoints: ['Station'], droppingPoints: ['Tower'], hasCar: true, ac: true,
      flexibleDropoff: false, womenOnly: false, routeType: 'OTHER', requiresApproval: true },
  };
  const ride = await api('/rides', { data: offer, token: driver, status: 201 });
  const reverse = await api('/rides', { data: { ...offer, origin: 'Ujjain', destination: 'Indore', departureAt: date + 'T16:00:00+05:30' }, token: driver, status: 201 });
  await webLogin(page, riderEmail);
  await page.goto(base + '/rides');
  await page.getByLabel('From City', { exact: true }).fill('Indore');
  await page.getByLabel('To City', { exact: true }).fill('Ujjain');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByLabel('Custom date').fill(date);
  await page.getByLabel('Return date (optional)').fill(date);
  await page.getByRole('combobox', { name: 'Passengers', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Search rides', exact: true }).click();
  await page.getByRole('link', { name: 'Find return rides on ' + date }).click();
  await page.locator('a.button[href="/rides/' + reverse.id + '?seats=2"]').waitFor();
  await page.goBack();
  await page.locator('a.button[href="/rides/' + ride.id + '?seats=2"]').click();
  await page.getByRole('button', { name: 'Request seats', exact: true }).click();
  await page.getByRole('combobox', { name: 'Boarding point', exact: true }).selectOption('Station');
  await page.getByRole('combobox', { name: 'Dropping point', exact: true }).selectOption('Tower');
  for (const n of [1, 2]) {
    const group = page.getByRole('group', { name: 'Passenger ' + n, exact: true });
    await group.getByLabel('Name', { exact: true }).fill('Local Rider');
    await group.getByLabel('Age', { exact: true }).fill('28');
    await group.getByRole('combobox', { name: 'Gender', exact: true }).selectOption('FEMALE');
  }
  await page.getByRole('button', { name: 'Review booking', exact: true }).click();
  await page.getByRole('button', { name: 'Send request', exact: true }).click();
  await page.getByText('Awaiting driver approval. Seats are reserved only after acceptance.', { exact: true }).waitFor();
  const bookingPath = new URL(page.url()).pathname;
  if ((await api('/rides/' + ride.id)).availableSeats !== 2) throw new Error('Pending request reserved seats');
  if (!(await api('/notifications', { token: driver })).some(n => n.kind === 'BOOKING_REQUESTED' && n.link === bookingPath))
    throw new Error('Driver request notification missing');
  const context = await page.context().browser().newContext();
  try {
    const owner = await context.newPage();
    await webLogin(owner, driverEmail);
    await owner.goto(base + bookingPath);
    await owner.getByRole('button', { name: 'Accept request', exact: true }).click();
    await owner.getByText('Request accepted.', { exact: true }).waitFor();
  } finally { await context.close(); }
  if ((await api('/rides/' + ride.id)).availableSeats !== 0) throw new Error('Acceptance did not consume two seats');
  if (!(await api('/notifications', { token: rider })).some(n => n.kind === 'BOOKING_CONFIRMED' && n.link === bookingPath))
    throw new Error('Passenger confirmation notification missing');
  await page.getByRole('button', { name: 'Reload booking', exact: true }).click();
  await page.getByText('confirmed', { exact: true }).waitFor();
  return 'PASS: reverse search keeps two seats, request stays pending without reserving inventory, driver accepts and rider sees confirmation and notification';
}
