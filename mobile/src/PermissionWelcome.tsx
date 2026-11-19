import {useEffect,useRef,useState} from 'react';
import {Linking,Modal,Platform,Switch,View} from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {Text} from './Typography';
import {Button,Card,Copy,ErrorText} from './ui';
import {notificationPromptKey} from './notificationOnboarding';
import {permissionWelcomeKey,requestWelcomePermissions,type PermissionChoice} from './permissionOnboarding';
export function PermissionWelcome({onNotificationsEnabled}:{onNotificationsEnabled:()=>void}){
 const[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[finished,setFinished]=useState(false),[summary,setSummary]=useState('');const[choice,setChoice]=useState<PermissionChoice>({contacts:true,notifications:true,location:true}),running=useRef(false);
 useEffect(()=>{let active=true;if(Platform.OS!=='web')void SecureStore.getItemAsync(permissionWelcomeKey).then(value=>{if(active&&!value)setVisible(true);}).catch(()=>{});return()=>{active=false;};},[]);
 async function decide(request:boolean){if(running.current)return;running.current=true;setBusy(true);setError('');try{
  await SecureStore.setItemAsync(permissionWelcomeKey,request?'requested':'later');
  if(request&&choice.notifications)await SecureStore.setItemAsync(notificationPromptKey,'requested');
  if(!request){setVisible(false);return;}
  const result=await requestWelcomePermissions(choice,async kind=>{
   if(kind==='contacts'){const p=await Contacts.getPermissionsAsync();return p.granted||(p.canAskAgain&&(await Contacts.requestPermissionsAsync()).granted);}
   if(kind==='location'){const p=await Location.getForegroundPermissionsAsync();return p.granted||(p.canAskAgain&&(await Location.requestForegroundPermissionsAsync()).granted);}
   if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('travel-updates',{name:'Messages and ride updates',importance:Notifications.AndroidImportance.HIGH});const p=await Notifications.getPermissionsAsync();return p.granted||(p.canAskAgain&&(await Notifications.requestPermissionsAsync()).granted);
  });
  if(result.notifications)onNotificationsEnabled();
  const denied=Object.entries(result).filter(([,granted])=>!granted).map(([name])=>name);
  setSummary(denied.length?'Access is off for '+denied.join(', ')+'. You can enable it later in your phone settings.':'Your selected permissions are ready.');setFinished(true);
 }catch{setError('Unable to finish permission setup. You can continue and change access later in your phone settings.');}finally{running.current=false;setBusy(false);}}
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>{if(!busy){if(finished)setVisible(false);else void decide(false);}}}><View style={{flex:1,justifyContent:'center',padding:22,backgroundColor:'#142D4E66'}}><Card><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'700'}}>Set up app access</Text>{finished?<><Copy>{summary}</Copy><Button variant="link" label="Phone settings" onPress={()=>void Linking.openSettings()}/><Button label="Continue" onPress={()=>setVisible(false)}/></>:<><Copy>Choose optional permissions. The app still works if you decline.</Copy>{([{key:'contacts',title:'Contacts',body:'Show saved contact names in chat. Names stay on your phone.'},{key:'notifications',title:'Notifications',body:'Receive new message and ride-update alerts.'},{key:'location',title:'Location',body:'Fill your nearby city when you tap the location icon. No background location.'}] as const).map(item=><View key={item.key} style={{flexDirection:'row',gap:10,alignItems:'center'}}><View style={{flex:1,gap:3}}><Text style={{fontWeight:'600'}}>{item.title}</Text><Text style={{fontSize:12,lineHeight:18,color:'#4C5E75'}}>{item.body}</Text></View><Switch accessibilityLabel={`Enable ${item.title.toLowerCase()} access`} value={choice[item.key]} disabled={busy} onValueChange={value=>setChoice(previous=>({...previous,[item.key]:value}))}/></View>)}<ErrorText message={error}/><Button label={busy?'Requesting access…':'Continue with selected access'} disabled={busy} onPress={()=>void decide(true)}/><Button variant="link" label="Not now" disabled={busy} onPress={()=>void decide(false)}/></>}</Card></View></Modal>;
}
