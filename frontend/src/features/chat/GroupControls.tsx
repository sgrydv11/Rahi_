import {Icon} from '../../app/Icon';
import {useState,useRef,useEffect} from 'react';
import {authenticatedRequest,errorMessage} from '../auth/auth';
import {useCommunity,type ChatGroup} from './Community';
interface Member {id:string;fullName:string;mobileNumber:string|null;mobilePlaceholder?:boolean;joinedAt:string}
export function GroupControls({group,onLeave}:{group?:ChatGroup;onLeave:()=>void}){
 const community=useCommunity(),[members,setMembers]=useState<Member[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(members&&!dialog.current?.open)dialog.current?.showModal();},[members]);
 async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <><button className="chat-icon-button" type="button" disabled={!group||busy} aria-label={group?.muted?'Enable group notifications':'Disable group notifications'} aria-pressed={!group?.muted} onClick={()=>void run(async()=>{await community.mute(group!.id,!group!.muted);})}><Icon name="notifications-outline"/><span className="visually-hidden">Notifications</span>{group?.muted&&<span aria-hidden="true">/</span>}</button>
 <details className="chat-group-menu"><summary aria-label="Group options">⋮</summary><div><button type="button" disabled={busy||!group} onClick={()=>void run(async()=>{setMembers(await authenticatedRequest<Member[]>(`/chat/groups/${group!.id}/members`));})}>See members</button><button type="button" disabled={busy||!group} onClick={()=>void run(async()=>{await community.mute(group!.id,!group!.muted);})}>{group?.muted?'Enable notifications':'Disable notifications'}</button><button type="button" disabled={busy||!group} onClick={()=>void run(async()=>{await authenticatedRequest(`/chat/groups/${group!.id}/membership`,{method:'POST',body:JSON.stringify({joined:false})});community.refresh();onLeave();})}>Leave group</button></div></details>
 {error&&<p className="chat-control-error" role="alert">{error}</p>}
 {members&&<dialog ref={dialog} className="chat-members-dialog" aria-label="Group members" onCancel={()=>setMembers(null)} onClose={()=>setMembers(null)}><section className="panel"><h2>Group members</h2><p>{group?.name} · {members.length} members</p><ul>{members.map(m=><li key={m.id}><strong>{m.fullName}</strong><span>{m.mobileNumber||'Phone not added'}{m.mobilePlaceholder?' · Demo placeholder':''}</span><small>Joined {new Date(m.joinedAt).toLocaleDateString('en-IN')}</small></li>)}</ul><button type="button" onClick={()=>setMembers(null)}>Close members</button></section></dialog>}</>;
}
