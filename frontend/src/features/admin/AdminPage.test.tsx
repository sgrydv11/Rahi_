import {renderToString} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import type {User} from '../auth/auth';
const state=vi.hoisted(()=>({user:null as User|null,loading:false,native:false}));
vi.mock('../auth/AuthContext',()=>({useAuth:()=>state}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>state.native}}));
import {AdminPage} from './AdminPage';
const render=()=>renderToString(<MemoryRouter initialEntries={['/admin']}><AdminPage/></MemoryRouter>);
beforeEach(()=>{state.user=null;state.loading=false;state.native=false;});
describe('web administration access',()=>{
 it('waits for restored authentication before showing admin data',()=>{state.loading=true;expect(render()).toContain('Checking administrator access');expect(render()).not.toContain('FLEXIRRIDES OPERATIONS');});
 it('denies ordinary authenticated accounts',()=>{state.user={id:'user',email:'user@example.test',fullName:'User',role:'USER',travelPreference:'BOTH'};expect(render()).toContain('Administrator access required');expect(render()).not.toContain('Search users');});
 it('waits for server permissions before exposing management controls',()=>{state.user={id:'admin',email:'admin@example.test',fullName:'Admin',role:'ADMIN',travelPreference:'BOTH'};const html=render();expect(html).toContain('Loading staff permissions');expect(html).not.toContain('Suspend');expect(html).toContain('Log out');expect(html).not.toContain('App navigation');});
 it('does not expose administration in a native wrapper',()=>{state.native=true;state.user={id:'admin',email:'admin@example.test',fullName:'Admin',role:'ADMIN',travelPreference:'BOTH'};expect(render()).toContain('Use your web browser');expect(render()).not.toContain('FLEXIRRIDES OPERATIONS');});
});
