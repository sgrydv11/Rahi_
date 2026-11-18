import {useEffect,useRef,useState} from 'react';
import {AppState,Linking} from 'react-native';
import * as Contacts from 'expo-contacts';
import {phoneKey} from './chatIdentity';
/** Phonebook names stay in process memory and are never sent to the API. */
export function useContactNames(){
 const running=useRef(false);
 const[names,setNames]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[denied,setDenied]=useState(false);
 async function load(ask=false){if(running.current)return;running.current=true;setBusy(true);try{
  let permission=await Contacts.getPermissionsAsync();if(!permission.granted&&ask&&permission.canAskAgain)permission=await Contacts.requestPermissionsAsync();
  setDenied(!permission.granted&&!permission.canAskAgain);
  if(!permission.granted){setNames({});if(ask)setMessage('Contacts access is off. Phone numbers will be shown.');return;}
  const next:Record<string,string>={};let offset=0,more=true;
  while(more){const page=await Contacts.getContactsAsync({fields:[Contacts.Fields.PhoneNumbers],pageSize:200,pageOffset:offset});for(const contact of page.data){if(!contact.name)continue;for(const number of contact.phoneNumbers||[]){const key=phoneKey(number.number);if(key&&!next[key])next[key]=contact.name;}}offset+=page.data.length;more=page.hasNextPage&&page.data.length>0;}
  setNames(next);setMessage('Saved contact names are used only on this phone.');
 }catch{setNames({});setMessage('Unable to read contacts. Phone numbers are still available.');}finally{running.current=false;setBusy(false);}}
 useEffect(()=>{void load();const listener=AppState.addEventListener('change',state=>{if(state==='active')void load();});return()=>listener.remove();},[]);
 return {names,busy,message,denied,enable:()=>denied?Linking.openSettings():load(true)};
}
