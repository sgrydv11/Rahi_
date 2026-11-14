import { createContext,useCallback,useContext,useEffect,useRef,useState } from 'react';
import { authenticatedRequest } from '../auth/auth';
export interface ChatGroup {id:number;name:string;muted:boolean;unreadCount:number;latest:null|{id:number;senderName:string;body:string}}
interface Toast {id:string;title:string;body:string;link:string}
export function useCommunityState(user?:string,activeGroup?:number){
 const[groups,setGroups]=useState<ChatGroup[]>([]),[toast,setToast]=useState<Toast|null>(null),[error,setError]=useState('');
 const mutations=useRef(new Map<number,boolean>());
 const active=useRef(activeGroup);active.current=activeGroup;const pollRef=useRef<(()=>Promise<void>)|null>(null);
 const refresh=useCallback(()=>{void pollRef.current?.();},[]);
 useEffect(()=>{setGroups([]);setToast(null);setError('');if(!user)return;let alive=true,running=false,initialized=false,ticks=0;const seen=new Map<number,number>(),notices=new Set<string>(),c=new AbortController();
  async function poll(){if(running||document.visibilityState==='hidden')return;running=true;try{
   const received=await authenticatedRequest<ChatGroup[]>('/chat/groups',{signal:c.signal});if(!alive)return;const next=received.map(g=>mutations.current.has(g.id)?{...g,muted:mutations.current.get(g.id)!}:g);
   let alert:Toast|null=null;for(const g of next){if(initialized&&g.latest&&g.latest.id>(seen.get(g.id)||0)&&g.unreadCount&&!g.muted&&active.current!==g.id)alert={id:'chat:'+g.latest.id,title:g.name,body:g.latest.senderName+': '+g.latest.body.slice(0,160),link:'/chat?group='+g.id};seen.set(g.id,g.latest?.id||seen.get(g.id)||0);}
   setGroups(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);setError('');if(alert)setToast(alert);
   if(ticks++%5===0){const list=await authenticatedRequest<{id:string;kind:string;origin:string;destination:string;link:string}[]>('/notifications',{signal:c.signal});if(!alive)return;for(const n of list){if(initialized&&!notices.has(n.id)&&n.kind.startsWith('TRAVEL_')&&!alert)setToast({id:n.id,title:n.kind==='TRAVEL_RIDE'?'Ride on your regular route':'Travel buddy available',body:n.origin+' → '+n.destination,link:n.link});notices.add(n.id);}}
   initialized=true;
  }catch{if(alive)setError('Chat updates are unavailable. Retrying…');}finally{running=false;}}
  pollRef.current=poll;void poll();const timer=setInterval(()=>void poll(),3000);const visible=()=>void poll();document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;pollRef.current=null;c.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[user]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),7000);return()=>clearTimeout(timer);},[toast]);
 async function mute(id:number,muted:boolean){if(mutations.current.has(id))return;const old=groups.find(g=>g.id===id)?.muted||false;mutations.current.set(id,muted);setGroups(prev=>prev.map(g=>g.id===id?{...g,muted}:g));try{await authenticatedRequest(`/chat/groups/${id}/settings`,{method:'POST',body:JSON.stringify({muted})});mutations.current.delete(id);setGroups(prev=>[...prev]);refresh();}catch(e){mutations.current.delete(id);setGroups(prev=>prev.map(g=>g.id===id?{...g,muted:old}:g));throw e;}}
 return {groups,toast,mute,muting:[...mutations.current.keys()],dismiss:()=>setToast(null),refresh,error,unread:groups.filter(g=>!g.muted).reduce((n,g)=>n+g.unreadCount,0)};
}
export type CommunityState=ReturnType<typeof useCommunityState>;
export const CommunityContext=createContext<CommunityState|null>(null);
export function useCommunity(){const c=useContext(CommunityContext);if(!c)throw Error('Community context missing');return c;}
export function chatDay(value:string,now=new Date()){
 const day=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(date);
 const date=new Date(value);if(day(date)===day(now))return 'Today';if(day(date)===day(new Date(now.getTime()-86400000)))return 'Yesterday';
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'}).format(date);
}
