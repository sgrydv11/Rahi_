import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneKey,senderLabel,incomingMessage} from '../src/chatIdentity.ts';
test('matches saved India contact numbers without uploading them',()=>{assert.equal(phoneKey('09876543210'),'919876543210');assert.equal(phoneKey('+91 98765 43210'),'919876543210');assert.equal(phoneKey('0091-98765-43210'),'919876543210');assert.equal(senderLabel('+919876543210',{'919876543210':'Saved Test Contact'}),'Saved Test Contact');assert.equal(senderLabel('+919876543210'),'+919876543210');assert.equal(senderLabel(null),'Number unavailable');});
test('own sends never qualify as new incoming messages on the sender device',()=>{assert.equal(incomingMessage({senderId:'self'},'self'),false);assert.equal(incomingMessage({senderId:'other'},'self'),true);});
