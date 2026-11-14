import { useEffect,useState } from 'react';
import { authenticatedRequest,errorMessage } from '../auth/auth';
export type RegularRoute={origin:string;destination:string;period:'MORNING'|'AFTERNOON'|'EVENING'|'NIGHT'};
export const cities=['Indore','Ujjain','Dewas','Pithampur'];
export const periods={MORNING:'Morning · 5 AM–12 PM',AFTERNOON:'Afternoon · 12–5 PM',EVENING:'Evening · 5–9 PM',NIGHT:'Night · 9 PM–5 AM'};
export function RegularRoutesEditor({value,change,disabled=false}:{value:RegularRoute[];change:(routes:RegularRoute[])=>void;disabled?:boolean}) {
 function edit(index:number,key:keyof RegularRoute,next:string){change(value.map((r,i)=>i===index?{...r,[key]:next}:r));}
 return <fieldset disabled={disabled} className="regular-routes"><legend>Regular travel routes (optional)</legend><p>Get in-app matches for rides and travel buddies at your usual times (India time).</p>
 {value.map((r,i)=><div className="regular-route" key={i}><label>From city {i+1}<select value={r.origin} onChange={e=>edit(i,'origin',e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select></label><label>To city {i+1}<select value={r.destination} onChange={e=>edit(i,'destination',e.target.value)}>{cities.map(c=><option key={c}>{c}</option>)}</select></label><label>Usual time {i+1}<select value={r.period} onChange={e=>edit(i,'period',e.target.value)}>{Object.entries(periods).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button type="button" onClick={()=>change(value.filter((_,n)=>n!==i))}>Remove route {i+1}</button></div>)}
 {value.length<6&&<button type="button" onClick={()=>{const last=value.at(-1);change([...value,{origin:last?.destination||'Indore',destination:last?.origin||'Ujjain',period:last?'EVENING':'MORNING'}]);}}>Add regular route</button>}
 </fieldset>;
}
export function TravelPreferencesSettings(){
 const [routes,setRoutes]=useState<RegularRoute[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 useEffect(()=>{const c=new AbortController();authenticatedRequest<RegularRoute[]>('/travel-preferences',{signal:c.signal}).then(v=>{if(!c.signal.aborted){setRoutes(v);setLoaded(true);}}).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[]);
 return <section><h2>Regular travel</h2>{loaded&&<><RegularRoutesEditor value={routes} change={v=>{setRoutes(v);setSaved(false);}} disabled={busy}/><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');setSaved(false);try{setRoutes(await authenticatedRequest<RegularRoute[]>('/travel-preferences',{method:'POST',body:JSON.stringify({routes})}));setSaved(true);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>Save regular routes</button></>}{saved&&<p role="status">Regular routes saved.</p>}{error&&<p role="alert">{error}</p>}</section>;
}
