import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Switch, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
export function Chat({userId,go}:{userId:string;go:Navigate}) {
  const [messages,setMessages]=useState<Message[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [draft,setDraft]=useState('');
  const [replyTo,setReplyTo]=useState<Reply|null>(null);
  const [selectedMember,setSelectedMember]=useState<Message|null>(null);
  const [sharePhone,setSharePhone]=useState(false);
  const [rideId,setRideId]=useState('');
  const [offers,setOffers]=useState<Ride[]>([]);
  const [offerError,setOfferError]=useState('');
  const [busy,setBusy]=useState(false);
  const [share,setShare]=useState(false);
  const composer=useRef<TextInput>(null);
  const feed=useRef<ScrollView>(null);
  const following=useRef(true);
  const pending=useRef<{clientId:string;body:string;rideId?:string;sharePhone:boolean;replyToId?:number} | undefined>(undefined);
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
    const next={body:draft.trim(),rideId:rideId||undefined,sharePhone,replyToId:replyTo?.id};
    if(pending.current?.body!==next.body || pending.current?.rideId!==next.rideId || pending.current?.sharePhone!==next.sharePhone || pending.current?.replyToId!==next.replyToId)
      pending.current={...next,clientId:randomUUID()};
    setBusy(true);setError('');
    const sentDraft=draft;
    try {
      const message=await api<Message>('/chat/messages',{method:'POST',body:pending.current});
      setMessages(previous=>[...previous.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-50));
      setDraft(previous=>previous===sentDraft?'':previous);setRideId('');setReplyTo(null);pending.current=undefined;
      following.current=true;
      feed.current?.scrollToEnd({animated:true});
    } catch(failure) {setError(failure instanceof Error?failure.message:'Unable to send. Your draft is kept.');}
    finally {setBusy(false);}
  }
  return <View style={{flex:1,borderRadius:16,overflow:'hidden',backgroundColor:'#eef1e8'}}>
    <View style={{flexDirection:'row',gap:12,alignItems:'center',padding:14,backgroundColor:'#fff'}}><Ionicons name="people-circle" size={42} color="#2359ac"/><View><Text style={{fontSize:19,fontWeight:'700',color:'#172b49'}}>Ride community</Text><Text style={{fontSize:12,color:'#52657f'}}>Drivers & passengers · shared group</Text></View></View>
    <Text style={{backgroundColor:'#fff5dc',padding:8,fontSize:11,color:'#52657f',textAlign:'center'}}>Visible to signed-in members. Share your mobile number only if you want all members to see it. Keep payment details private.</Text>
    <ErrorText message={error} />
    {!loaded && !error && <Copy>Loading chat…</Copy>}
    {loaded && !messages.length && <Copy>No messages yet. Start the conversation.</Copy>}
    <ScrollView ref={feed} style={{flex:1}} contentContainerStyle={{padding:12}} keyboardShouldPersistTaps="handled" accessibilityLabel="Community messages"
      scrollEventThrottle={100} onScroll={({nativeEvent:e})=>{following.current=e.contentSize.height-e.contentOffset.y-e.layoutMeasurement.height<100;}}
      onContentSizeChange={()=>{if(following.current)feed.current?.scrollToEnd({animated:true});}}>
      <View style={{gap:10}}>{messages.map(message=><View key={message.id} style={{maxWidth:'88%',alignSelf:message.senderId===userId?'flex-end':'flex-start',backgroundColor:message.senderId===userId?'#d9f3dc':'#fff',padding:12,borderRadius:13,gap:6}}>
        <Text style={{fontWeight:'700',fontSize:12,color:'#2359ac'}}>{message.senderId===userId?'You':message.senderName}</Text>
        {message.mobileNumber && <Pressable accessibilityRole="button" accessibilityLabel={`View member details for ${message.mobileNumber}`} onPress={()=>setSelectedMember(message)}><Text style={{color:"#2359ac",textDecorationLine:"underline"}}>{message.mobileNumber}{!message.mobileVerified?" · Unverified number":""}</Text></Pressable>}
        {message.replyTo && <View style={{borderLeftWidth:3,borderLeftColor:"#2359ac",backgroundColor:"#e9eff8",padding:8,borderRadius:6}}><Text style={{fontWeight:"700",color:"#2359ac"}}>{message.replyTo.senderName}</Text><Text numberOfLines={3}>{message.replyTo.body}</Text></View>}
        <Copy>{message.body}</Copy>
        {message.ride && <>
          <Copy>{message.ride.origin} → {message.ride.destination}</Copy>
          <Copy>{date(message.ride.departureAt)}</Copy>
          <Copy>{message.ride.availableSeats} seats available · {message.ride.currency} {message.ride.pricePerSeat} per seat</Copy>
          {message.ride.status==='SCHEDULED' && Date.parse(message.ride.departureAt)>Date.now() && message.ride.availableSeats>0
            ? <Button label="View ride / book seats" onPress={()=>go({kind:'ride',id:message.ride!.id})} />
            : <Copy>This ride is no longer available to book.</Copy>}
        </>}
        <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${message.senderName}`} disabled={busy} onPress={()=>{setReplyTo(message);composer.current?.focus();}} style={{paddingVertical:8}}><Text style={{color:"#2359ac"}}>↩ Reply</Text></Pressable>
        <Text style={{fontSize:10,color:'#52657f',textAlign:'right'}}>{date(message.createdAt)}</Text>
      </View>)}</View>
    </ScrollView>
    <View style={{backgroundColor:'#f7f9fc',padding:10,gap:8}}>
      {replyTo && <View style={{flexDirection:"row",alignItems:"center",gap:8,padding:8,borderLeftWidth:3,borderLeftColor:"#2359ac",backgroundColor:"#e9eff8"}}><View style={{flex:1}}><Text style={{fontWeight:"700"}}>Replying to {replyTo.senderName}</Text><Text numberOfLines={2}>{replyTo.body}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" disabled={busy} onPress={()=>setReplyTo(null)} style={{padding:12}}><Ionicons name="close" size={22}/></Pressable></View>}
      <View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Pressable accessibilityRole="button" accessibilityLabel="Share a ride" onPress={()=>setShare(v=>!v)} style={{padding:8}}><Ionicons name="attach" size={25} color="#2359ac"/></Pressable><TextInput ref={composer} editable={!busy} accessibilityLabel="Message" placeholder="Message" value={draft} onChangeText={setDraft} multiline maxLength={1000} style={{flex:1,minHeight:44,maxHeight:100,padding:12,backgroundColor:'#fff',borderRadius:22,color:'#172b49'}}/><Pressable accessibilityRole="button" accessibilityLabel={busy?'Sending…':'Send message'} disabled={busy||!draft.trim()} onPress={()=>void send()} style={{backgroundColor:'#2359ac',borderRadius:24,padding:13,opacity:busy||!draft.trim()?0.5:1}}><Ionicons name="send" size={21} color="#fff"/></Pressable></View>
      <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Switch accessibilityLabel="Share my mobile number with this message" value={sharePhone} onValueChange={setSharePhone} disabled={busy}/><Copy>Share my mobile number</Copy></View>
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
