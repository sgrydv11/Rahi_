import {Text,TextInput} from './Typography';
import {chatDay,useCommunity} from './community';
import {SwipeReply} from './swipeReply';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Switch, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { api, type Ride } from './api';
import type { Navigate } from './navigation';
import { Button, Card, Copy, ErrorText, date } from './ui';

interface Reply {id:number;senderId:string;senderName:string;body:string}
interface Message {
  replyTo:Reply|null; member:{fullName:string;travelPreference:string;memberSince:string};
  phoneShared:boolean; mobileNumber:string|null; mobileVerified:boolean;
  id:number; senderId:string; senderName:string; body:string; createdAt:string;
  ride:null | {id:string;origin:string;destination:string;departureAt:string;availableSeats:number;
    pricePerSeat:number;currency:string;status:string};
}
export function Chat({userId,go,groupId,setGroup}:{userId:string;go:Navigate;groupId:number;setGroup:(id:number)=>void}) {
  const community=useCommunity();
  const [hasOlder,setHasOlder]=useState(false);
  const [feedError,setFeedError]=useState('');
  const [groupsOpen,setGroupsOpen]=useState(false);
  const selected=useRef(groupId);selected.current=groupId;
  const read=useRef(0);
  const drafts=useRef<Record<number,{body:string;rideId:string;replyTo:Reply|null}>>({});
  const [messages,setMessages]=useState<Message[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [draft,setDraft]=useState('');
  const [replyTo,setReplyTo]=useState<Reply|null>(null);
  const [selectedMember,setSelectedMember]=useState<Message|null>(null);
  const [rideId,setRideId]=useState('');
  const [offers,setOffers]=useState<Ride[]>([]);
  const [offerError,setOfferError]=useState('');
  const [busy,setBusy]=useState(false);
  const [share,setShare]=useState(false);
  const composer=useRef<TextInput>(null);
  const feed=useRef<ScrollView>(null);
  const following=useRef(true);
  const dimensions=useRef({height:0,offset:0});
  const preserve=useRef<{height:number;offset:number}|null>(null);
  const [newMessages,setNewMessages]=useState(false);
  const pending=useRef<Record<number,{clientId:string;body:string;rideId?:string;groupId:number;replyToId?:number}>>({});
  async function mark(id:number) {
    if(id<=read.current || AppState.currentState!=='active')return;
    const group=groupId;try{await api(`/chat/groups/${group}/read`,{method:'POST',body:{upToId:id}});if(selected.current===group){read.current=Math.max(read.current,id);community.refresh();}}catch{/* Poll retries read acknowledgement. */}
  }
  function merge(a:Message[],b:Message[]){return [...new Map([...a,...b].map(m=>[m.id,m])).values()].filter(m=>Date.parse(m.createdAt)>=Date.now()-7*86400000).sort((a,b)=>a.id-b.id);}
  useEffect(()=>{const draft=drafts.current[groupId];setDraft(draft?.body||'');setRideId(draft?.rideId||'');setReplyTo(draft?.replyTo||null);read.current=0;following.current=true;setMessages([]);setLoaded(false);setHasOlder(false);setNewMessages(false);preserve.current=null;setError('');
    let active=true,first=true;let cursor=0;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
    async function refresh(){try{if(AppState.currentState==='active'){
      const result=await api<{content:Message[];nextCursor:number;hasOlder:boolean}>(`/chat/messages?groupId=${groupId}&after=${cursor}`,{signal:controller.signal});
      const snapshot=cursor>0?await api<{content:Message[]}>(`/chat/messages?groupId=${groupId}`,{signal:controller.signal}):result;
      if(active){setMessages(prev=>merge(merge(prev,snapshot.content),result.content));cursor=result.nextCursor;setLoaded(true);setFeedError('');if(first){setHasOlder(result.hasOlder);first=false;}if(following.current&&cursor)void mark(cursor);else if(result.content.length)setNewMessages(true);}
    }}catch(failure){if(active)setFeedError(failure instanceof Error?failure.message:'Unable to refresh chat.');}finally{if(active)timer=setTimeout(refresh,3000);}}
    void refresh();return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[userId,groupId]);
  useEffect(()=>{drafts.current[groupId]={body:draft,rideId,replyTo};},[draft,rideId,replyTo]);
  const [olderBusy,setOlderBusy]=useState(false);
  async function older(){if(olderBusy||!messages.length)return;setOlderBusy(true);const group=groupId;try{const result=await api<{content:Message[];hasOlder:boolean}>(`/chat/messages?groupId=${group}&before=${messages[0].id}`);if(selected.current===group){following.current=false;preserve.current={...dimensions.current};setMessages(prev=>merge(prev,result.content));setHasOlder(result.hasOlder);}}catch(e){setError(e instanceof Error?e.message:'Unable to load messages.');}finally{setOlderBusy(false);}}
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
    const group=groupId;const next={body:draft.trim(),rideId:rideId||undefined,groupId:group,replyToId:replyTo?.id};
    if(pending.current[group]?.body!==next.body || pending.current[group]?.rideId!==next.rideId || pending.current[group]?.groupId!==next.groupId || pending.current[group]?.replyToId!==next.replyToId)
      pending.current[group]={...next,clientId:randomUUID()};
    setBusy(true);setError('');
    const sentDraft=draft;
    try {
      const message=await api<Message>('/chat/messages',{method:'POST',body:pending.current[group]});
      delete pending.current[group];drafts.current[group]={body:'',rideId:'',replyTo:null};
      if(selected.current!==group)return;
      setMessages(previous=>merge(previous,[message]));void mark(message.id);
      setDraft(previous=>previous===sentDraft?'':previous);setRideId('');setReplyTo(null);
      following.current=true;
      feed.current?.scrollToEnd({animated:true});
    } catch(failure) {setError(failure instanceof Error?failure.message:'Unable to send. Your draft is kept.');}
    finally {setBusy(false);}
  }
  return <View style={{flex:1,borderRadius:16,overflow:'hidden',backgroundColor:'#F7F9FC'}}>
    <Button label={groupsOpen?'Hide groups':'Groups · '+(community.groups.find(g=>g.id===groupId)?.name||'Ride community')} onPress={()=>setGroupsOpen(v=>!v)}/>
    {groupsOpen && <ScrollView style={{maxHeight:190}}>{community.groups.map(g=><View key={g.id} style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}><Button label={`${g.id===groupId?'✓ ':''}${g.name} (${g.unreadCount})`} disabled={busy} onPress={()=>{setGroup(g.id);setGroupsOpen(false);}}/></View><Switch accessibilityLabel={`Notifications for ${g.name}`} value={!g.muted} disabled={community.muting.includes(g.id)} onValueChange={enabled=>void community.mute(g.id,!enabled).catch(e=>setError(e.message))}/></View>)}</ScrollView>}
    <ErrorText message={community.error}/>
    <View style={{flexDirection:'row',gap:12,alignItems:'center',padding: 16,backgroundColor:'#fff'}}><Ionicons name="people-outline" size={42} color="#245EEA"/><View style={{flex:1}}><Text style={{fontSize:19,fontWeight:'700',color:'#142D4E'}}>{community.groups.find(g=>g.id===groupId)?.name||'Ride community'}</Text><Text style={{fontSize:12,color:'#4C5E75'}}>Swipe right to reply</Text></View></View>
    <Text style={{backgroundColor:'#F7F9FC',padding:8,fontSize:11,color:'#4C5E75',textAlign:'center'}}>Last 7 days · Mobile numbers visible to signed-in members.</Text>
    <ErrorText message={error} /><ErrorText message={feedError}/>
    {!loaded && !error && <Copy>Loading chat…</Copy>}
    {loaded && !messages.length && <Copy>No messages yet. Start the conversation.</Copy>}
    <ScrollView ref={feed} style={{flex:1}} contentContainerStyle={{padding:12}} keyboardShouldPersistTaps="handled" accessibilityLabel="Community messages"
      scrollEventThrottle={100} onScroll={({nativeEvent:e})=>{dimensions.current.offset=e.contentOffset.y;following.current=e.contentSize.height-e.contentOffset.y-e.layoutMeasurement.height<100;if(following.current)setNewMessages(false);if(following.current&&messages.length)void mark(messages[messages.length-1].id);}}
      onContentSizeChange={(_,height)=>{dimensions.current.height=height;if(preserve.current){feed.current?.scrollTo({y:preserve.current.offset+height-preserve.current.height,animated:false});preserve.current=null;}else if(following.current)feed.current?.scrollToEnd({animated:true});}}>
      {hasOlder && <Button label={olderBusy?'Loading…':'Load earlier messages'} disabled={olderBusy} onPress={()=>void older()}/>}
      <View style={{gap: 12}}>{messages.map((message,index)=><View key={message.id}>
        {(index===0||chatDay(messages[index-1].createdAt)!==chatDay(message.createdAt))&&<Text style={{textAlign:'center',padding:8,color:'#4C5E75'}}>{chatDay(message.createdAt)}</Text>}
        <SwipeReply disabled={busy} reply={()=>{setReplyTo(message);composer.current?.focus();}}><View style={{maxWidth:'88%',alignSelf:message.senderId===userId?'flex-end':'flex-start',backgroundColor:message.senderId===userId?'#EDF3FF':'#fff',padding:12,borderRadius:13,gap: 8}}>
        <Text style={{fontWeight:'700',fontSize:12,color:'#245EEA'}}>{message.senderId===userId?'You':message.senderName}</Text>
        {message.mobileNumber ? <Pressable accessibilityRole="button" accessibilityLabel={`View member details for ${message.mobileNumber}`} onPress={()=>setSelectedMember(message)}><Text style={{color:"#245EEA",textDecorationLine:"underline"}}>{message.mobileNumber}{!message.mobileVerified?" · Unverified number":""}</Text></Pressable>:<Text style={{fontSize:11}}>Mobile number not added</Text>}
        {message.replyTo && <View style={{borderLeftWidth:3,borderLeftColor:"#245EEA",backgroundColor:"#EDF3FF",padding:8,borderRadius:6}}><Text style={{fontWeight:"700",color:"#245EEA"}}>{message.replyTo.senderName}</Text><Text numberOfLines={3}>{message.replyTo.body}</Text></View>}
        <Copy>{message.body}</Copy>
        {message.ride && <>
          <Copy>{message.ride.origin} → {message.ride.destination}</Copy>
          <Copy>{date(message.ride.departureAt)}</Copy>
          <Copy>{message.ride.availableSeats} seats available · {message.ride.currency} {message.ride.pricePerSeat} per seat</Copy>
          {message.ride.status==='SCHEDULED' && Date.parse(message.ride.departureAt)>Date.now() && message.ride.availableSeats>0
            ? <Button label="View ride / book seats" onPress={()=>go({kind:'ride',id:message.ride!.id})} />
            : <Copy>This ride is no longer available to book.</Copy>}
        </>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${message.senderName}`} disabled={busy} onPress={()=>{setReplyTo(message);composer.current?.focus();}} style={{paddingVertical:8}}><Text style={{color:"#245EEA"}}>↩ Reply</Text></Pressable>
        <Text style={{fontSize:10,color:'#4C5E75',textAlign:'right'}}>{date(message.createdAt)}</Text>
      </View></SwipeReply></View>)}</View>
    </ScrollView>
    {newMessages&&<Button label="New messages ↓" onPress={()=>{following.current=true;setNewMessages(false);feed.current?.scrollToEnd({animated:true});if(messages.length)void mark(messages[messages.length-1].id);}}/>}
    <View style={{backgroundColor:'#F7F9FC',padding: 12,gap:8}}>
      {replyTo && <View style={{flexDirection:"row",alignItems:"center",gap:8,padding:8,borderLeftWidth:3,borderLeftColor:"#245EEA",backgroundColor:"#EDF3FF"}}><View style={{flex:1}}><Text style={{fontWeight:"700"}}>Replying to {replyTo.senderName}</Text><Text numberOfLines={2}>{replyTo.body}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" disabled={busy} onPress={()=>setReplyTo(null)} style={{padding:12}}><Ionicons name="close" size={22}/></Pressable></View>}
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Pressable accessibilityRole="button" accessibilityLabel="Share a ride" onPress={()=>setShare(v=>!v)} style={{padding:8}}><Ionicons name="attach-outline" size={25} color="#245EEA"/></Pressable><TextInput ref={composer} editable={!busy} accessibilityLabel="Message" placeholder="Message" value={draft} onChangeText={setDraft} multiline maxLength={1000} style={{flex:1,minHeight:44,maxHeight:100,padding:12,backgroundColor:'#fff',borderRadius:12,color:'#142D4E'}}/><Pressable accessibilityRole="button" accessibilityLabel={busy?'Sending…':'Send message'} disabled={busy||!draft.trim()} onPress={()=>void send()} style={{backgroundColor:'#245EEA',borderRadius:12,padding: 12,opacity:busy||!draft.trim()?0.5:1}}><Ionicons name="send" size={21} color="#fff"/></Pressable></View>

      {share&&<ScrollView style={{maxHeight:160}} keyboardShouldPersistTaps="handled">
      <Button label="Load my rides to share" onPress={()=>void loadOffers()} disabled={busy} />
      <ErrorText message={offerError} />
      <Button label={'Message only'+(!rideId?' ✓':'')} onPress={()=>setRideId('')} disabled={busy} />
      {offers.map(ride=><Button key={ride.id} label={`${rideId===ride.id?'✓ ':''}${ride.origin} → ${ride.destination} · ${date(ride.departureAt)}`}
        onPress={()=>setRideId(ride.id)} disabled={busy} />)}
      <Button label="Publish a new ride" onPress={()=>go({kind:'rideForm'})} />
      </ScrollView>}
    </View>
    <Modal visible={!!selectedMember} transparent animationType="fade" onRequestClose={()=>setSelectedMember(null)}>
      <View style={{flex:1,justifyContent:'center',backgroundColor:'#0008',padding:24}}><View accessibilityViewIsModal style={{backgroundColor:'#fff',padding:24,borderRadius:18,gap:12}}>
        <Text accessibilityRole="header" style={{fontSize:21,fontWeight:'700'}}>Member details</Text>
        {selectedMember && <><Copy>{selectedMember.member.fullName}</Copy><Copy>{selectedMember.mobileNumber}{!selectedMember.mobileVerified?' · Unverified number':''}</Copy><Copy>Travel preference: {selectedMember.member.travelPreference==='BOTH'?'Drive and ride':selectedMember.member.travelPreference==='DRIVER'?'Drive':'Ride'}</Copy><Copy>Member since {new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric'}).format(new Date(selectedMember.member.memberSince))}</Copy></>}
        <ErrorText message={error}/><Button label="Call member" onPress={()=>{if(selectedMember?.mobileNumber)void Linking.openURL(`tel:${selectedMember.mobileNumber}`).catch(()=>setError("Unable to open the phone app."));}}/><Button label="Close" onPress={()=>setSelectedMember(null)}/>
      </View></View>
    </Modal>
  </View>;
}
