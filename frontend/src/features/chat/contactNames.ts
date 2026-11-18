import {useState} from 'react';
import {phoneKey} from './chatIdentity';
interface ContactPicker {select:(fields:string[],options:{multiple:boolean})=>Promise<{name?:string[];tel?:string[]}[]>}
export function useContactNames(){
 const[names,setNames]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const picker=typeof navigator==='undefined'?undefined:(navigator as Navigator&{contacts?:ContactPicker}).contacts;
 async function enable(){if(!picker){setMessage('Saved contact names are available in the phone app. This browser shows phone numbers.');return;}setBusy(true);try{const contacts=await picker.select(['name','tel'],{multiple:true});const next:Record<string,string>={};for(const c of contacts)for(const phone of c.tel||[]){if(c.name?.[0])next[phoneKey(phone)]=c.name[0];}setNames(n=>({...n,...next}));setMessage('Selected names stay in this browser session.');}catch{setMessage('No contacts selected. Phone numbers are shown.');}finally{setBusy(false);}}
 return {names,message,busy,enable,supported:!!picker};
}
