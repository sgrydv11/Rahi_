export type Screen =
  | { kind: 'home' | 'group' | 'wallet' | 'search' | 'rides' | 'bookings' | 'notifications' | 'profile' | 'settings' | 'vehicles' | 'login' | 'register' }
  | { kind: 'ride' | 'booking' | 'manifest' | 'pins'; id: string }
  | { kind: 'rideForm' | 'vehicleForm'; id?: string };
export type Navigate = (screen: Screen) => void;
