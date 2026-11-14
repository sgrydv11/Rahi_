import {forwardRef} from 'react';
import {Text as NativeText,TextInput as NativeTextInput,StyleSheet,type TextProps,type TextInputProps} from 'react-native';
function family(style:TextProps['style']){const weight=StyleSheet.flatten(style)?.fontWeight;return Number(weight)>=700||weight==='bold'?'InterBold':Number(weight)>=500?'InterSemiBold':'Inter';}
export const Text=forwardRef<NativeText,TextProps>((props,ref)=><NativeText {...props} ref={ref} style={[props.style,{fontFamily:family(props.style),fontWeight:'normal'}]}/>);
export type TextInput=NativeTextInput;
export const TextInput=Object.assign(forwardRef<NativeTextInput,TextInputProps>((props,ref)=><NativeTextInput {...props} ref={ref} style={[props.style,{fontFamily:family(props.style),fontWeight:'normal'}]}/>),{State:NativeTextInput.State});
