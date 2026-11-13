import { matchPath } from 'react-router';

const pages = [
  ['/', 'Share the journey', 'Find and offer shared rides with FlexirRides. Connect with drivers and passengers travelling the same way.'],
  ['/login', 'Log in', 'Sign in to FlexirRides with your email, registered mobile number or email verification code.'],
  ['/register', 'Create an account', 'Join FlexirRides and verify your email to start offering rides or booking shared seats.'],
  ['/rides', 'Find a ride', 'Search shared rides by departure city, destination and travel date. Compare available seats, prices and ride preferences.'],
  ['/rides/new', 'Offer a ride', 'Publish a shared ride with your route, departure time, seats, fare and boarding points.'],
  ['/rides/mine', 'My ride offers', 'Manage your FlexirRides offers and passenger requests.'],
  ['/rides/:id/edit', 'Edit ride', 'Update the details of your upcoming FlexirRides offer.'],
  ['/rides/:id/bookings', 'Passenger bookings', 'Review and manage passenger bookings for your ride.'],
  ['/rides/:id', 'Ride details', 'Review the route, departure, fare and available seats before booking a shared ride.'],
  ['/bookings/mine', 'My bookings', 'View your FlexirRides bookings and journey updates.'],
  ['/bookings/:id', 'Booking details', 'View your booking, boarding points, passengers and journey status.'],
  ['/profile', 'My account', 'Manage your FlexirRides profile and travel preferences.'],
  ['/vehicles', 'My vehicles', 'Add and manage the vehicles you use to offer shared rides.'],
  ['/notifications', 'Notifications', 'Read your latest booking requests and ride updates.'],
  ['/chat', 'Ride community', 'Chat with the FlexirRides community, share ride offers and reply to messages.'],
  ['/help', 'Help', 'Learn how to find, offer and book rides, manage your account and use community chat.'],
] as const;

export function pageMetadata(path: string) {
  const found=pages.find(([pattern])=>matchPath({path:pattern,end:true},path));
  return {title:`${found?.[1] ?? 'Page not found'} | FlexirRides`,
    description:found?.[2] ?? 'This FlexirRides page could not be found. Return home or search for a shared ride.',
    robots:['/','/rides','/help'].includes(path)?'index, follow':'noindex, follow'};
}
