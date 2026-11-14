import {describe,it,expect} from 'vitest';
import {chatDay} from './Community';
describe('chat date separators use India calendar dates',()=>{
 it('uses Today across the UTC date boundary',()=>expect(chatDay('2026-11-14T19:00:00Z',new Date('2026-11-14T20:00:00Z'))).toBe('Today'));
 it('uses Yesterday for the preceding India date',()=>expect(chatDay('2026-11-14T18:00:00Z',new Date('2026-11-14T20:00:00Z'))).toBe('Yesterday'));
 it('labels older messages with a calendar date',()=>expect(chatDay('2026-11-10T07:00:00Z',new Date('2026-11-14T20:00:00Z'))).toBe('10 Nov 2026'));
});
