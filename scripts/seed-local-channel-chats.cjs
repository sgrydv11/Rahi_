// Local QA data only. No live URLs, real bookings, emails or push notifications.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const base='http://127.0.0.1:8084/api/v1',file='.local/channel-demo-seed.json';
async function api(path,token,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});assert.equal(r.status,status,`${path}: ${await r.clone().text()}`);return r.json();}
(async()=>{
 let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
 if(state?.completed){console.log('Demo seed already complete; no duplicate messages added.');return;}
 if(!state){state={password:randomUUID()+'Aa1!',users:[],messages:[]};fs.writeFileSync(file,JSON.stringify(state));}
 for(let i=state.users.length;i<4;i++){const email=`channel-demo-${Date.now()}-${i}@qa.example.test`;await api('/mobile/auth/register',null,{email,password:state.password,fullName:['Demo Driver','Demo Passenger','Demo Commuter','Demo Traveller'][i],travelPreference:'BOTH'},201);state.users.push({email});fs.writeFileSync(file,JSON.stringify(state));}
 const sessions=[];for(const u of state.users)sessions.push(await api('/mobile/auth/login',null,{email:u.email,password:state.password}));
 const groups=(await api('/chat/groups',sessions[0].accessToken)).filter(g=>/Indore.*(Ujjain|Dewas|Pithampur)/i.test(g.name));assert.equal(groups.length,3,'Expected three route channels');
 for(const g of groups){const city=/Ujjain/i.test(g.name)?'Ujjain':/Dewas/i.test(g.name)?'Dewas':'Pithampur';const lines=[`[DEMO] Indore to ${city}: sample morning commute at 8:30 AM, two seats available.`,`[DEMO] Can you pick me up at the listed boarding point?`,`[DEMO] Yes, please use Book ride to confirm a seat. This chat is sample data only.`,`[DEMO] Is there a return trip to Indore around 6:00 PM?`,`[DEMO] Sample return plan: 6:00 PM. Check the ride listing for actual availability.`,`[DEMO] Thanks! I will check the route and boarding details before booking.`];let first;
  for(let n=0;n<lines.length;n++){const key=`${g.id}:${n}`;if(state.messages.some(m=>m.key===key)){if(n===0)first=state.messages.find(m=>m.key===key);continue;}const existing=(await api(`/chat/messages?groupId=${g.id}`,sessions[0].accessToken)).content.find(m=>m.body===lines[n]);const m=existing||await api('/chat/messages',sessions[n%4].accessToken,{clientId:randomUUID(),groupId:g.id,body:lines[n],...(n===1&&first?{replyToId:first.id}:{})},200);state.messages.push({key,id:m.id,groupId:g.id,body:m.body});if(n===0)first=m;fs.writeFileSync(file,JSON.stringify(state,null,2));}
  const feed=await api(`/chat/messages?groupId=${g.id}`,sessions[0].accessToken);const own=state.messages.filter(m=>m.groupId===g.id);assert.equal(own.length,6);for(const m of own)assert(feed.content.some(x=>x.id===m.id&&x.groupId===g.id));assert(!feed.content.some(x=>state.messages.some(m=>m.id===x.id&&m.groupId!==g.id)));console.log(`PASS: ${g.name}: six demo messages, quoted reply, channel isolation.`);
 }
 state.completed=true;fs.writeFileSync(file,JSON.stringify(state,null,2));console.log('Seeded 18 sample messages across three local channels.');
})().catch(e=>{console.error(e);process.exitCode=1;});
