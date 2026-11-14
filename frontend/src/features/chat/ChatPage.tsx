import {Icon} from '../../app/Icon';
import { Fragment,useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authenticatedRequest, errorMessage } from '../auth/auth';
import { useAuth } from '../auth/AuthContext';
import { ridesApi, type Ride } from '../rides/api';

import { useSearchParams } from 'react-router';
import { useCommunity,chatDay } from './Community';
import { SwipeReply } from './SwipeReply';
interface Reply {id:number;senderId:string;senderName:string;body:string}
interface Message {
  groupId:number;
  replyTo:Reply|null; member:{fullName:string;travelPreference:string;memberSince:string};
  phoneShared:boolean; mobileNumber:string|null; mobileVerified:boolean;
  id: number; senderId: string; senderName: string; body: string; createdAt: string;
  ride: null | { id: string; origin: string; destination: string; departureAt: string; timeZone: string;
    availableSeats: number; pricePerSeat: number; currency: string; status: string };
}
const when = (value: string, timeZone = 'Asia/Kolkata') => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium', timeStyle: 'short', hour12: true, timeZone,
}).format(new Date(value));

export function ChatPage() {
 const {user}=useAuth(),community=useCommunity();const[params,setParams]=useSearchParams();const groupId=Math.max(1,Number(params.get('group'))||1);
 const selected=useRef(groupId);selected.current=groupId;
 const[messages,setMessages]=useState<Message[]>([]),[offers,setOffers]=useState<Ride[]>([]),[error,setError]=useState(''),[feedError,setFeedError]=useState(''),[offerError,setOfferError]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[olderBusy,setOlderBusy]=useState(false),[hasOlder,setHasOlder]=useState(false);
 type Draft={body:string;rideId:string;reply:Reply|null};const empty:Draft={body:'',rideId:'',reply:null};
 const[drafts,setDrafts]=useState<Record<number,Draft>>({}),[member,setMember]=useState<Message|null>(null);const draft=drafts[groupId]||empty;
 const update=(value:Partial<Draft>)=>setDrafts(previous=>({...previous,[groupId]:{...(previous[groupId]||empty),...value}}));
 const pending=useRef<Record<number,{clientId:string;body:string;rideId?:string;replyToId?:number;groupId:number}>>({});
 const feed=useRef<HTMLDivElement>(null),composer=useRef<HTMLTextAreaElement>(null),dialog=useRef<HTMLDialogElement>(null),groupsMenu=useRef<HTMLDetailsElement>(null),following=useRef(true),marked=useRef(0),marking=useRef(false);
 const group=community.groups.find(g=>g.id===groupId);const title=group?.name||'Ride community';
 useEffect(()=>{if(member)dialog.current?.showModal();},[member]);
 async function mark(upToId:number){if(marking.current||upToId<=marked.current||document.visibilityState==='hidden')return;marking.current=true;try{await authenticatedRequest(`/chat/groups/${groupId}/read`,{method:'POST',body:JSON.stringify({upToId})});if(selected.current===groupId){marked.current=upToId;community.refresh();}}catch{}finally{marking.current=false;}}
 function merge(previous:Message[],incoming:Message[]){const all=new Map(previous.map(m=>[m.id,m]));incoming.forEach(m=>all.set(m.id,m));return [...all.values()].filter(m=>Date.parse(m.createdAt)>=Date.now()-7*86400000).sort((a,b)=>a.id-b.id);}
 useEffect(()=>{let alive=true,running=false,first=true,cursor=0;const c=new AbortController();setMessages([]);setLoaded(false);setHasOlder(false);setError('');setFeedError('');setNotice('');following.current=true;marked.current=0;
  async function refresh(){if(running||document.visibilityState==='hidden')return;running=true;try{const result=await authenticatedRequest<{content:Message[];hasOlder:boolean;nextCursor:number}>(`/chat/messages?groupId=${groupId}&after=${cursor}`,{signal:c.signal});if(!alive)return;const snapshot=cursor>0?await authenticatedRequest<{content:Message[]}>(`/chat/messages?groupId=${groupId}`,{signal:c.signal}):result;if(!alive)return;cursor=result.nextCursor;setMessages(prev=>merge(merge(prev,snapshot.content),result.content));setLoaded(true);setFeedError('');if(first){setHasOlder(result.hasOlder);first=false;}if(following.current){requestAnimationFrame(()=>{if(alive&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;});const last=result.content.at(-1);if(last)void mark(last.id);}}catch(e){if(alive)setFeedError(errorMessage(e));}finally{running=false;}}
  void refresh();const timer=setInterval(()=>void refresh(),3000);const visible=()=>void refresh();document.addEventListener('visibilitychange',visible);return()=>{alive=false;c.abort();clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[groupId,user?.id]);
 async function older(){if(olderBusy||!messages.length)return;const id=groupId,top=feed.current?.scrollTop||0,height=feed.current?.scrollHeight||0;setOlderBusy(true);try{const result=await authenticatedRequest<{content:Message[];hasOlder:boolean}>(`/chat/messages?groupId=${id}&before=${messages[0].id}`);if(selected.current!==id)return;setMessages(prev=>merge(prev,result.content));setHasOlder(result.hasOlder);requestAnimationFrame(()=>{if(feed.current)feed.current.scrollTop=top+feed.current.scrollHeight-height;});}catch(e){setError(errorMessage(e));}finally{setOlderBusy(false);}}
 async function loadOffers(){setOfferError('');try{const all:Ride[]=[];for(let page=0;;page++){const result=await ridesApi.mine(page);all.push(...result.content);if(page+1>=result.totalPages)break;}setOffers(all.filter(r=>r.status==='SCHEDULED'&&Date.parse(r.departureAt)>Date.now()));}catch(e){setOfferError(errorMessage(e));}}
 function reply(message:Reply){update({reply:message});composer.current?.focus();}
 async function send(event:FormEvent){event.preventDefault();if(busy||!draft.body.trim())return;const id=groupId,next={body:draft.body.trim(),rideId:draft.rideId||undefined,replyToId:draft.reply?.id,groupId:id},old=pending.current[id];if(!old||old.body!==next.body||old.rideId!==next.rideId||old.replyToId!==next.replyToId)pending.current[id]={...next,clientId:crypto.randomUUID()};setBusy(true);setError('');setNotice('');try{const message=await authenticatedRequest<Message>('/chat/messages',{method:'POST',body:JSON.stringify(pending.current[id])});setDrafts(prev=>({...prev,[id]:empty}));delete pending.current[id];if(selected.current===id){setMessages(prev=>merge(prev,[message]));setNotice('Message sent.');following.current=true;requestAnimationFrame(()=>{if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;});void mark(message.id);}}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <section className="page narrow chat-page">
 <header className="chat-header"><Link to="/rides" aria-label="Back to rides"><Icon name="arrow-back-outline"/></Link><span className="chat-avatar" aria-hidden="true"><Icon name="people-outline"/></span><div><h1>{title}</h1><small>Swipe right to reply</small></div></header>
 <details className="chat-groups" ref={groupsMenu}><summary>Groups · {title}</summary><div className="chat-group-list">{community.groups.map(g=><div className="chat-group-row" key={g.id}><button type="button" disabled={busy} aria-pressed={groupId===g.id} onClick={()=>{setParams({group:String(g.id)});if(groupsMenu.current)groupsMenu.current.open=false;}}>{g.name}{g.unreadCount>0&&<span className="unread-badge">{g.unreadCount}</span>}</button><label><input type="checkbox" aria-label={`Show notifications for ${g.name}`} checked={!g.muted} disabled={community.muting.includes(g.id)} onChange={async e=>{try{await community.mute(g.id,!e.target.checked);}catch(f){setError(errorMessage(f));}}}/>Notifications</label></div>)}</div></details>
 <p className="chat-privacy">Last 7 days · Mobile numbers visible to signed-in members.</p>
 {(error||feedError||community.error)&&<p role="alert">{error||feedError||community.error} Your draft is kept.</p>}
 <div className="chat-feed panel" ref={feed} role="log" aria-label="Community messages" aria-live="polite" aria-relevant="additions" onScroll={()=>{if(feed.current){following.current=feed.current.scrollHeight-feed.current.scrollTop-feed.current.clientHeight<100;if(following.current&&messages.length)void mark(messages.at(-1)!.id);}}}>
 {hasOlder&&<button type="button" disabled={olderBusy} onClick={()=>void older()}>{olderBusy?'Loading…':'Load earlier messages (last 7 days)'}</button>}
 {!loaded&&!feedError&&<p role="status">Loading chat…</p>}{loaded&&!messages.length&&<p>No messages in the last 7 days. Start the conversation.</p>}
 {messages.map((m,i)=><Fragment key={m.id}>{(!i||chatDay(messages[i-1].createdAt)!==chatDay(m.createdAt))&&<div className="chat-date" role="separator">{chatDay(m.createdAt)}</div>}<SwipeReply disabled={busy} reply={()=>reply(m)}><article className={`chat-message${m.senderId===user?.id?' chat-own':''}`} data-message-id={m.id}>
 <strong>{m.senderId===user?.id?'You':m.senderName}</strong><button className="chat-contact" type="button" aria-label={`View member details for ${m.mobileNumber||m.senderName}`} onClick={()=>setMember(m)}>{m.mobileNumber||'Mobile number not added'}</button>{m.mobileNumber&&!m.mobileVerified&&<small>Unverified number</small>}
 {m.replyTo&&<blockquote className="chat-quote"><strong>{m.replyTo.senderName}</strong><p>{m.replyTo.body}</p></blockquote>}<p className="chat-body">{m.body}</p>
 {m.ride&&<div className="chat-offer"><strong>{m.ride.origin} → {m.ride.destination}</strong><p>{when(m.ride.departureAt,m.ride.timeZone)}</p><p>{m.ride.availableSeats} seats available · {m.ride.currency} {m.ride.pricePerSeat} per seat</p>{m.ride.status==='SCHEDULED'&&Date.parse(m.ride.departureAt)>Date.now()&&m.ride.availableSeats>0?<Link className="button button-small" to={`/rides/${m.ride.id}`}>View ride / book seats</Link>:<p>This ride is no longer available to book.</p>}</div>}
 <div className="chat-message-footer"><button type="button" disabled={busy} aria-label={`Reply to ${m.senderName}`} onClick={()=>reply(m)}><Icon name="return-up-back-outline"/>Reply</button><small>{new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})}</small></div>
 </article></SwipeReply></Fragment>)}
 </div>
 {!following.current&&(group?.unreadCount||0)>0&&<button type="button" onClick={()=>{following.current=true;if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;if(messages.length)void mark(messages.at(-1)!.id);}}>New messages · Jump to latest</button>}
 <form className="chat-composer" onSubmit={send}>{notice&&<small role="status">{notice}</small>}{draft.reply&&<div className="chat-reply-draft"><div><strong>Replying to {draft.reply.senderName}</strong><p>{draft.reply.body}</p></div><button type="button" aria-label="Cancel reply" disabled={busy} onClick={()=>update({reply:null})}><Icon name="close-outline"/></button></div>}
 <div className="chat-compose-row"><textarea ref={composer} aria-label="Message" maxLength={1000} rows={2} value={draft.body} disabled={busy} onChange={e=>update({body:e.target.value})} placeholder="Message"/><button className="chat-send" aria-label={busy?'Sending…':'Send message'} disabled={busy||!draft.body.trim()}><Icon name="send-outline"/></button></div>
 <details className="chat-attachments"><summary>＋ Share a ride</summary><button type="button" onClick={()=>void loadOffers()}>Load my rides to share</button>{offerError&&<p role="alert">{offerError}</p>}<label>Attach one of your upcoming rides<select value={draft.rideId} disabled={busy} onChange={e=>update({rideId:e.target.value})}><option value="">Message only</option>{offers.map(r=><option key={r.id} value={r.id}>{r.origin} → {r.destination} · {when(r.departureAt,r.timeZone)}</option>)}</select></label><Link to="/rides/new">Publish a new ride</Link></details>
 </form>
 <dialog ref={dialog} className="chat-member-dialog" aria-labelledby="chat-member-title" onClose={()=>setMember(null)} onCancel={()=>setMember(null)}>{member&&<><h2 id="chat-member-title">Member details</h2><p><strong>{member.member.fullName}</strong></p><p>{member.mobileNumber||'Mobile number not added'}{member.mobileNumber&&!member.mobileVerified&&' · Unverified number'}</p><p>Travel preference: {member.member.travelPreference==='BOTH'?'Drive and ride':member.member.travelPreference==='DRIVER'?'Drive':'Ride'}</p><p>Member since {new Date(member.member.memberSince).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</p>{member.mobileNumber&&<p><a className="button button-small" href={`tel:${member.mobileNumber}`}>Call {member.member.fullName}</a></p>}<button type="button" onClick={()=>dialog.current?.close()}>Close</button></>}</dialog>
 </section>;
}
