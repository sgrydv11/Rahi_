// Run with Playwright CLI run-code on the isolated frontend at 127.0.0.1:5174.
async page => {
  const base = 'http://127.0.0.1:5174';
  if (new URL(page.url()).origin !== base) throw new Error('Open the isolated test frontend first.');
  const stamp = Date.now();
  const password = 'Local-test-only-' + stamp;
  async function post(path, body, status, token) {
    const response = await page.request.post(base + '/api/v1' + path, {
      data: body, headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    if (response.status() !== status) throw new Error(path + ' returned ' + response.status());
    return response.json();
  }
  const driver = 'driver-' + stamp + '@qa.example.test';
  const rider = 'rider-' + stamp + '@qa.example.test';
  for (const email of [driver, rider]) {
    await post('/mobile/auth/register', { email, password, fullName: 'Local Audit' }, 201);
  }
  const { accessToken } = await post('/mobile/auth/login', { email: driver, password }, 200);
  const next = new Date(Date.now() + 86400000);
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(next);
  const rides = [];
  for (const totalSeats of [1, 2]) {
    rides.push(await post('/rides', {
      origin: 'Indore', destination: 'Ujjain', departureAt: date + 'T10:00:00+05:30', timeZone: 'Asia/Kolkata',
      totalSeats, pricePerSeat: 120, currency: 'INR',
      preferences: { boardingPoints: ['Station'], droppingPoints: ['Tower'], hasCar: true, ac: true, flexibleDropoff: false, womenOnly: false, routeType: 'OTHER' },
    }, 201, accessToken));
  }
  await page.goto(base + '/rides');
  await page.getByLabel('From City', { exact: true }).fill('Indore');
  await page.getByLabel('To City', { exact: true }).fill('Ujjain');
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByLabel('Custom date').fill(date);
  await page.getByRole('combobox', { name: 'Passengers', exact: true }).selectOption('2');
  await page.getByRole('button', { name: 'Search rides', exact: true }).click();
  const card = id => page.locator('a.button[href^="/rides/' + id + '"]');
  await card(rides[1].id).waitFor();
  if (await card(rides[0].id).count()) throw new Error('One-seat ride leaked into a two-passenger search');
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('PRICE_DESC');
  await page.getByText('Filter rides', { exact: true }).click();
  await page.getByLabel('AC', { exact: true }).check();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const search = new URL(page.url()).searchParams;
  if (search.get('minimumSeats') !== '2' || search.get('ac') !== 'true' || search.get('sort') !== 'PRICE_DESC')
    throw new Error('Sorting or filters lost search criteria');
  await card(rides[1].id).click();
  await page.getByRole('button', { name: 'Book Seat', exact: true }).click();
  await page.getByRole('link', { name: 'Log in', exact: true }).last().click();
  await page.getByLabel('Email address', { exact: true }).fill(rider);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Book Seat', exact: true }).click();
  const selected = await page.getByRole('combobox', { name: 'Seats', exact: true }).inputValue();
  if (selected !== '2') throw new Error('Booking did not preserve the two-seat search after sign-in');
  await page.getByRole('group', { name: 'Passenger 2', exact: true }).waitFor();
  return 'PASS: one-seat ride excluded, sort and filters preserve two passengers, sign-in returns to a two-seat booking';
}
