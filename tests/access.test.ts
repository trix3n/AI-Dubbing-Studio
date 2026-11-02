import {describe,it,expect} from 'vitest';
import {accessState} from '../src/lib/access';
const password='test-only-long-password';
const basic=(value:string)=>'Basic '+Buffer.from(value).toString('base64');
describe('private deployment access',()=>{
 it('fails closed on Vercel without a strong password',()=>{expect(accessState(null,undefined,true)).toBe('unconfigured');expect(accessState(null,'short',true)).toBe('unconfigured')});
 it('requires authentication',()=>expect(accessState(null,password,true)).toBe('unauthorized'));
 it('rejects wrong username, password, malformed auth and bearer tokens',()=>{for(const h of [basic('other:'+password),basic('longray:wrong'),'Basic !!!!','Bearer token'])expect(accessState(h,password,true)).toBe('unauthorized')});
 it('allows valid credentials',()=>expect(accessState(basic('longray:'+password),password,true)).toBe('allowed'));
 it('keeps unconfigured local development available',()=>expect(accessState(null,undefined,false)).toBe('allowed'));
});
