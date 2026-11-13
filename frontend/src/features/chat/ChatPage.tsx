import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authenticatedRequest, errorMessage } from '../auth/auth';
import { useAuth } from '../auth/AuthContext';
import { ridesApi, type Ride } from '../rides/api';

interface Reply {id:number;senderId:string;senderName:string;body:string}
interface Message {
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
  const { user } = useAuth();
  const [messages,setMessages] = useState<Message[]>([]);
  const [offers,setOffers] = useState<Ride[]>([]);
  const [body,setBody] = useState('');
  const [replyTo,setReplyTo]=useState<Reply|null>(null);
  const [selectedMember,setSelectedMember]=useState<Message|null>(null);
  const [sharePhone,setSharePhone]=useState(false);
  const [rideId,setRideId] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice]=useState('');
  const [offerError,setOfferError] = useState('');
  const [loaded,setLoaded] = useState(false);
  const [busy,setBusy] = useState(false);
  const pending = useRef<{clientId:string;body:string;rideId?:string;sharePhone:boolean;replyToId?:number} | undefined>(undefined);
  const composer=useRef<HTMLTextAreaElement>(null);
  const memberDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(selectedMember)memberDialog.current?.showModal();},[selectedMember]);
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        const result = await authenticatedRequest<{content:Message[]}>('/chat/messages', {signal:controller.signal});
        if (!active) return;
        const nearBottom = !feed.current || feed.current.scrollHeight-feed.current.scrollTop-feed.current.clientHeight<100;
        setMessages(result.content); setLoaded(true); setError('');
        if (nearBottom) requestAnimationFrame(() => { if (active && feed.current) feed.current.scrollTop=feed.current.scrollHeight; });
      } catch (failure) { if (active) setError(errorMessage(failure)); }
      finally { if (active) timer=setTimeout(refresh,3000); }
    }
    void refresh();
    return () => { active=false; clearTimeout(timer); controller.abort(); };
  },[user?.id]);
  async function loadOffers() {
    setOfferError('');
    try {
      const all:Ride[]=[];
      for(let page=0;;page++) {
        const result=await ridesApi.mine(page);
        all.push(...result.content);
        if(page+1>=result.totalPages)break;
      }
      setOffers(all.filter(r=>r.status==='SCHEDULED' && Date.parse(r.departureAt)>Date.now()));
    } catch (failure) { setOfferError(errorMessage(failure)); }
  }
  async function send(event:FormEvent) {
    event.preventDefault(); if (busy || !body.trim()) return;
    const next={body:body.trim(),rideId:rideId||undefined,sharePhone,replyToId:replyTo?.id};
    if (pending.current?.body!==next.body || pending.current?.rideId!==next.rideId || pending.current?.sharePhone!==next.sharePhone || pending.current?.replyToId!==next.replyToId)
      pending.current={...next,clientId:crypto.randomUUID()};
    setBusy(true); setError(''); setNotice('');
    try {
      const message=await authenticatedRequest<Message>('/chat/messages',{method:'POST',body:JSON.stringify(pending.current)});
      setMessages(previous=>[...previous.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-50));
      setNotice('Message sent.'); setBody(''); setRideId(''); setReplyTo(null); pending.current=undefined;
      requestAnimationFrame(()=>{if(feed.current) feed.current.scrollTop=feed.current.scrollHeight;});
    } catch(failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow chat-page">
    <header className="chat-header"><Link to="/rides" aria-label="Back to rides">←</Link><span className="chat-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></svg></span><div><h1>Ride community</h1><small>Drivers & passengers · shared group</small></div></header>
    <p className="chat-privacy">Visible to signed-in members. Share your mobile number only if you want all members to see it. Keep payment details private. Updates every 3 seconds.</p>
    {error && <p role="alert">{error} Your draft is kept. Chat updates retry automatically; use Send to retry a failed message.</p>}
    <div className="chat-feed panel" ref={feed} role="log" aria-label="Community messages" aria-live="polite" aria-relevant="additions">
      {!loaded && !error && <p role="status">Loading chat…</p>}
      {loaded && !messages.length && <p>No messages yet. Start the conversation.</p>}
      {messages.map(message=><article className={`chat-message${message.senderId===user?.id?' chat-own':''}`} key={message.id}>
        <strong>{message.senderId===user?.id?'You':message.senderName}</strong>
        {message.mobileNumber && <small><button type="button" className="chat-contact" aria-label={`View member details for ${message.mobileNumber}`} onClick={()=>setSelectedMember(message)}>{message.mobileNumber}</button>{!message.mobileVerified && " · Unverified number"}</small>}
        {message.replyTo && <blockquote className="chat-quote"><strong>{message.replyTo.senderName}</strong><p>{message.replyTo.body}</p></blockquote>}
        <p className="chat-body">{message.body}</p>
        {message.ride && <div className="chat-offer">
          <strong>{message.ride.origin} → {message.ride.destination}</strong>
          <p>{when(message.ride.departureAt,message.ride.timeZone)}</p>
          <p>{message.ride.availableSeats} seats available · {message.ride.currency} {message.ride.pricePerSeat} per seat</p>
          {message.ride.status==='SCHEDULED' && Date.parse(message.ride.departureAt)>Date.now() && message.ride.availableSeats>0
            ? <Link className="button button-small" to={`/rides/${message.ride.id}`}>View ride / book seats</Link>
            : <p>This ride is no longer available to book.</p>}
        </div>}
        <div className="chat-message-footer"><button type="button" disabled={busy} aria-label={`Reply to ${message.senderName}`} onClick={()=>{setReplyTo(message);composer.current?.focus();}}>↩ Reply</button><small>{when(message.createdAt)}</small></div>
      </article>)}
    </div>
    <form className="chat-composer" onSubmit={send}>
      {notice && <small role="status">{notice}</small>}
      {replyTo && <div className="chat-reply-draft"><div><strong>Replying to {replyTo.senderName}</strong><p>{replyTo.body}</p></div><button type="button" aria-label="Cancel reply" disabled={busy} onClick={()=>setReplyTo(null)}>×</button></div>}
      <div className="chat-compose-row"><textarea ref={composer} aria-label="Message" maxLength={1000} rows={2} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Message" />
      <button className="chat-send" aria-label={busy?'Sending…':'Send message'} disabled={busy || !body.trim()}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15"/></svg></button></div>
      <label className="chat-phone-share"><input type="checkbox" checked={sharePhone} disabled={busy} onChange={e=>setSharePhone(e.target.checked)}/> Share my mobile number with this message</label>
      <details className="chat-attachments"><summary>＋ Share a ride</summary>
      <button className="button button-small" type="button" onClick={()=>void loadOffers()}>Load my rides to share</button>
      {offerError && <p role="alert">{offerError}</p>}
      <label>Attach one of your upcoming rides<select value={rideId} onChange={e=>setRideId(e.target.value)} disabled={busy}>
        <option value="">Message only</option>
        {offers.map(ride=><option key={ride.id} value={ride.id}>{ride.origin} → {ride.destination} · {when(ride.departureAt,ride.timeZone)}</option>)}
      </select></label>
      <Link to="/rides/new">Publish a new ride</Link>
      </details>
    </form>
    <dialog ref={memberDialog} className="chat-member-dialog" onClose={()=>setSelectedMember(null)} onCancel={()=>setSelectedMember(null)} aria-labelledby="chat-member-title">
      {selectedMember && <><h2 id="chat-member-title">Member details</h2><p><strong>{selectedMember.member.fullName}</strong></p><p>{selectedMember.mobileNumber}{!selectedMember.mobileVerified && ' · Unverified number'}</p><p>Travel preference: {selectedMember.member.travelPreference==='BOTH'?'Drive and ride':selectedMember.member.travelPreference==='DRIVER'?'Drive':'Ride'}</p><p>Member since {new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date(selectedMember.member.memberSince))}</p><p><a className="button button-small" href={`tel:${selectedMember.mobileNumber}`}>Call {selectedMember.member.fullName}</a></p><button type="button" onClick={()=>memberDialog.current?.close()}>Close</button></>}
    </dialog>
  </section>;
}
