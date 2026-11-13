import { Wallet } from './src/wallet';
import { GroupOffers } from './src/group';
import { Chat } from './src/chat';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { logout, onSessionInvalidated, restore, type User } from './src/api';
import { Profile, SignIn, VehicleForm, Vehicles } from './src/account';
import { BookingDetails, Bookings, Notifications } from './src/bookings';
import { demoMode } from './src/demo';
import type { Screen } from './src/navigation';
import { PinsForm, RideDetails, RideForm, Rides } from './src/rides';
import { Button, Card, colors, Copy, ErrorText, FieldFocus, styles, useAction } from './src/ui';

const titles: Record<Screen['kind'], string> = {
  chat: 'Ride community',
  group: 'Open Ride Group', wallet: 'Wallet', home: 'Share the journey.', search: 'Find a ride', rides: 'My rides', bookings: 'My bookings',
  notifications: 'Notifications', profile: 'Your profile', vehicles: 'My vehicles',
  settings: 'Account', login: 'Welcome back', register: 'Join FlexirRides', ride: 'Ride details', booking: 'Booking details',
  manifest: 'Passenger bookings', pins: 'Route pins', rideForm: 'Ride offer', vehicleForm: 'Vehicle details',
};
const publicScreens = new Set<Screen['kind']>(['home', 'search', 'ride', 'login', 'register']);
const home: Screen = { kind: 'home' };
const footer = [
  { kind: 'home', label: 'Home', icon: 'home-outline' },
  { kind: 'bookings', label: 'My Bookings', icon: 'ticket-outline' },
  { kind: 'rides', label: 'Offers', icon: 'car-outline' },
  { kind: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
  { kind: 'settings', label: 'Account', icon: 'person-outline' },
] as const;

function NativeApp() {
  const [stack, setStack] = useState<Screen[]>([home]);
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(!demoMode);
  const [restoreError, setRestoreError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  function revealField() {
    const input = TextInput.State.currentlyFocusedInput();
    const viewport = scroll.current?.getNativeScrollRef();
    if (!input || !viewport) return;
    viewport.measureInWindow((_, top, __, height) => {
      input.measureInWindow((_, inputTop, __, inputHeight) => {
        if (viewport !== scroll.current?.getNativeScrollRef() || input !== TextInput.State.currentlyFocusedInput()) return;
        const bottom = Math.min(top + height, Keyboard.metrics()?.screenY ?? Infinity);
        const below = inputTop + inputHeight + 12 - bottom;
        const above = inputTop - top - 12;
        if (below > 0 || above < 0) {
          scroll.current?.scrollTo({ y: Math.max(0, scrollOffset.current + (below > 0 ? below : above)), animated: true });
        }
      });
    });
  }
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      requestAnimationFrame(revealField);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const action = useAction();
  const screen = stack[stack.length - 1];
  const go = (next: Screen) => {
    Keyboard.dismiss();
    setStack(previous => {
      const current = previous[previous.length - 1].kind;
      if (current === next.kind && !('id' in next)) return previous;
      if (['login', 'register'].includes(current) && ['login', 'register'].includes(next.kind))
        return [...previous.slice(0, -1), next];
      return [...previous, next];
    });
  };
  const back = () => setStack(previous => previous.length > 1 ? previous.slice(0, -1) : previous);
  function signedIn(next: User) {
    setUser(next);
    setRestoreError('');
    setStack(previous => {
      const destination = previous[previous.length - 1];
      if (!publicScreens.has(destination.kind)) return previous;
      const parent = previous[previous.length - 2];
      return parent && !['home', 'login', 'register'].includes(parent.kind)
        ? previous.slice(0, -1) : [home];
    });
  }
  async function retrySession() {
    setRestoring(true);
    setRestoreError('');
    try { setUser(await restore()); }
    catch (error) { setRestoreError(error instanceof Error ? error.message : 'Unable to restore session.'); }
    finally { setRestoring(false); }
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
    if (restoring && screen.kind !== 'home' && screen.kind !== 'search') return <Copy>Restoring your session…</Copy>;
    if (!user && !publicScreens.has(screen.kind)) return <SignIn create={false} onUser={signedIn} go={go} />;
    switch (screen.kind) {
      case 'chat': return user && <Chat userId={user.id} go={go} />;
      case 'login': case 'register': return <SignIn key={screen.kind} create={screen.kind === 'register'} onUser={signedIn} go={go} />;
      case 'search': case 'rides': return <Rides mine={screen.kind === 'rides'} go={go} />;
      case 'ride': return <RideDetails id={screen.id} requestedSeats={screen.requestedSeats} user={user} go={go} />;
      case 'rideForm': return <RideForm id={screen.id} go={next => setStack(previous => [...previous.slice(0, -1), next])} />;
      case 'pins': return <PinsForm id={screen.id} back={back} />;
      case 'bookings': return <Bookings go={go} />;
      case 'manifest': return <Bookings ride={screen.id} go={go} />;
      case 'booking': return user && <BookingDetails id={screen.id} user={user} go={go} />;
      case 'wallet': return user && <Wallet userId={user.id} />;
      case 'group': return user && <GroupOffers userId={user.id} openBooking={id => go({ kind: 'booking', id })} />;
      case 'notifications': return <Notifications go={go} />;
      case 'profile': return user && <Profile user={user} onUser={setUser} go={go} />;
      case 'settings': return user && <Card>
        <Copy>{user.email}</Copy>
        <Button label="Edit profile" onPress={() => go({ kind: 'profile' })} />
        <Button label="My vehicles" onPress={() => go({ kind: 'vehicles' })} />
        <Button label="Notifications" onPress={() => go({ kind: 'notifications' })} />
        <Button label="Sign out" disabled={action.busy} onPress={() => void action.run(async () => {
          await logout(); setUser(null); setStack([home]);
        })} />
        <ErrorText message={action.error} />
      </Card>;
      case 'vehicles': return <Vehicles go={go} />;
      case 'vehicleForm': return <VehicleForm id={screen.id} back={back} />;
      default: return <>
        <Card><Copy>{demoMode ? 'Browse sample rides in the FlexirRides demo.' : 'Find and offer shared rides with FlexirRides.'}</Copy>
          {user && <Copy>Welcome, {user.fullName}.</Copy>}
          <Button label="Find a ride" onPress={() => go({ kind: 'search' })} />
        </Card>
        <Card>
          <Text accessibilityRole="header" style={styles.body}>Rentals</Text>
          <Copy>Coming soon</Copy>
          <Copy>Self-drive car and bike rentals are coming to FlexirRides.</Copy>
        </Card>
        {demoMode ? null : user ? <View style={styles.row}>
          <Button label="Offer a ride" onPress={() => go({ kind: 'rideForm' })} />
          <Button label="My rides" onPress={() => go({ kind: 'rides' })} />
          <Button label="Wallet" onPress={() => go({ kind: 'wallet' })} />
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
        <ErrorText message={action.error} />
      </>;
    }
  }
  const key = `${stack.length}-${screen.kind}-${'id' in screen ? screen.id ?? '' : ''}`;
  useEffect(() => { scrollOffset.current = 0; }, [key]);
  return <SafeAreaView style={layout.surface}>
    <StatusBar barStyle="dark-content" />
    <View style={layout.header}>
      {stack.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel="Back" style={layout.icon} onPress={back}>
        <Ionicons name="arrow-back" size={24} color={colors.accent} />
      </Pressable>}
      <View style={layout.brandGroup}>
        <Image source={require('./assets/flexirrides-icon.png')} style={layout.logo} />
        <Text accessibilityRole="header" style={layout.brand}>FlexirRides</Text>
      </View>
    </View>
    <KeyboardAvoidingView style={layout.flex} behavior="padding">
      <FieldFocus.Provider value={() => { if (Keyboard.isVisible()) requestAnimationFrame(revealField); }}>
        {screen.kind==='chat' && user?<View style={{flex:1,padding:10}}>{content()}</View>:<ScrollView ref={scroll} key={key} contentContainerStyle={layout.content} keyboardShouldPersistTaps="handled"
          onLayout={() => { if (Keyboard.isVisible()) revealField(); }}
          onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}>
          <Text accessibilityRole="header" style={styles.title}>{!user && !publicScreens.has(screen.kind) ? titles.login : titles[screen.kind]}</Text>
          {restoring && (screen.kind === 'home' || screen.kind === 'search') && <Copy>Reconnecting your account… You can browse rides while we connect.</Copy>}
          {restoreError && !restoring && <Card>
            <ErrorText message={restoreError} />
            <Button label="Reconnect session" onPress={() => void retrySession()} />
          </Card>}
          {content()}
        </ScrollView>}
      </FieldFocus.Provider>
      {!demoMode && !keyboardVisible && <View style={layout.footer}>
        {footer.map(({ kind, label, icon }) => <Pressable key={kind} accessibilityRole="tab"
          accessibilityState={{ selected: screen.kind === kind }} onPress={() => {
            Keyboard.dismiss();
            setStack(kind === 'home' ? [home] : [home, { kind }]);
          }} style={layout.tab}>
          <Ionicons name={icon} size={23} color={screen.kind === kind ? colors.accent : colors.muted} />
          <Text style={{ color: screen.kind === kind ? colors.accent : colors.muted }}>{label}</Text>
        </Pressable>)}
      </View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><NativeApp /></SafeAreaProvider>; }

const layout = StyleSheet.create({
  flex: { flex: 1 },
  surface: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 8, backgroundColor: '#fff' },
  brandGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brand: { color: colors.accent, fontSize: 24, fontWeight: '800', flexShrink: 1 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  menu: { alignSelf: 'flex-end', padding: 12, gap: 8, backgroundColor: '#fff' },
  footer: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#fff' },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 },
  content: { padding: 16, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
});
