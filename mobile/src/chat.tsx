import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { api, type Ride } from './api';
import type { Navigate } from './navigation';
import { Button, Card, Copy, ErrorText, Field, date } from './ui';

interface Message {
  id:number; senderId:string; senderName:string; body:string; createdAt:string;
  ride:null | {id:string;origin:string;destination:string;departureAt:string;availableSeats:number;
    pricePerSeat:number;currency:string;status:string};
}
export function Chat({userId,go}:{userId:string;go:Navigate}) {
  const [messages,setMessages]=useState<Message[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [draft,setDraft]=useState('');
  const [rideId,setRideId]=useState('');
  const [offers,setOffers]=useState<Ride[]>([]);
  const [offerError,setOfferError]=useState('');
  const [busy,setBusy]=useState(false);
  const feed=useRef<ScrollView>(null);
  const following=useRef(true);
  const pending=useRef<{clientId:string;body:string;rideId?:string} | undefined>(undefined);
  useEffect(()=>{
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function refresh() {
      try {
        if (AppState.currentState==='active') {
          const result=await api<{content:Message[]}>('/chat/messages',{signal:controller.signal});
          if (active) {setMessages(result.content);setLoaded(true);setError('');}
        }
      } catch(failure) {if(active)setError(failure instanceof Error?failure.message:'Unable to refresh chat.');}
      finally {if(active)timer=setTimeout(refresh,3000);}
    }
    void refresh();
    return ()=>{active=false;clearTimeout(timer);controller.abort();};
  },[userId]);
  async function loadOffers() {
    setOfferError('');
    try {
      const all:Ride[]=[];
      for(let page=0;;page++) {
        const result=await api<{content:Ride[];totalPages:number}>(`/rides/me?size=50&page=${page}`);
        all.push(...result.content);
        if(page+1>=result.totalPages)break;
      }
      setOffers(all.filter(r=>r.status==='SCHEDULED' && Date.parse(r.departureAt)>Date.now()));
    } catch(failure) {setOfferError(failure instanceof Error?failure.message:'Unable to load your rides.');}
  }
  async function send() {
    if(busy || !draft.trim() || draft.trim().length>1000)return;
    const next={body:draft.trim(),rideId:rideId||undefined};
    if(pending.current?.body!==next.body || pending.current?.rideId!==next.rideId)
      pending.current={...next,clientId:randomUUID()};
    setBusy(true);setError('');
    const sentDraft=draft;
    try {
      const message=await api<Message>('/chat/messages',{method:'POST',body:pending.current});
      setMessages(previous=>[...previous.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-50));
      setDraft(previous=>previous===sentDraft?'':previous);setRideId('');pending.current=undefined;
      following.current=true;
      feed.current?.scrollToEnd({animated:true});
    } catch(failure) {setError(failure instanceof Error?failure.message:'Unable to send. Your draft is kept.');}
    finally {setBusy(false);}
  }
  return <>
    <Card><Copy>Ride community</Copy><Copy>Visible to all signed-in drivers and passengers. Latest 50 messages, updated every 3 seconds. Keep personal contact and payment details private.</Copy></Card>
    <ErrorText message={error} />
    {!loaded && !error && <Copy>Loading chat…</Copy>}
    {loaded && !messages.length && <Copy>No messages yet. Start the conversation.</Copy>}
    <ScrollView ref={feed} style={{maxHeight:360}} nestedScrollEnabled accessibilityLabel="Community messages"
      scrollEventThrottle={100} onScroll={({nativeEvent:e})=>{following.current=e.contentSize.height-e.contentOffset.y-e.layoutMeasurement.height<100;}}
      onContentSizeChange={()=>{if(following.current)feed.current?.scrollToEnd({animated:true});}}>
      <View style={{gap:10}}>{messages.map(message=><Card key={message.id}>
        <Copy>{message.senderId===userId?'You':message.senderName} · {date(message.createdAt)}</Copy>
        <Copy>{message.body}</Copy>
        {message.ride && <>
          <Copy>{message.ride.origin} → {message.ride.destination}</Copy>
          <Copy>{date(message.ride.departureAt)}</Copy>
          <Copy>{message.ride.availableSeats} seats available · {message.ride.currency} {message.ride.pricePerSeat} per seat</Copy>
          {message.ride.status==='SCHEDULED' && Date.parse(message.ride.departureAt)>Date.now() && message.ride.availableSeats>0
            ? <Button label="View ride / book seats" onPress={()=>go({kind:'ride',id:message.ride!.id})} />
            : <Copy>This ride is no longer available to book.</Copy>}
        </>}
      </Card>)}</View>
    </ScrollView>
    <Card>
      <Field label="Message" value={draft} change={setDraft} multiline />
      <Copy>{draft.length}/1000 characters</Copy>
      <Button label="Load my rides to share" onPress={()=>void loadOffers()} disabled={busy} />
      <ErrorText message={offerError} />
      <Button label={'Message only'+(!rideId?' ✓':'')} onPress={()=>setRideId('')} disabled={busy} />
      {offers.map(ride=><Button key={ride.id} label={`${rideId===ride.id?'✓ ':''}${ride.origin} → ${ride.destination} · ${date(ride.departureAt)}`}
        onPress={()=>setRideId(ride.id)} disabled={busy} />)}
      <Button label={busy?'Sending…':'Send message'} onPress={()=>void send()} disabled={busy||!draft.trim()||draft.length>1000} />
      <Button label="Publish a new ride" onPress={()=>go({kind:'rideForm'})} />
    </Card>
  </>;
}
