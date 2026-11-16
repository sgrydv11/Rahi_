import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router';
import {Capacitor} from '@capacitor/core';
import {useAuth} from '../auth/AuthContext';
import {authenticatedRequest,errorMessage,logout} from '../auth/auth';
import {Icon} from '../../app/Icon';
import './admin.css';

type View='overview'|'users'|'rides'|'bookings'|'audit';
const sections:Record<View,string>={overview:'Overview',users:'Users',rides:'Rides',bookings:'Bookings',audit:'Activity log'};
interface Overview {users:number;activeUsers:number;upcomingRides:number;bookings:number;pendingBookings:number;failedNotifications:number}
interface UserRow {id:string;email:string;fullName:string;role:string;status:string;travelPreference:string;createdAt:string}
interface RideRow {id:string;driverName:string;origin:string;destination:string;departureAt:string;status:string;availableSeats:number;totalSeats:number;pricePerSeat:number;currency:string}
interface BookingRow {id:string;rideId:string;passengerName:string;email:string;origin:string;destination:string;departureAt:string;status:string;seats:number;total:number;currency:string}
interface AuditRow {id:number;actor:string;target:string;previousStatus:string;newStatus:string;reason:string;createdAt:string}
type Row=UserRow|RideRow|BookingRow|AuditRow;
interface Page {items:Row[];total:number;page:number;pageSize:number}
const date=(value:string)=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(value));
const money=(value:number,currency:string)=>new Intl.NumberFormat('en-IN',{style:'currency',currency}).format(value);
function Status({value}:{value:string}) {return <span className="admin-status">{value.replaceAll('_',' ')}</span>;}

export function AdminPage() {
 const {user,loading}=useAuth();
 useEffect(()=>{document.title='Administration | FlexirRides';for(const[name,content]of [['robots','noindex, nofollow'],['description','FlexirRides administration. Authorized administrators only.']]){let tag=document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);if(!tag){tag=document.createElement('meta');tag.name=name;document.head.append(tag);}tag.content=content;}},[]);
 if(Capacitor.isNativePlatform())return <main className="page"><h1>Use your web browser</h1><p>Administration is available on the FlexirRides website.</p><Link to="/">Return home</Link></main>;
 if(loading)return <main className="page" role="status">Checking administrator access…</main>;
 if(!user)return <Navigate to="/login" replace state={{from:'/admin'}}/>;
 if(user.role!=='ADMIN')return <main className="page"><h1>Administrator access required</h1><p>This account cannot access administration.</p><Link to="/profile">Go to your account</Link></main>;
 return <AdminWorkspace key={user.id} email={user.email}/>;
}

function AdminWorkspace({email}:{email:string}) {
 const[params,setParams]=useSearchParams(),navigate=useNavigate();
 const requested=params.get('view')||'overview';const view:View=Object.hasOwn(sections,requested)?requested as View:'overview';
 const parsed=Number(params.get('page')||0);const page=Number.isInteger(parsed)&&parsed>=0&&parsed<=10000?parsed:0;
 const query=(params.get('q')||'').slice(0,120);
 const[search,setSearch]=useState(query),[data,setData]=useState<Page|null>(null),[overview,setOverview]=useState<Overview|null>(null);
 const[loading,setLoading]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);
 const[selected,setSelected]=useState<UserRow|null>(null),[reason,setReason]=useState('');
 useEffect(()=>{setSearch(query);setSelected(null);setReason('');setSuccess('');},[view,query,page]);
 useEffect(()=>{const control=new AbortController();setLoading(true);setError('');setData(null);setOverview(null);
  const path=view==='overview'?'/admin/overview':`/admin/${view}?page=${page}&q=${encodeURIComponent(query)}`;
  authenticatedRequest<Page|Overview>(path,{signal:control.signal}).then(value=>{if(control.signal.aborted)return;if(view==='overview')setOverview(value as Overview);else setData(value as Page);}).catch(e=>{if(!control.signal.aborted)setError(errorMessage(e));}).finally(()=>{if(!control.signal.aborted)setLoading(false);});
  return()=>control.abort();
 },[view,page,query,revision]);
 function changePage(next:number){setParams({view,page:String(next),...(query?{q:query}:{})});}
 function find(e:FormEvent){e.preventDefault();setParams({view,...(search.trim()?{q:search.trim()}:{})});}
 async function setStatus(e:FormEvent){e.preventDefault();if(!selected||busy)return;if(reason.trim().length<10){setError('Enter a reason with at least 10 characters.');return;}setBusy(true);setError('');
  try{const status=selected.status==='ACTIVE'?'DISABLED':'ACTIVE';await authenticatedRequest(`/admin/users/${selected.id}/status`,{method:'POST',body:JSON.stringify({status,expectedStatus:selected.status,reason:reason.trim()})});setSuccess(`${selected.email} ${status==='ACTIVE'?'reactivated':'suspended'}.`);setSelected(null);setReason('');setRevision(r=>r+1);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 async function signOut(){setBusy(true);setError('');try{await logout();navigate('/login',{replace:true,state:{message:'You have been logged out.'}});}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <div className="admin-shell"><a className="skip-link" href="#admin-main">Skip to content</a>
  <header className="admin-header"><Link className="brand" to="/" aria-label="FlexirRides home">FlexirRides</Link><span className="admin-label">Administration</span><Link to="/">Open website</Link><button disabled={busy} onClick={()=>void signOut()}>Log out</button></header>
  <div className="admin-grid"><aside className="admin-sidebar"><p className="eyebrow">WORKSPACE</p><nav aria-label="Administration navigation">{(Object.entries(sections) as [View,string][]).map(([key,label])=><Link key={key} to={key==='overview'?'/admin':`/admin?view=${key}`} aria-current={view===key?'page':undefined}>{label}<Icon name="arrow-forward-outline"/></Link>)}</nav><div className="admin-identity"><small>Signed in as</small><p>{email}</p></div></aside>
   <main id="admin-main" className="admin-main" tabIndex={-1}><div className="admin-heading"><div><p className="eyebrow">FLEXIRRIDES OPERATIONS</p><h1>{sections[view]}</h1><p>{view==='overview'?'A live view of your ride community.':view==='users'?'Find accounts and manage platform access.':view==='audit'?'Account access changes, with reasons and administrator attribution.':'Review platform records. All departure times are shown in India Standard Time.'}</p></div><button className="secondary" disabled={loading||busy} onClick={()=>setRevision(r=>r+1)}>Refresh</button></div>
    {error&&<p role="alert" className="admin-error">{error} <button disabled={loading||busy} onClick={()=>setRevision(r=>r+1)}>Retry</button></p>}{success&&<p role="status" className="admin-success">{success}</p>}
    {view!=='overview'&&view!=='audit'&&<form className="admin-search" onSubmit={find}><label htmlFor="admin-search">Search {sections[view].toLowerCase()}</label><div><input id="admin-search" value={search} onChange={e=>setSearch(e.target.value)} maxLength={120}/><button disabled={busy}>Search</button>{query&&<button type="button" className="secondary" disabled={busy} onClick={()=>setParams({view})}>Clear</button>}</div></form>}
    {selected&&<section className="panel admin-confirm" aria-labelledby="status-heading"><h2 id="status-heading">{selected.status==='ACTIVE'?'Suspend':'Reactivate'} this account?</h2><p>{selected.fullName} · {selected.email}</p><p>{selected.status==='ACTIVE'?'Their sessions will be revoked immediately. Existing bookings and financial records will be preserved.':'The user can sign in again. Previous sessions will stay revoked.'}</p><form onSubmit={setStatus}><label>Reason<textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required disabled={busy}/></label><div className="admin-actions"><button disabled={busy}>Confirm {selected.status==='ACTIVE'?'suspension':'reactivation'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></div></form></section>}
    {loading&&<p role="status">Loading {sections[view].toLowerCase()}…</p>}
    {!loading&&overview&&<><div className="admin-metrics">{[['Total accounts',overview.users],['Active accounts',overview.activeUsers],['Upcoming rides',overview.upcomingRides],['Total bookings',overview.bookings],['Pending requests',overview.pendingBookings],['Failed alerts · 24 hours',overview.failedNotifications]].map(([label,value])=><article className="panel" key={label}><p>{label}</p><strong>{Number(value).toLocaleString('en-IN')}</strong></article>)}</div><section className="panel admin-notes"><h2>Account access, with a record.</h2><p>Every suspension and reactivation is recorded in the activity log. Administrator accounts are protected from these controls.</p><Link to="/admin?view=users" className="button">Manage users <Icon name="arrow-forward-outline"/></Link></section></>}
    {!loading&&data&&<><p className="admin-results">{data.total.toLocaleString('en-IN')} records{query&&` matching “${query}”`}</p>{data.items.length===0?<section className="panel"><h2>No records found</h2><p>{query?'Try a different search or clear your search.':'There are no records to show yet.'}</p></section>:<AdminTable view={view} rows={data.items} busy={busy} onSelect={u=>{setSelected(u);setReason('');setError('');setSuccess('');}}/>}<nav className="admin-pagination" aria-label="Results pagination"><button className="secondary" disabled={page===0||busy} onClick={()=>changePage(page-1)}>Previous</button><span>Page {page+1} of {Math.max(1,Math.ceil(data.total/data.pageSize))}</span><button className="secondary" disabled={(page+1)*data.pageSize>=data.total||busy} onClick={()=>changePage(page+1)}>Next</button></nav></>}
   </main></div><footer className="admin-footer">© {new Date().getFullYear()} FlexirRides · Administrator workspace</footer></div>;
}
function AdminTable({view,rows,busy,onSelect}:{view:View;rows:Row[];busy:boolean;onSelect:(user:UserRow)=>void}) {
 let headings:string[],cells:(row:Row)=>ReactNode[];
 if(view==='users'){headings=['Account','User type','Access','Joined','Action'];cells=row=>{const u=row as UserRow;return[<><strong>{u.fullName}</strong><a href={`mailto:${u.email}`}>{u.email}</a><small>{u.role}</small></>,u.travelPreference,<Status value={u.status}/>,date(u.createdAt),u.role==='ADMIN'?<small>Protected admin</small>:<button className="secondary" disabled={busy} onClick={()=>onSelect(u)}>{u.status==='ACTIVE'?'Suspend':'Reactivate'}</button>];};}
 else if(view==='rides'){headings=['Route','Driver','Departure · IST','Seats','Fare / seat','Status'];cells=row=>{const r=row as RideRow;return[<><Link to={`/rides/${r.id}`}>{r.origin} → {r.destination}</Link><small>{r.id}</small></>,r.driverName,date(r.departureAt),`${r.availableSeats} / ${r.totalSeats}`,money(r.pricePerSeat,r.currency),<Status value={r.status}/>];};}
 else if(view==='bookings'){headings=['Booking / passenger','Route','Departure · IST','Seats','Seat fare total','Status'];cells=row=>{const b=row as BookingRow;return[<><strong>{b.passengerName}</strong><a href={`mailto:${b.email}`}>{b.email}</a><small>{b.id}</small></>,<Link to={`/rides/${b.rideId}`}>{b.origin} → {b.destination}</Link>,date(b.departureAt),b.seats,money(b.total,b.currency),<Status value={b.status}/>];};}
 else {headings=['When · IST','Administrator','Account','Change','Reason'];cells=row=>{const a=row as AuditRow;return[date(a.createdAt),a.actor,a.target,`${a.previousStatus} → ${a.newStatus}`,a.reason];};}
 return <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={`${sections[view]} table`}><table className="admin-table"><caption className="sr-only">{sections[view]} records</caption><thead><tr>{headings.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{cells(row).map((value,index)=><td key={headings[index]} data-label={headings[index]}>{value}</td>)}</tr>)}</tbody></table></div>;
}
