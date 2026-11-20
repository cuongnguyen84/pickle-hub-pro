import { describe, expect, it } from 'vitest';
import { isClubFixtureRequest, VISUAL_CLUBS, visualNetworkPolicy, safeVisualDiagnostic } from '../../../tests/helpers/visual-stability';
describe('visual fixtures stay scoped and useful',()=>{
 it('intercepts only the public read contract',()=>{
  const origin='https://ajvlcamxemgbxduhiqrl.supabase.co';
  expect(isClubFixtureRequest(origin+'/rest/v1/club_listing?select=id','GET')).toBe(true);
  for(const [url,method] of [[origin+'/rest/v1/club_listing','POST'],[origin+'/rest/v1/profiles','GET'],['https://other.test/rest/v1/club_listing','GET']]) expect(isClubFixtureRequest(url,method)).toBe(false);
 });
 it('preserves nonempty varied card states instead of masking layout',()=>{
  expect(VISUAL_CLUBS).toHaveLength(2);expect(VISUAL_CLUBS.some(c=>c.upcoming_events>0)).toBe(true);expect(VISUAL_CLUBS.some(c=>c.upcoming_events===0)).toBe(true);expect(VISUAL_CLUBS.some(c=>/Thành/.test(c.name))).toBe(true);
 });
});

describe('visual network guard',()=>{
 it('blocks heartbeat and analytics even for GET tracking pixels',()=>{
  expect(visualNetworkPolicy('https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/rpc/record_heartbeat','POST')).toBe('telemetry');
  expect(visualNetworkPolicy('https://www.google-analytics.com/g/collect?secret=not-logged','GET')).toBe('telemetry');
 });
 it('unknown business writes never reach network; read RPCs are explicit',()=>{
  expect(visualNetworkPolicy('https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/rpc/get_or_create_dm','POST')).toBe('forbidden');
  expect(visualNetworkPolicy('https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/event_registrations','POST')).toBe('forbidden');
  expect(visualNetworkPolicy('https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/rpc/get_homepage_stats','POST')).toBe('read');
  expect(visualNetworkPolicy('https://evil.test/rest/v1/rpc/get_homepage_stats','POST')).toBe('forbidden');
 });
});

it('diagnostics strip query credentials, tokens and record identifiers',()=>{
 const diagnostic=safeVisualDiagnostic('GET https://example.test/rest/v1/items?apikey=secret&id=private 00000000-0000-4000-8000-000000000101 eyJabc.def.ghi');
 expect(diagnostic).not.toContain('secret');expect(diagnostic).not.toContain('private');expect(diagnostic).not.toContain('000000000101');expect(diagnostic).not.toContain('eyJabc');
});
