import {Link} from 'react-router';
import {legalDrafts,policyVersion} from './legalDrafts';
export function LegalPage({kind}:{kind:'terms'|'privacy'}){const policy=legalDrafts[kind];return <section className="page narrow"><p className="eyebrow">Draft · owner review required</p><h1>{policy.title}</h1><p>Version {policyVersion}</p>{policy.sections.map(([title,body])=><section key={title}><h2>{title}</h2><p>{body}</p></section>)}<Link to="/register">Return to signup</Link></section>;}
