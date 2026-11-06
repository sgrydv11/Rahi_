import type { Page, Ride } from './api';

export const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
const routes = [
  { id: 'demo-mumbai-pune', origin: 'Mumbai', destination: 'Pune', name: 'Aarav Mehta', price: 250, seats: 2 },
  { id: 'demo-bengaluru-mysuru', origin: 'Bengaluru', destination: 'Mysuru', name: 'Diya Rao', price: 180, seats: 3 },
  { id: 'demo-delhi-jaipur', origin: 'Delhi', destination: 'Jaipur', name: 'Kabir Singh', price: 650, seats: 1 },
  { id: 'demo-hyderabad-vijayawada', origin: 'Hyderabad', destination: 'Vijayawada', name: 'Mira Reddy', price: 420, seats: 3 },
];
const rides: Ride[] = routes.map((route, index) => ({
  id: route.id, origin: route.origin, destination: route.destination,
  driver: { id: `demo-driver-${index}`, displayName: route.name },
  departureAt: new Date(Date.now() + (index + 1) * 86_400_000).toISOString(), timeZone: 'Asia/Kolkata',
  status: 'SCHEDULED', totalSeats: 4, availableSeats: route.seats, currency: 'INR', pricePerSeat: route.price,
  version: 0, canStart: false,
}));

export function demoRide(id: string) {
  const ride = rides.find(entry => entry.id === id);
  if (!ride) throw new Error('Sample ride not found.');
  return ride;
}

export function demoRides(query: string, page: number): Page<Ride> {
  const filters = new URLSearchParams(query);
  const origin = filters.get('origin')?.toLowerCase();
  const destination = filters.get('destination')?.toLowerCase();
  const date = filters.get('departureDate');
  const minimum = Number(filters.get('minimumSeats') || 1);
  const maximum = Number(filters.get('maximumPrice') || Infinity);
  const matching = rides.filter(ride => {
    if (origin && !ride.origin.toLowerCase().startsWith(origin)) return false;
    if (destination && !ride.destination.toLowerCase().startsWith(destination)) return false;
    if (ride.availableSeats < minimum || ride.pricePerSeat > maximum) return false;
    if (!date) return true;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: filters.get('timeZone') || ride.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(ride.departureAt));
    const component = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
    return date === `${component('year')}-${component('month')}-${component('day')}`;
  });
  return { content: matching.slice(page * 10, (page + 1) * 10), page, totalPages: Math.ceil(matching.length / 10) };
}
