import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Linking,Platform,Modal,View} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import {randomUUID} from 'expo-crypto';
import {api} from './api';
import {notificationScreen} from './notificationLinks';
import type {Navigate} from './navigation';
import {Button,Card,Copy,ErrorText} from './ui';
import {notificationPromptKey,shouldOfferNotifications,decideNotifications,canRegisterNotifications} from './notificationOnboarding';
export function NotificationWelcome({onEnabled}:{onEnabled:()=>void}){
 const[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef(false),callback=useRef(onEnabled);callback.current=onEnabled;
 useEffect(()=>{let cancelled=false;if(Platform.OS==='web')return;Promise.all([Notifications.getPermissionsAsync(),SecureStore.getItemAsync(notificationPromptKey)]).then(([permission,decision])=>{if(!cancelled)setVisible(shouldOfferNotifications(permission,decision));}).catch(()=>{/* Settings remain available if permission inspection fails. */});return()=>{cancelled=true;};},[]);
 async function decide(enable:boolean){if(active.current)return;active.current=true;setBusy(true);setError('');try{const permission=await decideNotifications(enable,{save:value=>SecureStore.setItemAsync(notificationPromptKey,value),channel:async()=>{if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('travel-updates',{name:'Messages and ride updates',importance:Notifications.AndroidImportance.HIGH});},request:async()=>{const permission=await Notifications.getPermissionsAsync();return permission.granted?permission:Notifications.requestPermissionsAsync();}});setVisible(false);if(permission?.granted)callback.current();}catch{setError('Unable to request notifications. Try again or choose Not now. You can enable them later in Account.');}finally{active.current=false;setBusy(false);}}
 return <Modal visible={visible} transparent animationType="fade" onRequestClose={()=>{if(!busy)void decide(false);}}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'rgba(20,45,78,0.45)'}}><Card><Copy>Stay updated on your journey</Copy><Copy>Allow FlexiRides to notify you about new chat messages, booking requests and ride updates. You can change this later in Account or your phone settings.</Copy><ErrorText message={error}/><Button label="Enable notifications" disabled={busy} onPress={()=>void decide(true)}/><Button label="Not now" variant="secondary" disabled={busy} onPress={()=>void decide(false)}/></Card></View></Modal>;
}
// The foreground community banner handles open-app alerts. OS displays background alerts.
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:true})});
const installKey='flexir.push.installation.v1';
async function installation(){let id=await SecureStore.getItemAsync(installKey);if(!id){id=randomUUID();await SecureStore.setItemAsync(installKey,id);}return id;}
export async function disablePhonePush(){const id=await SecureStore.getItemAsync(installKey);if(id)await api(`/push/devices/${id}/disable`,{method:'POST'});}
export function usePhonePush(userId:string|undefined,go:Navigate,unread=0){
 const[status,setStatus]=useState(''),[error,setError]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[denied,setDenied]=useState(false),[configured,setConfigured]=useState(false);
 const user=useRef(userId);user.current=userId;const navigating=useRef(go);navigating.current=go;const running=useRef<string|undefined>(undefined),generation=useRef(0);const lastResponse=useRef<string|undefined>(undefined);
 const nativeReady=Platform.OS==='ios'||Constants.expoConfig?.extra?.pushConfigured===true;
 const enable=useCallback(async(ask=true)=>{
  if(!userId||running.current===userId)return;running.current=userId;const version=generation.current;setBusy(true);setError('');
  try{
   const config=await api<{enabled:boolean}>('/push/config');if(user.current!==userId||generation.current!==version)return;setConfigured(config.enabled&&nativeReady);
   if(!config.enabled||!nativeReady){setStatus('Phone notifications are not available yet. In-app alerts remain available.');return;}
   const decision=await SecureStore.getItemAsync(notificationPromptKey);
   if(!canRegisterNotifications(ask,decision)){const id=await SecureStore.getItemAsync(installKey);if(id)await api(`/push/devices/${id}/disable`,{method:'POST'});setEnabled(false);setStatus('Phone notifications are optional. Enable them in Account when ready.');return;}
   if(ask)await SecureStore.setItemAsync(notificationPromptKey,'requested');
   if(!Device.isDevice)throw new Error('Phone push requires a physical device.');
   if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('travel-updates',{name:'Messages and ride updates',importance:Notifications.AndroidImportance.HIGH});
   let permission=await Notifications.getPermissionsAsync();if(!permission.granted&&ask&&permission.canAskAgain)permission=await Notifications.requestPermissionsAsync();
   if(user.current!==userId||generation.current!==version)return;setDenied(!permission.granted&&!permission.canAskAgain);
   if(!permission.granted){const id=await SecureStore.getItemAsync(installKey);if(id)await api(`/push/devices/${id}/disable`,{method:'POST'});setEnabled(false);setStatus('Phone notifications are off. Enable them for new messages and ride updates.');return;}
   const projectId=Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;if(!projectId)throw new Error('Notification project configuration is missing.');
   const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
   if(user.current!==userId||generation.current!==version)return;
   await api('/push/devices',{method:'POST',body:{installationId:await installation(),token,platform:Platform.OS}});
   if(user.current!==userId||generation.current!==version)return;setEnabled(true);setStatus('Phone notifications enabled.');
  }catch(e){if(user.current===userId&&generation.current===version)setError(e instanceof Error?e.message:'Unable to enable notifications.');}finally{if(running.current===userId)running.current=undefined;if(generation.current===version)setBusy(false);}
 },[userId,nativeReady]);
 useEffect(()=>{void Notifications.setBadgeCountAsync(userId?unread:0).catch(()=>{});},[userId,unread]);
 useEffect(()=>{generation.current++;setEnabled(false);setError('');setStatus('');setBusy(false);if(!userId)return;
  void enable(false);const subscription=AppState.addEventListener('change',s=>{if(s==='active')void enable(false);});return()=>{generation.current++;subscription.remove();};
 },[userId,enable]);
 useEffect(()=>{if(!userId)return;
  const respond=(response:Notifications.NotificationResponse)=>{const id=response.notification.request.identifier;if(lastResponse.current===id)return;lastResponse.current=id;const next=notificationScreen(response.notification.request.content.data.link);if(next)navigating.current(next);void Notifications.clearLastNotificationResponseAsync().catch(()=>{});};
  const subscription=Notifications.addNotificationResponseReceivedListener(respond);void Notifications.getLastNotificationResponseAsync().then(r=>{if(r&&user.current===userId)respond(r);}).catch(()=>{});
  const tokenUpdate=Notifications.addPushTokenListener(()=>void enable(false));return()=>{subscription.remove();tokenUpdate.remove();};
 },[userId,enable]);
 return{status,error,enabled,busy,denied,configured,enable,openSettings:()=>void Linking.openSettings()};
}
export function PhonePushSettings({state}:{state:ReturnType<typeof usePhonePush>}){return <Card><Copy>Phone notifications</Copy><Copy>{state.status||'Enable alerts for new messages and ride updates.'}</Copy><ErrorText message={state.error}/>{state.denied?<Button label="Open notification settings" onPress={state.openSettings}/>:<Button label={!state.configured?'Check notification availability':state.enabled?'Refresh phone notifications':'Enable phone notifications'} disabled={state.busy} onPress={()=>void state.enable(true)}/>}</Card>;}
