import {Card,Copy} from './ui';
import {Text} from './Typography';

export function Wallet(_props:{userId:string}){
 return <Card><Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700'}}>Wallet</Text><Text style={{fontSize:18,fontWeight:'600'}}>Coming soon</Text><Copy>Wallet features will be available in a future update.</Copy></Card>;
}
