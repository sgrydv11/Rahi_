import { useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, Copy, styles } from './ui';

export function DateField({ label, mode, value, change, clear }: {
  label: string;
  mode: 'date' | 'time';
  value?: Date;
  change: (value: Date) => void;
  clear?: () => void;
}) {
  const [pending, setPending] = useState<Date>();
  const display = value && (mode === 'date' ? value.toLocaleDateString() :
    value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }));
  function open() {
    Keyboard.dismiss();
    const initial = value ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial, mode, is24Hour: false,
        onChange: (event, selected) => { if (event.type === 'set' && selected) change(selected); },
      });
    } else {
      setPending(initial);
    }
  }
  return <View style={styles.field}>
    <Copy>{label}</Copy>
    <View style={styles.row}>
      <Button label={display ? `${label}: ${display}` : `Select ${label.toLowerCase()}`} onPress={open} />
      {clear && value && <Button label="Clear date" onPress={() => { setPending(undefined); clear(); }} />}
    </View>
    {pending && <>
      <DateTimePicker value={pending} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'}
        locale={mode === 'time' ? 'en_US' : undefined}
        onChange={(_, selected) => { if (selected) setPending(selected); }} />
      <View style={styles.row}>
        <Button label={`Confirm ${label.toLowerCase()}`} onPress={() => { change(pending); setPending(undefined); }} />
        <Button label="Cancel" onPress={() => setPending(undefined)} />
      </View>
    </>}
  </View>;
}
