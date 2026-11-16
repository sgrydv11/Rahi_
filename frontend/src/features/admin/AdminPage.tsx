import {useEffect,useState} from 'react';
import {Link,Navigate,useNavigate,useSearchParams} from 'react-router';
import {Capacitor} from '@capacitor/core';
import {useAuth} from '../auth/AuthContext';
import {authenticatedRequest,errorMessage,logout} from '../auth/auth';
import {Icon} from '../../app/Icon';
import './admin.css';
import {AdminExtra,type StaffAccess} from './AdminExtra';

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
 const[params]=useSearchParams(),navigate=useNavigate();
 const[access,setAccess]=useState<StaffAccess|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const c=new AbortController();authenticatedRequest<StaffAccess>('/admin/access',{signal:c.signal}).then(setAccess).catch(e=>{if(!c.signal.aborted)setError(errorMessage(e));});return()=>c.abort();},[revision]);
 const views:Record<string,[string,string]>={overview:['Overview','OVERVIEW'],users:['Users','USERS_READ'],history:['User history','USER_HISTORY'],staff:['Staff roles','STAFF_MANAGE'],rides:['Rides','RIDES_READ'],bookings:['Bookings','BOOKINGS_READ'],vehicles:['Vehicles','VEHICLES_READ'],chat:['Chat moderation','CHAT_READ'],analytics:['Analytics','ANALYTICS_READ'],finance:['Finance','FINANCE_READ'],services:['Services','SERVICES_READ'],audit:['Activity log','AUDIT_READ']};
 const groups:Record<string,string[]>={Overview:['overview','analytics'],People:['users','staff'],Journeys:['rides','bookings','vehicles'],Community:['chat'],Operations:['services','finance','audit']};
 const view=Object.hasOwn(views,params.get('view')||'')?params.get('view')!:'overview';
 const can=(v:string)=>access?.membership.permissions.includes(views[v][1]);
 async function signOut(){try{await logout();navigate('/login',{replace:true});}catch(e){setError(errorMessage(e));}}
 return <div className="admin-shell"><a className="skip-link" href="#admin-main">Skip to content</a><header className="admin-header"><Link className="brand" to="/">FlexirRides</Link><span className="admin-label">Administration</span><Link to="/">Open website</Link><button onClick={()=>void signOut()}>Log out</button></header>
 <div className="admin-grid"><aside className="admin-sidebar"><p className="eyebrow">WORKSPACE</p><nav aria-label="Administration navigation">{Object.entries(groups).filter(([,items])=>items.some(can)).map(([label,items])=><Link key={label} to={`/admin?view=${items.find(can)}`} aria-current={items.includes(view)?'page':undefined}>{label}<Icon name="arrow-forward-outline"/></Link>)}</nav><div className="admin-identity"><small>Signed in as</small><p>{email}</p><strong>{access?.membership.staffRole}</strong></div></aside>
 <main id="admin-main" className="admin-main" tabIndex={-1}><div className="admin-heading"><div><p className="eyebrow">FLEXIRRIDES OPERATIONS</p><h1>{views[view][0]}</h1><p>Live platform records. Times are shown in India Standard Time.</p></div><button className="secondary" onClick={()=>setRevision(r=>r+1)}>Refresh</button></div>
 {error&&<p role="alert" className="admin-error">{error}</p>}{!access&&!error&&<p role="status">Loading staff permissions…</p>}
 {access&&<><nav className="admin-tabs" aria-label="Workspace sections">{Object.values(groups).find(items=>items.includes(view))?.filter(can).map(v=><Link key={v} to={`/admin?view=${v}`} aria-current={v===view?'page':undefined}>{views[v][0]}</Link>)}</nav>{can(view)?<AdminExtra key={view} view={view} access={access} revision={revision}/>:<p role="alert">Your staff role does not permit this section.</p>}</>}
 </main></div><footer className="admin-footer">© {new Date().getFullYear()} FlexirRides · Administrator workspace</footer></div>;
}
