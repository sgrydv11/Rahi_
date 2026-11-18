import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyCity} from '../src/nearbyCity.ts';
test('nearby city is resolved locally and never invents a remote supported city',()=>{assert.equal(nearbyCity(22.7196,75.8577),'Indore');assert.equal(nearbyCity(23.1765,75.7885),'Ujjain');assert.equal(nearbyCity(22.9676,76.0534),'Dewas');assert.equal(nearbyCity(22.6197,75.6933),'Pithampur');assert.equal(nearbyCity(28.6,77.2),null);assert.equal(nearbyCity(Infinity,75),null);});
