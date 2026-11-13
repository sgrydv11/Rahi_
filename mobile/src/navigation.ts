export type Screen =
  | { kind: 'home' | 'chat' | 'group' | 'wallet' | 'search' | 'rides' | 'bookings' | 'notifications' | 'profile' | 'settings' | 'vehicles' | 'login' | 'register' }
  | { kind: 'ride'; id: string; requestedSeats?: number }
  | { kind: 'booking' | 'manifest' | 'pins'; id: string }
  | { kind: 'rideForm' | 'vehicleForm'; id?: string };
export type Navigate = (screen: Screen) => void;
