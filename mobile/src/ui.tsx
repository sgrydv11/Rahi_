import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export const colors = { background: '#f2f6fc', ink: '#172b49', accent: '#2359ac', muted: '#465d7b', line: '#c8d7ec' };
export const FieldFocus = createContext(() => {});
export const styles = StyleSheet.create({
  body: { color: colors.ink, fontSize: 16, lineHeight: 23 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '700', marginBottom: 8 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { gap: 5 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: '#fff', padding: 12, color: colors.ink, fontSize: 16 },
  button: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  error: { color: '#9f251d', fontSize: 15 },
});

export function Copy({ children }: { children: ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Card({ children }: { children: ReactNode }) { return <View style={styles.card}>{children}</View>; }
export function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    <Text style={styles.buttonText}>{label}</Text>
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
    <Button key={option.value} label={option.label + (selected === option.value ? ' ✓' : '')} onPress={() => change(option.value)} />
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
