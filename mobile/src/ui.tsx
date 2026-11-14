import {Ionicons} from '@expo/vector-icons';
import {Text,TextInput} from './Typography';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

export const colors = { background: '#F7F9FC', ink: '#142D4E', accent: '#245EEA', muted: '#4C5E75', line: '#D5DEEA' };
export const FieldFocus = createContext(() => {});
export const styles = StyleSheet.create({
  body: { color: colors.ink, fontSize: 16, lineHeight: 26 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '700', lineHeight: 40, letterSpacing: -1, marginBottom: 16 },
  card: { padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  field: { gap: 8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#fff', padding: 16, minHeight: 52, color: colors.ink, fontSize: 16 },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign:'center' },
  error: { color: '#B42336', fontSize: 15 },
});

export function Copy({ children }: { children: ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Button({ label, onPress, disabled = false, selected, variant='primary' }: { label: string; onPress: () => void; disabled?: boolean; selected?:boolean; variant?:'primary'|'secondary' }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled,selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, {borderWidth:1,borderColor:variant==='secondary'?colors.line:colors.accent,backgroundColor:variant==='secondary'?'#fff':colors.accent,flexDirection:'row',alignItems:'center',gap:8}, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={[styles.buttonText,variant==='secondary'?{color:colors.accent}:{}]}>{label}</Text>{selected&&<Ionicons name="checkmark-outline" size={18} color={variant==='secondary'?colors.accent:'#fff'}/>}
  </Pressable>;
}
export function Field({ label, value, change, secret, numeric, multiline, trailing }: {
  label: string; value: string; change: (value: string) => void; secret?: boolean; numeric?: boolean; multiline?: boolean; trailing?:ReactNode;
}) {
  const onFocus = useContext(FieldFocus);
  return <View style={styles.field}><Copy>{label}</Copy><View><TextInput accessibilityLabel={label} value={value}
    onFocus={onFocus}
    onChangeText={change} secureTextEntry={secret} keyboardType={numeric ? 'numbers-and-punctuation' : 'default'} multiline={multiline}
    autoCapitalize="none" autoCorrect={false} style={[styles.input,trailing?{paddingRight:56}:{}]} />{trailing&&<View style={{position:'absolute',right:2,top:0,bottom:0,justifyContent:'center'}}>{trailing}</View>}</View></View>;
}
export function ErrorText({ message }: { message?: string }) {
  return message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null;
}
export function Choice({ label, values, selected, change }: {
  label: string; values: { value: string; label: string }[]; selected: string; change: (value: string) => void;
}) {
  return <View style={styles.field}><Copy>{label}</Copy><View style={styles.row}>{values.map(option =>
    <Button key={option.value} label={option.label} selected={selected===option.value} variant={selected===option.value?'primary':'secondary'} onPress={() => change(option.value)} />
  )}</View></View>;
}
export function useAction() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to complete the request.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return { busy, error, run };
}
export function useQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setResult({});
    load(controller.signal).then(data => { if (active) setResult({ data }); }).catch(error => {
      if (active) setResult({ error: error instanceof Error ? error.message : 'Unable to load.' });
    });
    return () => { active = false; controller.abort(); };
  }, [key, version]);
  return { ...result, reload: () => setVersion(value => value + 1) };
}
export function QueryState({ error, reload }: { error?: string; reload: () => void }) {
  return error ? <Card><ErrorText message={error} /><Button label="Retry" onPress={reload} /></Card> :
    <View style={styles.field}>
      <ActivityIndicator accessibilityLabel="Loading" color={colors.accent} />
      <Copy>Loading…</Copy>
    </View>;
}
export const labelStatus = (value: string) => value.replace(/_/g, ' ').toLowerCase();
export const date = (value: string) => new Date(value).toLocaleString(undefined, { hour12: true });
