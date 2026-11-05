import { GroupOffers } from './src/group';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { logout, onSessionInvalidated, restore, type User } from './src/api';
import { Profile, SignIn, VehicleForm, Vehicles } from './src/account';
import { BookingDetails, Bookings, Notifications } from './src/bookings';
import { demoMode } from './src/demo';
import type { Screen } from './src/navigation';
import { PinsForm, RideDetails, RideForm, Rides } from './src/rides';
import { Button, Card, colors, Copy, ErrorText, styles, useAction } from './src/ui';

const titles: Record<Screen['kind'], string> = {
  group: 'Open Ride Group', home: 'Share the journey.', search: 'Find a ride', rides: 'My rides', bookings: 'My bookings',
  notifications: 'Notifications', profile: 'Your profile', vehicles: 'My vehicles',
  login: 'Welcome back', register: 'Join Hoopr', ride: 'Ride details', booking: 'Booking details',
  manifest: 'Passenger bookings', pins: 'Route pins', rideForm: 'Ride offer', vehicleForm: 'Vehicle details',
};
const publicScreens = new Set<Screen['kind']>(['home', 'search', 'ride', 'login', 'register']);
const home: Screen = { kind: 'home' };

function NativeApp() {
  const [stack, setStack] = useState<Screen[]>([home]);
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(!demoMode);
  const [restoreError, setRestoreError] = useState('');
  const action = useAction();
  const screen = stack[stack.length - 1];
  const go = (next: Screen) => setStack(previous => [...previous, next]);
  const back = () => setStack(previous => previous.length > 1 ? previous.slice(0, -1) : previous);
  function signedIn(next: User) {
    setUser(next);
    setRestoreError('');
    setStack(previous => previous.length > 1 && previous[previous.length - 2].kind === 'ride'
      ? previous.slice(0, -1) : [home]);
  }
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    onSessionInvalidated(() => { if (active) { setUser(null); setStack([home, { kind: 'login' }]); } });
    restore().then(value => { if (active) setUser(value); })
      .catch(error => { if (active) setRestoreError(error instanceof Error ? error.message : 'Unable to restore session.'); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; onSessionInvalidated(() => {}); };
  }, []);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length <= 1) return false;
      back();
      return true;
    });
    return () => listener.remove();
  }, [stack.length]);

  function content() {
    if (restoring) return <Copy>Restoring your session…</Copy>;
    if (!user && !publicScreens.has(screen.kind)) return <SignIn create={false} onUser={signedIn} go={go} />;
    switch (screen.kind) {
      case 'login': case 'register': return <SignIn create={screen.kind === 'register'} onUser={signedIn} go={go} />;
      case 'search': case 'rides': return <Rides mine={screen.kind === 'rides'} go={go} />;
      case 'ride': return <RideDetails id={screen.id} user={user} go={go} />;
      case 'rideForm': return <RideForm id={screen.id} go={next => setStack(previous => [...previous.slice(0, -1), next])} />;
      case 'pins': return <PinsForm id={screen.id} back={back} />;
      case 'bookings': return <Bookings go={go} />;
      case 'manifest': return <Bookings ride={screen.id} go={go} />;
      case 'booking': return user && <BookingDetails id={screen.id} user={user} go={go} />;
      case 'group': return user && <GroupOffers />;
      case 'notifications': return <Notifications go={go} />;
      case 'profile': return user && <Profile user={user} onUser={setUser} go={go} />;
      case 'vehicles': return <Vehicles go={go} />;
      case 'vehicleForm': return <VehicleForm id={screen.id} back={back} />;
      default: return <>
        <Card><Copy>{demoMode ? 'Browse sample rides in the Hoopr demo.' : 'Find and offer shared rides with Hoopr.'}</Copy>
          {user && <Copy>Welcome, {user.fullName}.</Copy>}
          <Button label="Find a ride" onPress={() => go({ kind: 'search' })} />
        </Card>
        {demoMode ? null : user ? <View style={styles.row}>
          <Button label="Offer a ride" onPress={() => go({ kind: 'rideForm' })} />
          <Button label="My rides" onPress={() => go({ kind: 'rides' })} />
          <Button label="Open Ride Group" onPress={() => go({ kind: 'group' })} />
          <Button label="My bookings" onPress={() => go({ kind: 'bookings' })} />
          <Button label="Notifications" onPress={() => go({ kind: 'notifications' })} />
          <Button label="Profile" onPress={() => go({ kind: 'profile' })} />
          <Button label="My vehicles" onPress={() => go({ kind: 'vehicles' })} />
          <Button label="Sign out" disabled={action.busy} onPress={() => void action.run(async () => {
            await logout(); setUser(null); setStack([home]);
          })} />
        </View> : <View style={styles.row}>
          <Button label="Sign in" onPress={() => go({ kind: 'login' })} />
          <Button label="Create account" onPress={() => go({ kind: 'register' })} />
        </View>}
        <ErrorText message={action.error || restoreError} />
      </>;
    }
  }
  const key = `${stack.length}-${screen.kind}-${'id' in screen ? screen.id ?? '' : ''}`;
  return <SafeAreaView style={layout.surface}>
    <StatusBar barStyle="dark-content" />
    <View style={layout.header}>
      {stack.length > 1 && <Button label="Back" onPress={back} />}
      <Text accessibilityRole="header" style={layout.brand}>Hoopr</Text>
      {stack.length > 1 && <Button label="Home" onPress={() => setStack([home])} />}
    </View>
    <KeyboardAvoidingView style={layout.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView key={key} contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>{titles[screen.kind]}</Text>
        {content()}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><NativeApp /></SafeAreaProvider>; }

const layout = StyleSheet.create({
  flex: { flex: 1 },
  surface: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8, backgroundColor: '#fff' },
  brand: { color: colors.accent, fontSize: 24, fontWeight: '800', flex: 1 },
  content: { padding: 16, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
