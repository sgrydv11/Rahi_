export type Screen =
  | { kind: 'home' | 'search' | 'rides' | 'bookings' | 'notifications' | 'profile' | 'vehicles' | 'login' | 'register' }
  | { kind: 'ride' | 'booking' | 'manifest' | 'pins'; id: string }
  | { kind: 'rideForm' | 'vehicleForm'; id?: string };
export type Navigate = (screen: Screen) => void;
