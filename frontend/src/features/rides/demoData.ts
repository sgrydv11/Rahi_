import type { Ride, RidePage } from './api';

const demoRides: Ride[] = [
  {
    id: 'demo-mumbai-pune', driver: { id: 'demo-driver-1', displayName: 'Aarav Mehta' },
    origin: 'Mumbai', destination: 'Pune', pickupDescription: 'Bandra West', dropoffDescription: 'Pune Station',
    departureAt: futureDeparture(1, 8), timeZone: 'Asia/Kolkata', totalSeats: 3, availableSeats: 2,
    pricePerSeat: 250, currency: 'INR', vehicleDetails: 'Blue sedan', notes: 'One small bag per passenger.',
    status: 'SCHEDULED', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null,
  },
  {
    id: 'demo-bengaluru-mysuru', driver: { id: 'demo-driver-2', displayName: 'Diya Rao' },
    origin: 'Bengaluru', destination: 'Mysuru', pickupDescription: 'Indiranagar Metro', dropoffDescription: 'Mysuru Palace',
    departureAt: futureDeparture(2, 9), timeZone: 'Asia/Kolkata', totalSeats: 4, availableSeats: 3,
    pricePerSeat: 180, currency: 'INR', vehicleDetails: 'White hatchback', notes: 'AC and music on the way.',
    status: 'SCHEDULED', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null,
  },
  {
    id: 'demo-delhi-jaipur', driver: { id: 'demo-driver-3', displayName: 'Kabir Singh' },
    origin: 'Delhi', destination: 'Jaipur', pickupDescription: 'Gurugram Cyber Hub', dropoffDescription: 'Jaipur City',
    departureAt: futureDeparture(3, 7), timeZone: 'Asia/Kolkata', totalSeats: 3, availableSeats: 1,
    pricePerSeat: 650, currency: 'INR', vehicleDetails: 'Silver SUV', notes: 'A short stop for chai on the way.',
    status: 'SCHEDULED', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null,
  },
  {
    id: 'demo-hyderabad-vijayawada', driver: { id: 'demo-driver-4', displayName: 'Mira Reddy' },
    origin: 'Hyderabad', destination: 'Vijayawada', pickupDescription: 'Hitec City', dropoffDescription: 'Benz Circle',
    departureAt: futureDeparture(4, 10), timeZone: 'Asia/Kolkata', totalSeats: 3, availableSeats: 3,
    pricePerSeat: 420, currency: 'INR', vehicleDetails: 'Grey sedan', notes: '',
    status: 'SCHEDULED', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    cancelledAt: null, cancellationReason: null,
  },
];

function futureDeparture(daysFromNow: number, hour: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
}

export function searchDemoRides(query: URLSearchParams, signal?: AbortSignal): RidePage {
  assertNotAborted(signal);
  const origin = query.get('origin')?.trim().toLocaleLowerCase();
  const destination = query.get('destination')?.trim().toLocaleLowerCase();
  const departureDate = query.get('departureDate');
  const minimumSeats = Number(query.get('minimumSeats') || 1);
  const maximumPrice = query.has('maximumPrice') ? Number(query.get('maximumPrice')) : Number.POSITIVE_INFINITY;
  const matchingRides = demoRides.filter(ride => {
    const rideDate = new Intl.DateTimeFormat('en-CA', { timeZone: ride.timeZone }).format(new Date(ride.departureAt));
    return (!origin || ride.origin.toLocaleLowerCase().startsWith(origin))
      && (!destination || ride.destination.toLocaleLowerCase().startsWith(destination))
      && (!departureDate || departureDate === rideDate)
      && ride.availableSeats >= minimumSeats
      && ride.pricePerSeat <= maximumPrice;
  });
  const size = Math.max(1, Math.min(50, Number(query.get('size')) || 10));
  const totalPages = Math.ceil(matchingRides.length / size);
  const page = Math.max(0, Math.min(totalPages - 1, Number(query.get('page')) || 0));
  return {
    content: matchingRides.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: matchingRides.length,
    totalPages,
  };
}

export function findDemoRide(id: string, signal?: AbortSignal): Ride | null {
  assertNotAborted(signal);
  return demoRides.find(ride => ride.id === id) ?? null;
}

export function demoRideCount() {
  return demoRides.length;
}
