import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authenticatedRequest, errorMessage } from '../auth/auth';
import { useAuth } from '../auth/AuthContext';
import { ridesApi, type Ride } from '../rides/api';

interface Message {
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
  const [rideId,setRideId] = useState('');
  const [error,setError] = useState('');
  const [offerError,setOfferError] = useState('');
  const [loaded,setLoaded] = useState(false);
  const [busy,setBusy] = useState(false);
  const pending = useRef<{clientId:string;body:string;rideId?:string} | undefined>(undefined);
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
    const next={body:body.trim(),rideId:rideId||undefined};
    if (pending.current?.body!==next.body || pending.current?.rideId!==next.rideId)
      pending.current={...next,clientId:crypto.randomUUID()};
    setBusy(true); setError('');
    try {
      const message=await authenticatedRequest<Message>('/chat/messages',{method:'POST',body:JSON.stringify(pending.current)});
      setMessages(previous=>[...previous.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-50));
      setBody(''); setRideId(''); pending.current=undefined;
      requestAnimationFrame(()=>{if(feed.current) feed.current.scrollTop=feed.current.scrollHeight;});
    } catch(failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section className="page narrow chat-page">
    <header className="chat-header"><Link to="/rides" aria-label="Back to rides">←</Link><span className="chat-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></svg></span><div><h1>Ride community</h1><small>Drivers & passengers · shared group</small></div></header>
    <p className="chat-privacy">Visible to signed-in members. Keep contact and payment details private. Updates every 3 seconds.</p>
    {error && <p role="alert">{error} Your draft is kept; messages will retry automatically.</p>}
    <div className="chat-feed panel" ref={feed} role="log" aria-label="Community messages" aria-live="polite" aria-relevant="additions">
      {!loaded && !error && <p role="status">Loading chat…</p>}
      {loaded && !messages.length && <p>No messages yet. Start the conversation.</p>}
      {messages.map(message=><article className={`chat-message${message.senderId===user?.id?' chat-own':''}`} key={message.id}>
        <strong>{message.senderId===user?.id?'You':message.senderName}</strong>
        <p className="chat-body">{message.body}</p>
        {message.ride && <div className="chat-offer">
          <strong>{message.ride.origin} → {message.ride.destination}</strong>
          <p>{when(message.ride.departureAt,message.ride.timeZone)}</p>
          <p>{message.ride.availableSeats} seats available · {message.ride.currency} {message.ride.pricePerSeat} per seat</p>
          {message.ride.status==='SCHEDULED' && Date.parse(message.ride.departureAt)>Date.now() && message.ride.availableSeats>0
            ? <Link className="button button-small" to={`/rides/${message.ride.id}`}>View ride / book seats</Link>
            : <p>This ride is no longer available to book.</p>}
        </div>}
        <small>{when(message.createdAt)}</small>
      </article>)}
    </div>
    <form className="chat-composer" onSubmit={send}>
      <div className="chat-compose-row"><textarea aria-label="Message" maxLength={1000} rows={2} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Message" />
      <button className="chat-send" aria-label={busy?'Sending…':'Send message'} disabled={busy || !body.trim()}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15"/></svg></button></div>
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
  </section>;
}
