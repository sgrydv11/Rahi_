import test from 'node:test';
import assert from 'node:assert/strict';
import {requestWelcomePermissions} from '../src/permissionOnboarding.ts';
test('permission dialogs are sequential and a denial does not suppress other choices',async()=>{const order=[];let active=0;const result=await requestWelcomePermissions({contacts:true,notifications:true,location:true},async kind=>{assert.equal(active,0);active++;order.push(kind);await Promise.resolve();active--;if(kind==='contacts')throw Error('denied');return kind!=='location';});assert.deepEqual(order,['contacts','notifications','location']);assert.deepEqual(result,{contacts:false,notifications:true,location:false});});
test('unselected permissions never request OS access',async()=>{const requests=[];assert.deepEqual(await requestWelcomePermissions({contacts:false,notifications:false,location:false},async kind=>{requests.push(kind);return true;}),{});assert.deepEqual(requests,[]);});
