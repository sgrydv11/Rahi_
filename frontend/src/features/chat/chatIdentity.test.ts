import {describe,it,expect} from 'vitest';
import {phoneKey,senderLabel,incomingMessage} from './chatIdentity';
describe('chat sender identity',()=>{
 it('uses selected local contact name, otherwise number, and handles missing numbers',()=>{expect(phoneKey('09876543210')).toBe('919876543210');expect(senderLabel('+91 98765 43210',{'919876543210':'Saved Test Contact'})).toBe('Saved Test Contact');expect(senderLabel('+919876543210')).toBe('+919876543210');expect(senderLabel(null)).toBe('Phone not added');});
 it('distinguishes incoming from own messages',()=>{expect(incomingMessage({senderId:'self'},'self')).toBe(false);expect(incomingMessage({senderId:'other'},'self')).toBe(true);});
});
