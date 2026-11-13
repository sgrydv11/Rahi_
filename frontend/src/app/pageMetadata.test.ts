import { describe,expect,it } from 'vitest';
import { pageMetadata } from './pageMetadata';
describe('page metadata',()=>{
  it('uses specific titles without treating fixed ride routes as IDs',()=>{
    expect(pageMetadata('/rides/new').title).toBe('Offer a ride | FlexirRides');
    expect(pageMetadata('/rides/mine').title).toBe('My ride offers | FlexirRides');
    expect(pageMetadata('/rides/ride-id').title).toBe('Ride details | FlexirRides');
    expect(pageMetadata('/help').description).toContain('book rides');
  });
  it('marks private and missing pages noindex and gives unknown routes recovery metadata',()=>{
    expect(pageMetadata('/chat').robots).toBe('noindex, follow');
    expect(pageMetadata('/not-a-page').title).toBe('Page not found | FlexirRides');
    expect(pageMetadata('/rides').robots).toBe('index, follow');
  });
});
