import {describe,it,expect} from 'vitest';
import {nearbyCity} from './nearbyCity';
describe('approximate supported city detection',()=>{
 it('detects each supported city and leaves unknown/invalid locations unset',()=>{expect(nearbyCity(22.7196,75.8577)).toBe('Indore');expect(nearbyCity(23.1765,75.7885)).toBe('Ujjain');expect(nearbyCity(22.9676,76.0534)).toBe('Dewas');expect(nearbyCity(22.6197,75.6933)).toBe('Pithampur');expect(nearbyCity(28.6,77.2)).toBeNull();expect(nearbyCity(NaN,75)).toBeNull();expect(nearbyCity(100,75)).toBeNull();});
});
