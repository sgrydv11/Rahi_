import {describe,it,expect} from 'vitest';
import {parseAmount} from './WalletPage';
describe('wallet amount validation',()=>{
 it('uses integer paise and enforces the sandbox bounds',()=>{expect(parseAmount('10.25')).toBe(1025);expect(parseAmount('10000')).toBe(1000000);for(const input of ['0','0.99','10000.01','1.001','-1','1e3','NaN',''])expect(parseAmount(input)).toBeNull();});
});
