import {Text} from './Typography';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button, Copy, styles } from './ui';

export function DateField({ label, mode, value, change, clear, minimumDate }: {
  label: string;
  mode: 'date' | 'time';
  value?: Date;
  change: (value: Date) => void;
  clear?: () => void;
  minimumDate?:Date;
}) {
  const [pending, setPending] = useState<Date>();
  const display = value && (mode === 'date' ? value.toLocaleDateString() :
    value.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }));
  function open() {
    Keyboard.dismiss();
    const initial = value ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial, mode, is24Hour: false, minimumDate:mode==='date'?minimumDate:undefined,
        onChange: (event, selected) => { if (event.type === 'set' && selected) change(selected); },
      });
    } else {
      setPending(initial);
    }
  }
  return <View style={styles.field}>
    <Copy>{label}</Copy>
    <View style={styles.row}>
      {mode==='date'?<Pressable accessibilityRole="button" accessibilityLabel={display?`${label}: ${display}`:`Select ${label.toLowerCase()}`} onPress={open} style={{flexDirection:'row',alignItems:'center',gap: 12,padding:12,borderRadius:12,borderWidth:1,borderColor:'#D5DEEA',backgroundColor:'#fff'}}><Ionicons name="calendar-outline" size={23} color="#245EEA"/><Text style={{color:'#142D4E',fontWeight:'600'}}>{display||'Select travel date'}</Text></Pressable>:<Button label={display ? `${label}: ${display}` : `Select ${label.toLowerCase()}`} onPress={open} />}
      {clear && value && <Button label="Clear date" onPress={() => { setPending(undefined); clear(); }} />}
    </View>
    {pending && <>
      <DateTimePicker value={pending} mode={mode} display={mode === 'date' ? 'inline' : 'spinner'}
        minimumDate={mode==='date'?minimumDate:undefined}
        locale={mode === 'time' ? 'en_US' : undefined}
        onChange={(_, selected) => { if (selected) setPending(selected); }} />
      <View style={styles.row}>
        <Button label={`Confirm ${label.toLowerCase()}`} onPress={() => { change(pending); setPending(undefined); }} />
        <Button label="Cancel" onPress={() => setPending(undefined)} />
      </View>
    </>}
  </View>;
}
