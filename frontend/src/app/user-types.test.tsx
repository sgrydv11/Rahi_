import {renderToString} from 'react-dom/server';
import {MemoryRouter,Route,Routes} from 'react-router';
import {describe,it,expect,vi} from 'vitest';
import type {User} from '../features/auth/auth';
const state=vi.hoisted(()=>({user:null as User|null}));
vi.mock('../features/auth/AuthContext',()=>({useAuth:()=>({user:state.user,loading:false})}));
import {AppLayout} from './layouts/AppLayout';
import {HomePage} from '../features/home/HomePage';
describe('user-type action visibility',()=>{
 it.each([['DRIVER',true,false],['PASSENGER',false,true],['BOTH',true,true]] as const)('%s exposes only its permitted actions',(travelPreference,offer,book)=>{
  state.user={id:'qa',email:'qa@example.test',fullName:'QA',role:'USER',travelPreference};
  const html=renderToString(<MemoryRouter><Routes><Route element={<AppLayout/>}><Route path="/" element={<HomePage/>}/></Route></Routes></MemoryRouter>);
  const main=html.match(/<main[^>]*>([\s\S]*?)<\/main>/)![1];expect(main.includes('Offer a ride')).toBe(offer);expect(main.includes('Explore rides')).toBe(book);
 });
});
