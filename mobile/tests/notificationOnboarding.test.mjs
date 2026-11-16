import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOfferNotifications,decideNotifications,canRegisterNotifications} from '../src/notificationOnboarding.ts';
const fresh={granted:false,canAskAgain:true,status:'undetermined'};
test('offers notifications on a fresh install without requiring login or network',()=>{assert.equal(shouldOfferNotifications(fresh,null),true);for(const decision of ['later','requested'])assert.equal(shouldOfferNotifications(fresh,decision),false);assert.equal(shouldOfferNotifications({...fresh,granted:true,status:'granted'},null),true);assert.equal(shouldOfferNotifications({...fresh,canAskAgain:false,status:'denied'},null),false);assert.equal(shouldOfferNotifications({...fresh,status:'denied'},null),false);});
test('Not now saves the choice without requesting system permission',async()=>{const calls=[];await decideNotifications(false,{save:async v=>calls.push(v),channel:async()=>calls.push('channel'),request:async()=>{throw Error('must not request')}});assert.deepEqual(calls,['later']);});
test('Enable saves the choice, creates Android channel, then requests OS permission',async()=>{const calls=[];const denied={...fresh,status:'denied'};assert.equal(await decideNotifications(true,{save:async v=>calls.push(v),channel:async()=>calls.push('channel'),request:async()=>{calls.push('permission');return denied;}}),denied);assert.deepEqual(calls,['requested','channel','permission']);});

test('automatic push registration requires opt-in even if the OS has granted permission',()=>{assert.equal(canRegisterNotifications(false,null),false);assert.equal(canRegisterNotifications(false,'later'),false);assert.equal(canRegisterNotifications(false,'requested'),true);assert.equal(canRegisterNotifications(true,'later'),true);});
